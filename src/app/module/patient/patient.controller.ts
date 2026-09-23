import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { stringifyQuery } from "../../utils/query";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { PatientService } from "./patient.service";

const getUser = (req: Request) => req.user as IRequestUser;

const createEmergencyRequest = catchAsync(
	async (req: Request, res: Response) => {
		const result = await PatientService.createEmergencyRequest(
			getUser(req).userId,
			req.body,
		);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Emergency request created successfully",
			data: result,
		});
	},
);

const myEmergencyRequests = catchAsync(async (req: Request, res: Response) => {
	const result = await PatientService.listEmergencyRequests(
		getUser(req).userId,
		stringifyQuery(req.query),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Emergency requests fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getEmergencyRequest = catchAsync(async (req: Request, res: Response) => {
	const result = await PatientService.getEmergencyRequestById(
		getUser(req).userId,
		String(req.params.id),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Emergency request fetched successfully",
		data: result,
	});
});

const cancelEmergencyRequest = catchAsync(
	async (req: Request, res: Response) => {
		const result = await PatientService.cancelEmergencyRequest(
			getUser(req).userId,
			String(req.params.id),
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Emergency request cancelled successfully",
			data: result,
		});
	},
);

const myTrips = catchAsync(async (req: Request, res: Response) => {
	const result = await PatientService.listTrips(
		getUser(req).userId,
		stringifyQuery(req.query),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trip history fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getTripById = catchAsync(async (req: Request, res: Response) => {
	const result = await PatientService.getEmergencyRequestById(
		getUser(req).userId,
		String(req.params.id),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trip details fetched successfully",
		data: result,
	});
});

const notifications = catchAsync(async (req: Request, res: Response) => {
	const result = await PatientService.listNotifications(getUser(req).userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notifications fetched successfully",
		data: result,
	});
});

const markNotificationRead = catchAsync(async (req: Request, res: Response) => {
	const result = await PatientService.markNotificationRead(
		getUser(req).userId,
		String(req.params.id),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notification marked as read",
		data: result,
	});
});

export const PatientController = {
	createEmergencyRequest,
	myEmergencyRequests,
	getEmergencyRequest,
	cancelEmergencyRequest,
	myTrips,
	getTripById,
	notifications,
	markNotificationRead,
};
