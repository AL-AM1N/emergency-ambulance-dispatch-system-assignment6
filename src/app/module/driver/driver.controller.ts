import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { stringifyQuery } from "../../utils/query";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { DriverService } from "./driver.service";

const getUser = (req: Request) => req.user as IRequestUser;

const getProfile = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.getProfile(getUser(req).userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Driver profile fetched successfully",
		data: result,
	});
});

const updateAvailability = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.updateAvailability(
		getUser(req).userId,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Availability updated successfully",
		data: result,
	});
});

const getCurrentTrip = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.getCurrentTrip(getUser(req).userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result
			? "Current trip fetched successfully"
			: "No active trip found",
		data: result,
	});
});

const myTrips = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.listTrips(
		getUser(req).userId,
		stringifyQuery(req.query),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Driver trips fetched successfully",
		data: result.result,
		meta: result.meta,
	});
});

const getTripById = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.getTripById(
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

const acceptTrip = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.acceptTrip(
		getUser(req).userId,
		String(req.params.id),
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trip accepted successfully",
		data: result,
	});
});

const updateTripStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.updateTripStatus(
		getUser(req).userId,
		String(req.params.id),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Trip status updated successfully",
		data: result,
	});
});

const notifications = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.listNotifications(getUser(req).userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Notifications fetched successfully",
		data: result,
	});
});

const markNotificationRead = catchAsync(async (req: Request, res: Response) => {
	const result = await DriverService.markNotificationRead(
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

export const DriverController = {
	getProfile,
	updateAvailability,
	getCurrentTrip,
	myTrips,
	getTripById,
	acceptTrip,
	updateTripStatus,
	notifications,
	markNotificationRead,
};
