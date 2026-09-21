import type { CookieOptions, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

const accessTokenCookieOptions: CookieOptions = {
	httpOnly: true,
	secure: config.node_env === "development" ? false : true,
	sameSite: config.node_env === "development" ? "lax" : "none",
	maxAge: 1000 * 60 * 60 * 24, // 1 day
};

const refreshTokenCookieOptions: CookieOptions = {
	httpOnly: true,
	secure: config.node_env === "development" ? false : true,
	sameSite: config.node_env === "development" ? "lax" : "none",
	maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
};

const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	res.cookie("accessToken", accessToken, accessTokenCookieOptions);
	res.cookie("refreshToken", refreshToken, refreshTokenCookieOptions);
};

const registerPatient = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.registerPatient(req.body);
	const { accessToken, refreshToken, user, patient } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Patient registered successfully",
		data: { accessToken, refreshToken, user, patient },
	});
});

const registerDriver = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.registerDriver(req.body);
	const { accessToken, refreshToken, user, driver } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Driver registered successfully",
		data: { accessToken, refreshToken, user, driver },
	});
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.loginUser(req.body);
	const { accessToken, refreshToken } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in successfully",
		data: { accessToken, refreshToken },
	});
});

const getMe = catchAsync(async (req: Request, res: Response) => {
	const user = req.user as unknown as IRequestUser;

	if (!user) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User information is missing in the request",
		);
	}

	const result = await AuthService.getMe(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const refreshToken = catchAsync(async (req: Request, res: Response) => {
	if (!req.cookies.refreshToken) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Refresh token is missing");
	}

	const result = await AuthService.refreshToken(req.cookies.refreshToken);
	const { accessToken, refreshToken: newRefreshToken } = result;

	setAuthCookies(res, accessToken, newRefreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "New tokens generated successfully",
		data: { accessToken, refreshToken: newRefreshToken },
	});
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
	const result = await AuthService.googleLogin(req.body);
	const { accessToken, refreshToken } = result;

	setAuthCookies(res, accessToken, refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User logged in with google successfully",
		data: { accessToken, refreshToken },
	});
});

const logout = catchAsync(async (_req: Request, res: Response) => {
	res.clearCookie("accessToken");
	res.clearCookie("refreshToken");

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User Logged Out Successfully",
		data: null,
	});
});

export const AuthController = {
	registerPatient,
	registerDriver,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	logout,
};
