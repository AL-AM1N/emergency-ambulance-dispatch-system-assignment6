import httpStatus from "http-status";
import {
	AmbulanceStatus,
	Priority,
	TripStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { paginationHelper } from "../../utils/pagination";
import type {
	ICreateEmergencyRequestPayload,
	ITripListQuery,
} from "./patient.interface";

const REQUEST_DETAIL_INCLUDE = {
	patient: {
		select: { id: true, name: true, email: true, contactNumber: true },
	},
	ambulance: { include: { ambulanceType: true } },
	driver: {
		select: {
			id: true,
			name: true,
			email: true,
			contactNumber: true,
			vehicleNumber: true,
		},
	},
	hospital: true,
	payment: true,
} as const;

const CANCELLABLE_STATUSES: TripStatus[] = [
	TripStatus.PENDING,
	TripStatus.ASSIGNED,
	TripStatus.ACCEPTED,
	TripStatus.EN_ROUTE,
];

const getPatientByUserId = async (userId: string) => {
	const patient = await prisma.patient.findUnique({ where: { userId } });

	if (!patient || patient.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient profile not found");
	}

	return patient;
};

const createEmergencyRequest = async (
	userId: string,
	payload: ICreateEmergencyRequestPayload,
) => {
	const patient = await getPatientByUserId(userId);

	return prisma.emergencyRequest.create({
		data: {
			patientId: patient.id,
			patientName: payload.patientName,
			patientContact: payload.patientContact,
			emergencyType: payload.emergencyType,
			priority: payload.priority ?? Priority.MEDIUM,
			pickupLocation: payload.pickupLocation,
			pickupLatitude: payload.pickupLatitude,
			pickupLongitude: payload.pickupLongitude,
			additionalNote: payload.additionalNote,
			status: TripStatus.PENDING,
		},
		include: REQUEST_DETAIL_INCLUDE,
	});
};

const listEmergencyRequests = async (userId: string, query: ITripListQuery) => {
	const patient = await getPatientByUserId(userId);
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const where = {
		patientId: patient.id,
		...(query.status ? { status: query.status as TripStatus } : {}),
	};

	const [result, total] = await prisma.$transaction([
		prisma.emergencyRequest.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: REQUEST_DETAIL_INCLUDE,
		}),
		prisma.emergencyRequest.count({ where }),
	]);

	return {
		result,
		meta: paginationHelper.calculateMeta(total, page, limit),
	};
};

const getEmergencyRequestById = async (userId: string, id: string) => {
	const patient = await getPatientByUserId(userId);

	const request = await prisma.emergencyRequest.findFirst({
		where: { id, patientId: patient.id },
		include: REQUEST_DETAIL_INCLUDE,
	});

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Emergency request not found");
	}

	return request;
};

const cancelEmergencyRequest = async (userId: string, id: string) => {
	const patient = await getPatientByUserId(userId);

	const request = await prisma.emergencyRequest.findFirst({
		where: { id, patientId: patient.id },
	});

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Emergency request not found");
	}

	if (!CANCELLABLE_STATUSES.includes(request.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cancellation is not allowed once the ambulance has picked up the patient",
		);
	}

	const cancelled = await prisma.$transaction(async (tx) => {
		const updated = await tx.emergencyRequest.update({
			where: { id: request.id },
			data: {
				status: TripStatus.CANCELLED,
				cancelledAt: new Date(),
				cancelledReason: "Cancelled by patient",
			},
			include: REQUEST_DETAIL_INCLUDE,
		});

		if (request.ambulanceId) {
			await tx.ambulance.updateMany({
				where: { id: request.ambulanceId, status: AmbulanceStatus.BUSY },
				data: { status: AmbulanceStatus.AVAILABLE },
			});
		}

		if (request.driverId) {
			const driver = await tx.driver.findUnique({
				where: { id: request.driverId },
				select: { userId: true },
			});

			await tx.driver.update({
				where: { id: request.driverId },
				data: { isAvailable: true },
			});

			if (driver) {
				await tx.notification.create({
					data: {
						userId: driver.userId,
						title: "Trip Cancelled",
						message: `Trip #${request.id.slice(0, 8)} was cancelled by the patient. You are now available for new trips.`,
					},
				});
			}
		}

		return updated;
	});

	return cancelled;
};

const listTrips = async (userId: string, query: ITripListQuery) => {
	const { result, meta } = await listEmergencyRequests(userId, query);

	return { result, meta };
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

export const PatientService = {
	createEmergencyRequest,
	listEmergencyRequests,
	getEmergencyRequestById,
	cancelEmergencyRequest,
	listTrips,
	listNotifications,
	markNotificationRead,
};
