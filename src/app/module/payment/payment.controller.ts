import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "../auth/auth.interface";
import { PaymentService } from "./payment.service";

const getUserId = (req: Request) => (req.user as IRequestUser).userId;

const createPaymentIntent = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.createPaymentIntent(
		getUserId(req),
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment intent created successfully",
		data: result,
	});
});

const confirmPayment = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.confirmPayment(getUserId(req), req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment confirmed successfully",
		data: result,
	});
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body as Buffer;
	const signature = req.headers["stripe-signature"];

	if (!signature) {
		sendResponse(res, {
			statusCode: httpStatus.BAD_REQUEST,
			success: false,
			message: "Stripe signature header is missing",
			data: null,
		});
		return;
	}

	await PaymentService.handleWebhook(payload, signature as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Webhook triggered successfully",
		data: null,
	});
});

export const PaymentController = {
	createPaymentIntent,
	confirmPayment,
	handleWebhook,
};
