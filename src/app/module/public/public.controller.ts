import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { stringifyQuery } from "../../utils/query";
import { sendResponse } from "../../utils/sendResponse";
import { PublicService } from "./public.service";

const getAmbulanceTypes = catchAsync(async (_req: Request, res: Response) => {
	const result = await PublicService.getAmbulanceTypes();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Ambulance types fetched successfully",
		data: result,
	});
});

const getHospitals = catchAsync(async (req: Request, res: Response) => {
	const result = await PublicService.getHospitals(stringifyQuery(req.query));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospitals fetched successfully",
		data: result,
	});
});

const getHospitalById = catchAsync(async (req: Request, res: Response) => {
	const result = await PublicService.getHospitalById(String(req.params.id));

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Hospital details fetched successfully",
		data: result,
	});
});

const getEmergencyInfo = catchAsync(async (_req: Request, res: Response) => {
	const result = await PublicService.getEmergencyInfo();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Emergency information fetched successfully",
		data: result,
	});
});

export const PublicController = {
	getAmbulanceTypes,
	getHospitals,
	getHospitalById,
	getEmergencyInfo,
};
