import httpStatus from "http-status";
import { AmbulanceStatus, TripStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { calculateFare, estimateDistanceKm } from "../../utils/fare";
import { paginationHelper } from "../../utils/pagination";
import type {
	IDriverTripListQuery,
	IUpdateAvailabilityPayload,
	IUpdateTripStatusPayload,
} from "./driver.interface";

const TRIP_DETAIL_INCLUDE = {
	patient: {
		select: { id: true, name: true, email: true, contactNumber: true },
	},
	ambulance: { include: { ambulanceType: true } },
	hospital: true,
	payment: true,
} as const;

const ACTIVE_TRIP_STATUSES: TripStatus[] = [
	TripStatus.ASSIGNED,
	TripStatus.ACCEPTED,
	TripStatus.EN_ROUTE,
	TripStatus.PICKED_UP,
	TripStatus.HOSPITAL_ARRIVED,
];

const STATUS_TRANSITIONS: Partial<Record<TripStatus, TripStatus>> = {
	[TripStatus.EN_ROUTE]: TripStatus.ACCEPTED,
	[TripStatus.PICKED_UP]: TripStatus.EN_ROUTE,
	[TripStatus.HOSPITAL_ARRIVED]: TripStatus.PICKED_UP,
	[TripStatus.COMPLETED]: TripStatus.HOSPITAL_ARRIVED,
};

const getDriverByUserId = async (userId: string) => {
	const driver = await prisma.driver.findUnique({ where: { userId } });

	if (!driver || driver.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Driver profile not found");
	}

	return driver;
};

const getProfile = async (userId: string) => {
	const driver = await prisma.driver.findUnique({
		where: { userId },
		select: {
			id: true,
			name: true,
			email: true,
			contactNumber: true,
			licenseNumber: true,
			vehicleNumber: true,
			ambulanceType: true,
			isAvailable: true,
			createdAt: true,
			user: { select: { id: true, email: true, status: true } },
			ambulance: {
				include: {
					ambulanceType: true,
				},
			},
		},
	});

	if (!driver || driver.user.status === "BLOCKED") {
		throw new AppError(httpStatus.NOT_FOUND, "Driver profile not found");
	}

	return driver;
};

const updateAvailability = async (
	userId: string,
	payload: IUpdateAvailabilityPayload,
) => {
	const driver = await getDriverByUserId(userId);

	if (!payload.isAvailable) {
		const activeTrip = await prisma.emergencyRequest.findFirst({
			where: {
				driverId: driver.id,
				status: { in: ACTIVE_TRIP_STATUSES },
			},
			select: { id: true },
		});

		if (activeTrip) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot change availability while on an active trip",
			);
		}
	}

	return prisma.driver.update({
		where: { id: driver.id },
		data: { isAvailable: payload.isAvailable },
	});
};

const getCurrentTrip = async (userId: string) => {
	const driver = await getDriverByUserId(userId);

	return prisma.emergencyRequest.findFirst({
		where: {
			driverId: driver.id,
			status: { in: ACTIVE_TRIP_STATUSES },
		},
		orderBy: { createdAt: "desc" },
		include: TRIP_DETAIL_INCLUDE,
	});
};

const listTrips = async (userId: string, query: IDriverTripListQuery) => {
	const driver = await getDriverByUserId(userId);
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const where = {
		driverId: driver.id,
		...(query.status ? { status: query.status as TripStatus } : {}),
	};

	const [result, total] = await prisma.$transaction([
		prisma.emergencyRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: TRIP_DETAIL_INCLUDE,
		}),
		prisma.emergencyRequest.count({ where }),
	]);

	return {
		result,
		meta: paginationHelper.calculateMeta(total, page, limit),
	};
};

const getTripById = async (userId: string, id: string) => {
	const driver = await getDriverByUserId(userId);

	const trip = await prisma.emergencyRequest.findFirst({
		where: { id, driverId: driver.id },
		include: TRIP_DETAIL_INCLUDE,
	});

	if (!trip) {
		throw new AppError(httpStatus.NOT_FOUND, "Trip not found");
	}

	return trip;
};

const acceptTrip = async (userId: string, id: string) => {
	const driver = await getDriverByUserId(userId);

	const trip = await prisma.emergencyRequest.findFirst({
		where: { id, driverId: driver.id },
	});

	if (!trip) {
		throw new AppError(httpStatus.NOT_FOUND, "Trip not found");
	}

	if (trip.status !== TripStatus.ASSIGNED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Trip can only be accepted when it is in ASSIGNED status",
		);
	}

	const patient = await prisma.patient.findUnique({
		where: { id: trip.patientId },
		select: { userId: true, name: true },
	});

	const updated = await prisma.$transaction(async (tx) => {
		const result = await tx.emergencyRequest.update({
			where: { id: trip.id },
			data: { status: TripStatus.ACCEPTED, acceptedAt: new Date() },
			include: TRIP_DETAIL_INCLUDE,
		});

		if (patient) {
			await tx.notification.create({
				data: {
					userId: patient.userId,
					title: "Ambulance Assigned",
					message: `Driver ${driver.name} has accepted your emergency request. They are on the way.`,
				},
			});
		}

		return result;
	});

	return updated;
};

const updateTripStatus = async (
	userId: string,
	id: string,
	payload: IUpdateTripStatusPayload,
) => {
	const driver = await getDriverByUserId(userId);

	const trip = await prisma.emergencyRequest.findFirst({
		where: { id, driverId: driver.id },
		include: {
			ambulance: { include: { ambulanceType: true } },
			hospital: true,
			patient: { select: { userId: true, name: true } },
		},
	});

	if (!trip) {
		throw new AppError(httpStatus.NOT_FOUND, "Trip not found");
	}

	const expectedPreviousStatus = STATUS_TRANSITIONS[payload.status];

	if (!expectedPreviousStatus || trip.status !== expectedPreviousStatus) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Invalid status transition: cannot move from ${trip.status} to ${payload.status}`,
		);
	}

	if (payload.status === TripStatus.HOSPITAL_ARRIVED && !trip.hospitalId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"No hospital has been selected for this trip yet. Please wait for the dispatcher.",
		);
	}

	let fare: number | undefined;
	let distanceKm: number | undefined;

	if (payload.status === TripStatus.COMPLETED) {
		if (!trip.hospitalId || !trip.hospital) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"Cannot complete the trip without a selected hospital",
			);
		}

		distanceKm = estimateDistanceKm(
			trip.pickupLatitude,
			trip.pickupLongitude,
			trip.hospital.latitude,
			trip.hospital.longitude,
		);

		const baseFare = trip.ambulance?.ambulanceType?.baseFare ?? 0;
		const perKmRate = trip.ambulance?.ambulanceType?.perKmRate ?? 0;

		fare = calculateFare(baseFare, perKmRate, distanceKm);
	}

	const updated = await prisma.$transaction(async (tx) => {
		const data: Record<string, unknown> = { status: payload.status };

		if (payload.status === TripStatus.PICKED_UP) {
			data.pickedUpAt = new Date();
		}

		if (payload.status === TripStatus.HOSPITAL_ARRIVED) {
			data.arrivedAt = new Date();
		}

		if (payload.status === TripStatus.COMPLETED) {
			data.completedAt = new Date();
			data.fare = fare;
			data.distanceKm = distanceKm;
		}

		const result = await tx.emergencyRequest.update({
			where: { id: trip.id },
			data,
			include: TRIP_DETAIL_INCLUDE,
		});

		if (payload.status === TripStatus.COMPLETED) {
			if (trip.ambulanceId) {
				await tx.ambulance.updateMany({
					where: { id: trip.ambulanceId, status: AmbulanceStatus.BUSY },
					data: { status: AmbulanceStatus.AVAILABLE },
				});
			}

			await tx.driver.update({
				where: { id: driver.id },
				data: { isAvailable: true },
			});

			if (trip.patient) {
				await tx.notification.create({
					data: {
						userId: trip.patient.userId,
						title: "Trip Completed",
						message: `Your trip is complete. Total fare is $${fare?.toFixed(2)}. Please complete the payment.`,
					},
				});
			}
		}

		return result;
	});

	return updated;
};

const listNotifications = async (userId: string) => {
	return prisma.notification.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		take: 50,
	});
};

const markNotificationRead = async (userId: string, id: string) => {
	const notification = await prisma.notification.findFirst({
		where: { id, userId },
	});

	if (!notification) {
		throw new AppError(httpStatus.NOT_FOUND, "Notification not found");
	}

	return prisma.notification.update({
		where: { id: notification.id },
		data: { isRead: true, readAt: new Date() },
	});
};

export const DriverService = {
	getProfile,
	updateAvailability,
	getCurrentTrip,
	listTrips,
	getTripById,
	acceptTrip,
	updateTripStatus,
	listNotifications,
	markNotificationRead,
};
