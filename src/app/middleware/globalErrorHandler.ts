import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/AppError";

export const globalErrorHandler = async (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	console.log("Error from Global Error Handler", err);

	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let errorMessage = err.message || "Internal Server Error";
	const errorName = err.name || "Internal Server Error";
	// Whether errorMessage is a deliberate, user-facing message that is safe
	// to expose in production (static Prisma messages and AppError messages).
	let safeForProduction = false;

	if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		errorMessage = "You have provided incorrect field type or missing fields";
		safeForProduction = true;
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.BAD_REQUEST;
			const target = (err.meta as { target?: string | string[] } | undefined)
				?.target;
			const fields = Array.isArray(target)
				? target.join(", ")
				: typeof target === "string"
					? target
					: "";
			errorMessage = fields
				? `An account with this ${fields} already exists`
				: "An account with this email already exists";
			safeForProduction = true;
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Foreign key constraint failed";
			safeForProduction = true;
		} else if (err.code === "P2025") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage =
				"An operation failed because it depends on one or more records that were required but not found.";
			safeForProduction = true;
		}
	} else if (err instanceof Prisma.PrismaClientInitializationError) {
		if (err.errorCode === "P1000") {
			statusCode = httpStatus.UNAUTHORIZED;
			errorMessage =
				"Authentication failed against database server. Please Check Your Credentials";
			safeForProduction = true;
		} else if (err.errorCode === "P1001") {
			statusCode = httpStatus.BAD_REQUEST;
			errorMessage = "Can't reach database server";
			safeForProduction = true;
		}
	} else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
		statusCode = httpStatus.INTERNAL_SERVER_ERROR;
		errorMessage = "Error occurred during query execution";
		safeForProduction = true;
	} else if (err instanceof AppError) {
		errorMessage = err.message;
		statusCode = err.statusCode;
		safeForProduction = true;
	} else if (err instanceof Error) {
		errorMessage = err.message;
	}

	const isDevelopment = config.node_env === "development";
	const message =
		isDevelopment || safeForProduction
			? errorMessage
			: defaultMessageFor(statusCode);

	res.status(statusCode).json({
		success: false,
		statusCode: statusCode || httpStatus.INTERNAL_SERVER_ERROR,
		name: isDevelopment ? errorName : "Internal Server Error",
		message,
		error: isDevelopment ? err : undefined,
		stack: isDevelopment ? err.stack : undefined,
	});
};

function defaultMessageFor(statusCode: number): string {
	switch (statusCode) {
		case httpStatus.BAD_REQUEST:
			return "Invalid request";
		case httpStatus.UNAUTHORIZED:
			return "Unauthorized request";
		case httpStatus.FORBIDDEN:
			return "You are not allowed to perform this action";
		case httpStatus.NOT_FOUND:
			return "Resource not found";
		case httpStatus.CONFLICT:
			return "Resource already exists";
		case httpStatus.UNPROCESSABLE_ENTITY:
			return "Validation failed";
		default:
			return "Something went wrong, please try again";
	}
}
