import httpStatus from "http-status";
import {
	AmbulanceStatus,
	HospitalType,
	PaymentStatus,
	TripStatus,
	UserStatus,
} from "../../../generated/prisma/enums";
import type { Priority } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { paginationHelper } from "../../utils/pagination";
import type {
	IAdminListQuery,
	IAssignAmbulancePayload,
	ICreateAmbulancePayload,
	ICreateHospitalPayload,
	ISelectHospitalPayload,
	IUpdateAmbulancePayload,
	IUpdateDriverPayload,
	IUpdateHospitalPayload,
} from "./admin.interface";

const TRIP_DETAIL_INCLUDE = {
	patient: {
		select: { id: true, name: true, email: true, contactNumber: true },
	},
	driver: {
		select: {
			id: true,
			name: true,
			email: true,
			contactNumber: true,
			vehicleNumber: true,
		},
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

const parseDate = (value?: string) => {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// ---------------------------------------------------------------
// Emergency Request Management
// ---------------------------------------------------------------

const listEmergencyRequests = async (query: IAdminListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const where = {
		...(query.status ? { status: query.status as TripStatus } : {}),
		...(query.priority ? { priority: query.priority as Priority } : {}),
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

const getEmergencyRequestById = async (id: string) => {
	const request = await prisma.emergencyRequest.findUnique({
		where: { id },
		include: TRIP_DETAIL_INCLUDE,
	});

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Emergency request not found");
	}

	return request;
};

const changePriority = async (id: string, priority: Priority) => {
	const request = await prisma.emergencyRequest.findUnique({ where: { id } });

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Emergency request not found");
	}

	if (
		request.status === TripStatus.COMPLETED ||
		request.status === TripStatus.CANCELLED
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Priority cannot be changed for a completed or cancelled request",
		);
	}

	return prisma.emergencyRequest.update({
		where: { id },
		data: { priority },
		include: TRIP_DETAIL_INCLUDE,
	});
};

const assignRequest = async (id: string, payload: IAssignAmbulancePayload) => {
	const { ambulanceId } = payload;

	const request = await prisma.emergencyRequest.findUnique({ where: { id } });

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Emergency request not found");
	}

	if (request.status !== TripStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Only pending emergency requests can be assigned",
		);
	}

	const ambulance = await prisma.ambulance.findUnique({
		where: { id: ambulanceId },
		include: {
			ambulanceType: true,
			driver: {
				include: { user: { select: { status: true, isDeleted: true } } },
			},
		},
	});

	if (!ambulance || ambulance.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Ambulance not found");
	}

	if (ambulance.status !== AmbulanceStatus.AVAILABLE) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Ambulance is currently ${ambulance.status}. Only available ambulances can be assigned`,
		);
	}

	if (!ambulance.driverId || !ambulance.driver) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Ambulance has no driver assigned to it",
		);
	}

	const driver = ambulance.driver;

	if (driver.isDeleted) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Assigned driver has been removed",
		);
	}

	if (!driver.isAvailable) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Assigned driver is currently unavailable",
		);
	}

	if (driver.user.status !== UserStatus.ACTIVE || driver.user.isDeleted) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Assigned driver account is not active",
		);
	}

	return prisma.$transaction(async (tx) => {
		const updated = await tx.emergencyRequest.update({
			where: { id: request.id },
			data: {
				status: TripStatus.ASSIGNED,
				ambulanceId: ambulance.id,
				driverId: driver.id,
				assignedAt: new Date(),
			},
			include: TRIP_DETAIL_INCLUDE,
		});

		await tx.ambulance.update({
			where: { id: ambulance.id },
			data: { status: AmbulanceStatus.BUSY },
		});

		await tx.notification.create({
			data: {
				userId: driver.userId,
				title: "New Trip Assigned",
				message: `A new ${request.priority} priority trip has been assigned to you. Pickup: ${request.pickupLocation}`,
			},
		});

		return updated;
	});
};

const selectHospital = async (id: string, payload: ISelectHospitalPayload) => {
	const { hospitalId } = payload;

	const request = await prisma.emergencyRequest.findUnique({ where: { id } });

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Emergency request not found");
	}

	if (
		request.status === TripStatus.COMPLETED ||
		request.status === TripStatus.CANCELLED ||
		request.status === TripStatus.PENDING
	) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Hospital can only be selected for an active trip",
		);
	}

	const hospital = await prisma.hospital.findFirst({
		where: { id: hospitalId, isDeleted: false, isActive: true },
	});

	if (!hospital) {
		throw new AppError(httpStatus.NOT_FOUND, "Hospital not found");
	}

	return prisma.emergencyRequest.update({
		where: { id: request.id },
		data: { hospitalId: hospital.id },
		include: TRIP_DETAIL_INCLUDE,
	});
};

// ---------------------------------------------------------------
// Hospital Management
// ---------------------------------------------------------------

const createHospital = async (payload: ICreateHospitalPayload) => {
	return prisma.hospital.create({
		data: {
			name: payload.name,
			address: payload.address,
			contactNumber: payload.contactNumber,
			email: payload.email,
			type: payload.type ?? HospitalType.GENERAL,
			latitude: payload.latitude,
			longitude: payload.longitude,
			isActive: true,
		},
	});
};

const listHospitals = async (query: IAdminListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const where = {
		isDeleted: false,
		...(query.type ? { type: query.type as HospitalType } : {}),
		...(query.searchTerm
			? {
					OR: [
						{
							name: {
								contains: query.searchTerm,
								mode: "insensitive" as const,
							},
						},
						{
							address: {
								contains: query.searchTerm,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
	};

	const [result, total] = await prisma.$transaction([
		prisma.hospital.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		}),
		prisma.hospital.count({ where }),
	]);

	return {
		result,
		meta: paginationHelper.calculateMeta(total, page, limit),
	};
};

const getHospitalById = async (id: string) => {
	const hospital = await prisma.hospital.findFirst({
		where: { id, isDeleted: false },
	});

	if (!hospital) {
		throw new AppError(httpStatus.NOT_FOUND, "Hospital not found");
	}

	return hospital;
};

const updateHospital = async (id: string, payload: IUpdateHospitalPayload) => {
	const hospital = await getHospitalById(id);

	return prisma.hospital.update({ where: { id: hospital.id }, data: payload });
};

const deleteHospital = async (id: string) => {
	const hospital = await getHospitalById(id);

	const activeTrip = await prisma.emergencyRequest.findFirst({
		where: {
			hospitalId: hospital.id,
			status: { in: ACTIVE_TRIP_STATUSES },
		},
		select: { id: true },
	});

	if (activeTrip) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Hospital is assigned to an active trip and cannot be deleted",
		);
	}

	return prisma.hospital.update({
		where: { id: hospital.id },
		data: { isActive: false, isDeleted: true, deletedAt: new Date() },
	});
};

// ---------------------------------------------------------------
// Ambulance Management
// ---------------------------------------------------------------

const createAmbulance = async (payload: ICreateAmbulancePayload) => {
	const ambulanceType = await prisma.ambulanceType.findFirst({
		where: { id: payload.ambulanceTypeId, isActive: true },
	});

	if (!ambulanceType) {
		throw new AppError(httpStatus.NOT_FOUND, "Ambulance type not found");
	}

	if (payload.driverId) {
		const driver = await prisma.driver.findFirst({
			where: { id: payload.driverId, isDeleted: false },
		});

		if (!driver) {
			throw new AppError(httpStatus.NOT_FOUND, "Driver not found");
		}

		const linkedAmbulance = await prisma.ambulance.findUnique({
			where: { driverId: payload.driverId },
			select: { id: true },
		});

		if (linkedAmbulance) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Driver is already assigned to another ambulance",
			);
		}
	}

	const duplicateVehicle = await prisma.ambulance.findUnique({
		where: { vehicleNumber: payload.vehicleNumber },
		select: { id: true },
	});

	if (duplicateVehicle) {
		throw new AppError(
			httpStatus.CONFLICT,
			"An ambulance with this vehicle number already exists",
		);
	}

	return prisma.ambulance.create({
		data: {
			vehicleNumber: payload.vehicleNumber,
			ambulanceTypeId: payload.ambulanceTypeId,
			status: payload.status ?? AmbulanceStatus.AVAILABLE,
			driverId: payload.driverId,
			currentLatitude: payload.currentLatitude,
			currentLongitude: payload.currentLongitude,
		},
		include: { ambulanceType: true, driver: true },
	});
};

const listAmbulances = async (query: IAdminListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const where = {
		isDeleted: false,
		...(query.status ? { status: query.status as AmbulanceStatus } : {}),
		...(query.searchTerm
			? {
					vehicleNumber: {
						contains: query.searchTerm,
						mode: "insensitive" as const,
					},
				}
			: {}),
	};

	const [result, total] = await prisma.$transaction([
		prisma.ambulance.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: { ambulanceType: true, driver: true },
		}),
		prisma.ambulance.count({ where }),
	]);

	return {
		result,
		meta: paginationHelper.calculateMeta(total, page, limit),
	};
};

const getAmbulanceById = async (id: string) => {
	const ambulance = await prisma.ambulance.findFirst({
		where: { id, isDeleted: false },
		include: { ambulanceType: true, driver: true },
	});

	if (!ambulance) {
		throw new AppError(httpStatus.NOT_FOUND, "Ambulance not found");
	}

	return ambulance;
};

const updateAmbulance = async (
	id: string,
	payload: IUpdateAmbulancePayload,
) => {
	const ambulance = await getAmbulanceById(id);

	if (
		payload.vehicleNumber &&
		payload.vehicleNumber !== ambulance.vehicleNumber
	) {
		const duplicate = await prisma.ambulance.findUnique({
			where: { vehicleNumber: payload.vehicleNumber },
			select: { id: true },
		});

		if (duplicate) {
			throw new AppError(
				httpStatus.CONFLICT,
				"An ambulance with this vehicle number already exists",
			);
		}
	}

	if (payload.driverId && payload.driverId !== ambulance.driverId) {
		const driver = await prisma.driver.findFirst({
			where: { id: payload.driverId, isDeleted: false },
		});

		if (!driver) {
			throw new AppError(httpStatus.NOT_FOUND, "Driver not found");
		}

		const linkedAmbulance = await prisma.ambulance.findUnique({
			where: { driverId: payload.driverId },
			select: { id: true },
		});

		if (linkedAmbulance && linkedAmbulance.id !== ambulance.id) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Driver is already assigned to another ambulance",
			);
		}
	}

	if (
		payload.ambulanceTypeId &&
		payload.ambulanceTypeId !== ambulance.ambulanceTypeId
	) {
		const ambulanceType = await prisma.ambulanceType.findFirst({
			where: { id: payload.ambulanceTypeId, isActive: true },
		});

		if (!ambulanceType) {
			throw new AppError(httpStatus.NOT_FOUND, "Ambulance type not found");
		}
	}

	return prisma.ambulance.update({
		where: { id: ambulance.id },
		data: payload,
		include: { ambulanceType: true, driver: true },
	});
};

const deleteAmbulance = async (id: string) => {
	const ambulance = await getAmbulanceById(id);

	const activeTrip = await prisma.emergencyRequest.findFirst({
		where: {
			ambulanceId: ambulance.id,
			status: { in: ACTIVE_TRIP_STATUSES },
		},
		select: { id: true },
	});

	if (activeTrip) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Ambulance is on an active trip and cannot be deleted",
		);
	}

	return prisma.ambulance.update({
		where: { id: ambulance.id },
		data: { isDeleted: true, deletedAt: new Date() },
	});
};

// ---------------------------------------------------------------
// Driver Management
// ---------------------------------------------------------------

const listDrivers = async (query: IAdminListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const where = {
		isDeleted: false,
		...(query.searchTerm
			? {
					OR: [
						{
							name: {
								contains: query.searchTerm,
								mode: "insensitive" as const,
							},
						},
						{
							email: {
								contains: query.searchTerm,
								mode: "insensitive" as const,
							},
						},
						{
							licenseNumber: {
								contains: query.searchTerm,
								mode: "insensitive" as const,
							},
						},
						{
							vehicleNumber: {
								contains: query.searchTerm,
								mode: "insensitive" as const,
							},
						},
					],
				}
			: {}),
	};

	const [result, total] = await prisma.$transaction([
		prisma.driver.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
			include: {
				user: { select: { email: true, status: true } },
				ambulance: { select: { id: true, vehicleNumber: true, status: true } },
			},
		}),
		prisma.driver.count({ where }),
	]);

	return {
		result,
		meta: paginationHelper.calculateMeta(total, page, limit),
	};
};

const getDriverById = async (id: string) => {
	const driver = await prisma.driver.findFirst({
		where: { id, isDeleted: false },
		include: {
			user: { select: { id: true, email: true, status: true } },
			ambulance: { include: { ambulanceType: true } },
		},
	});

	if (!driver) {
		throw new AppError(httpStatus.NOT_FOUND, "Driver not found");
	}

	return driver;
};

const updateDriver = async (id: string, payload: IUpdateDriverPayload) => {
	const driver = await getDriverById(id);

	if (payload.licenseNumber && payload.licenseNumber !== driver.licenseNumber) {
		const duplicate = await prisma.driver.findUnique({
			where: { licenseNumber: payload.licenseNumber },
			select: { id: true },
		});

		if (duplicate) {
			throw new AppError(
				httpStatus.CONFLICT,
				"Driver with this license number already exists",
			);
		}
	}

	return prisma.driver.update({
		where: { id: driver.id },
		data: payload,
	});
};

const updateDriverStatus = async (id: string, status: UserStatus) => {
	const driver = await getDriverById(id);

	if (driver.user.status === status) {
		return driver;
	}

	return prisma.user.update({
		where: { id: driver.userId },
		data: { status },
		select: {
			id: true,
			driver: true,
		},
	});
};

// ---------------------------------------------------------------
// Trip Management
// ---------------------------------------------------------------

const buildDateFilter = (query: IAdminListQuery) => {
	const start = parseDate(query.startDate);
	const end = parseDate(query.endDate);

	if (start && end) {
		return { gte: start, lte: end };
	}

	if (start) {
		return { gte: start };
	}

	if (end) {
		return { lte: end };
	}

	return null;
};

const listTrips = async (query: IAdminListQuery) => {
	const { page, limit, skip, sortBy, sortOrder } =
		paginationHelper.calculatePagination(query);

	const dateRange = buildDateFilter(query);

	const where = {
		...(query.status ? { status: query.status as TripStatus } : {}),
		...(query.driverId ? { driverId: query.driverId } : {}),
		...(query.ambulanceId ? { ambulanceId: query.ambulanceId } : {}),
		...(dateRange ? { createdAt: dateRange } : {}),
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

const getTripById = async (id: string) => {
	const trip = await prisma.emergencyRequest.findUnique({
		where: { id },
		include: TRIP_DETAIL_INCLUDE,
	});

	if (!trip) {
		throw new AppError(httpStatus.NOT_FOUND, "Trip not found");
	}

	return trip;
};

// ---------------------------------------------------------------
// Dashboard & Reports
// ---------------------------------------------------------------

const getDashboardStats = async () => {
	const [
		totalRequests,
		pendingRequests,
		activeTrips,
		completedTrips,
		cancelledTrips,
		availableAmbulances,
		busyAmbulances,
		maintenanceAmbulances,
		totalAmbulances,
		totalPatients,
		totalDrivers,
		totalHospitals,
		revenueAggregate,
	] = await Promise.all([
		prisma.emergencyRequest.count(),
		prisma.emergencyRequest.count({ where: { status: TripStatus.PENDING } }),
		prisma.emergencyRequest.count({
			where: { status: { in: ACTIVE_TRIP_STATUSES } },
		}),
		prisma.emergencyRequest.count({ where: { status: TripStatus.COMPLETED } }),
		prisma.emergencyRequest.count({ where: { status: TripStatus.CANCELLED } }),
		prisma.ambulance.count({
			where: { isDeleted: false, status: AmbulanceStatus.AVAILABLE },
		}),
		prisma.ambulance.count({
			where: { isDeleted: false, status: AmbulanceStatus.BUSY },
		}),
		prisma.ambulance.count({
			where: { isDeleted: false, status: AmbulanceStatus.MAINTENANCE },
		}),
		prisma.ambulance.count({ where: { isDeleted: false } }),
		prisma.patient.count({ where: { isDeleted: false } }),
		prisma.driver.count({ where: { isDeleted: false } }),
		prisma.hospital.count({ where: { isDeleted: false, isActive: true } }),
		prisma.payment.aggregate({
			where: { status: PaymentStatus.COMPLETED },
			_sum: { amount: true },
		}),
	]);

	return {
		totalRequests,
		pendingRequests,
		activeTrips,
		completedTrips,
		cancelledTrips,
		ambulances: {
			total: totalAmbulances,
			available: availableAmbulances,
			busy: busyAmbulances,
			maintenance: maintenanceAmbulances,
		},
		totalPatients,
		totalDrivers,
		totalHospitals,
		totalRevenue: revenueAggregate._sum.amount ?? 0,
	};
};

const getReportsTrips = async (query: IAdminListQuery) => {
	const { result, meta } = await listTrips(query);

	const statuses = await prisma.emergencyRequest.groupBy({
		by: ["status"],
		_count: { _all: true },
	});

	return {
		result,
		meta,
		summary: {
			total: statuses.reduce((acc, row) => acc + row._count._all, 0),
			byStatus: statuses,
		},
	};
};

const getReportsRevenue = async (query: IAdminListQuery) => {
	const start = parseDate(query.startDate);
	const end = parseDate(query.endDate);

	const where = {
		status: PaymentStatus.COMPLETED,
		paidAt:
			start || end
				? { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) }
				: undefined,
	};

	const [aggregate, payments] = await Promise.all([
		prisma.payment.aggregate({
			where,
			_sum: { amount: true },
			_count: { _all: true },
		}),
		prisma.payment.findMany({
			where,
			select: { amount: true, paidAt: true, transactionId: true, tripId: true },
			orderBy: { paidAt: "desc" },
		}),
	]);

	const dailyRevenue = new Map<string, number>();

	for (const payment of payments) {
		const day = payment.paidAt?.toISOString().slice(0, 10) ?? "unknown";
		dailyRevenue.set(day, (dailyRevenue.get(day) ?? 0) + payment.amount);
	}

	return {
		period: {
			startDate: start ? start.toISOString() : null,
			endDate: end ? end.toISOString() : null,
		},
		totalRevenue: aggregate._sum.amount ?? 0,
		totalTransactions: aggregate._count._all,
		dailyRevenue: Array.from(dailyRevenue, ([date, amount]) => ({
			date,
			amount,
		})).reverse(),
		transactions: payments,
	};
};

export const AdminService = {
	listEmergencyRequests,
	getEmergencyRequestById,
	changePriority,
	assignRequest,
	selectHospital,
	createHospital,
	listHospitals,
	getHospitalById,
	updateHospital,
	deleteHospital,
	createAmbulance,
	listAmbulances,
	getAmbulanceById,
	updateAmbulance,
	deleteAmbulance,
	listDrivers,
	getDriverById,
	updateDriver,
	updateDriverStatus,
	listTrips,
	getTripById,
	getDashboardStats,
	getReportsTrips,
	getReportsRevenue,
};
