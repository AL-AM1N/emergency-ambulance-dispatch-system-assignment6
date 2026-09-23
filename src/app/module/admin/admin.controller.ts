import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { UserStatus } from "../../../generated/prisma/enums";
import { catchAsync } from "../../utils/catchAsync";
import { stringifyQuery } from "../../utils/query";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

// ---------------------------------------------------------------
// Emergency Requests
// ---------------------------------------------------------------

const listEmergencyRequests = catchAsync(
	async (req: Request, res: Response) => {
		const result = await AdminService.listEmergencyRequests(
			stringifyQuery(req.query),
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Emergency requests fetched successfully",
			data: result.result,
			meta: result.meta,
		});
	},
);

const getEmergencyRequest = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getEmergencyRequestById(
		String(req.params.id),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Emergency request fetched successfully",
		data: result,
	});
});

const changePriority = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.changePriority(
		String(req.params.id),
		req.body.priority,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Emergency request priority updated successfully",
		data: result,
	});
});

const assignAmbulance = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.assignRequest(
		String(req.params.id),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Ambulance assigned successfully",
		data: result,
	});
});

const selectHospital = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.selectHospital(
		String(req.params.id),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospital selected successfully",
		data: result,
	});
});

// ---------------------------------------------------------------
// Hospitals
// ---------------------------------------------------------------

const createHospital = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.createHospital(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Hospital created successfully",
		data: result,
	});
});

const listHospitals = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listHospitals(stringifyQuery(req.query));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospitals fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getHospital = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getHospitalById(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospital fetched successfully",
		data: result,
	});
});

const updateHospital = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.updateHospital(
		String(req.params.id),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospital updated successfully",
		data: result,
	});
});

const deleteHospital = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.deleteHospital(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospital deleted successfully",
		data: result,
	});
});

// ---------------------------------------------------------------
// Ambulances
// ---------------------------------------------------------------

const createAmbulance = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.createAmbulance(req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Ambulance created successfully",
		data: result,
	});
});

const listAmbulances = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listAmbulances(stringifyQuery(req.query));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Ambulances fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getAmbulance = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAmbulanceById(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Ambulance fetched successfully",
		data: result,
	});
});

const updateAmbulance = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.updateAmbulance(
		String(req.params.id),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Ambulance updated successfully",
		data: result,
	});
});

const deleteAmbulance = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.deleteAmbulance(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Ambulance deleted successfully",
		data: result,
	});
});

// ---------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------

const listDrivers = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listDrivers(stringifyQuery(req.query));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Drivers fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getDriver = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getDriverById(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Driver fetched successfully",
		data: result,
	});
});

const updateDriver = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.updateDriver(
		String(req.params.id),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Driver updated successfully",
		data: result,
	});
});

const updateDriverStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.updateDriverStatus(
		String(req.params.id),
		req.body.status as UserStatus,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Driver status updated successfully",
		data: result,
	});
});

// ---------------------------------------------------------------
// Trips
// ---------------------------------------------------------------

const listTrips = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.listTrips(stringifyQuery(req.query));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trips fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getTrip = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getTripById(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trip fetched successfully",
		data: result,
	});
});

// ---------------------------------------------------------------
// Dashboard & Reports
// ---------------------------------------------------------------

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard statistics fetched successfully",
		data: result,
	});
});

const getReportsTrips = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getReportsTrips(stringifyQuery(req.query));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trip report generated successfully",
		data: result,
	});
});

const getReportsRevenue = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getReportsRevenue(
		stringifyQuery(req.query),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Revenue report generated successfully",
		data: result,
	});
});

export const AdminController = {
	listEmergencyRequests,
	getEmergencyRequest,
	changePriority,
	assignAmbulance,
	selectHospital,
	createHospital,
	listHospitals,
	getHospital,
	updateHospital,
	deleteHospital,
	createAmbulance,
	listAmbulances,
	getAmbulance,
	updateAmbulance,
	deleteAmbulance,
	listDrivers,
	getDriver,
	updateDriver,
	updateDriverStatus,
	listTrips,
	getTrip,
	getDashboardStats,
	getReportsTrips,
	getReportsRevenue,
};
