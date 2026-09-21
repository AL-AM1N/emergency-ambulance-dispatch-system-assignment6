import bcrypt from "bcryptjs";
import type { TokenPayload } from "google-auth-library";
import httpStatus from "http-status";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { jwtUtils } from "../../utils/jwt";
import type {
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterDriverPayload,
	IRegisterPatientPayload,
	IRequestUser,
} from "./auth.interface";

type TokenUser = {
	id: string;
	name: string;
	email: string;
	role: Role;
};

const createTokens = (user: TokenUser) => {
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return { accessToken, refreshToken };
};

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({ where: { email } });

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	const createdUser = await prisma.user.create({
		data: {
			name,
			email,
			password: hashedPassword,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: {
					name,
					email,
					contactNumber: patientData?.contactNumber ?? "",
					address: patientData?.address ?? "",
				},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	const { patient, ...user } = createdUser;
	const { accessToken, refreshToken } = createTokens(user);

	return { user, patient, accessToken, refreshToken };
};

const registerDriver = async (payload: IRegisterDriverPayload) => {
	const { name, password, contactNumber, licenseNumber, vehicleNumber } =
		payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({ where: { email } });

	if (isUserExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists",
		);
	}

	const isLicenseExists = await prisma.driver.findUnique({
		where: { licenseNumber },
	});

	if (isLicenseExists) {
		throw new AppError(
			httpStatus.CONFLICT,
			"Driver with this license number already exists",
		);
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	const createdUser = await prisma.user.create({
		data: {
			name,
			email,
			password: hashedPassword,
			role: Role.DRIVER,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			driver: {
				create: {
					name,
					email,
					contactNumber: contactNumber ?? "",
					licenseNumber,
					vehicleNumber,
					ambulanceType: payload.ambulanceType ?? "",
				},
			},
		},
		omit: { password: true },
		include: { driver: true },
	});

	const { driver, ...user } = createdUser;
	const { accessToken, refreshToken } = createTokens(user);

	return { user, driver, accessToken, refreshToken };
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({ where: { email } });

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User Already Has Account Registered With Google. Try To Login With Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const { accessToken, refreshToken } = createTokens(user);

	return { accessToken, refreshToken };
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: { id: user.userId },
		include: { patient: true, driver: true },
		omit: { password: true },
	});

	if (!isUserExists) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({ where: { id: data.userId } });

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"User is inactive or not found",
		);
	}

	const { accessToken, refreshToken: newRefreshToken } = createTokens(user);

	return { accessToken, refreshToken: newRefreshToken };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | null | undefined = null;
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("Google ID Token Verification Failed", error);
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid Or Expired Google Id Token",
		);
	}

	if (!googleIdTokenPayload) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			"Invalid Or Expired Google Id Token",
		);
	}

	if (!googleIdTokenPayload.email) {
		throw new AppError(httpStatus.BAD_REQUEST, "Google Email Not Found");
	}

	if (!googleIdTokenPayload.name) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Google User Name Not Found",
		);
	}

	const googleEmail = googleIdTokenPayload.email.trim().toLowerCase();

	let user = await prisma.user.findUnique({ where: { email: googleEmail } });

	if (!user) {
		// First-time Google login always creates a PATIENT.
		user = await prisma.user.create({
			data: {
				name: googleIdTokenPayload.name,
				email: googleEmail,
				role: Role.PATIENT,
				googleId: googleIdTokenPayload.sub,
				authProvider: AuthProvider.GOOGLE,
				emailVerified: true,
				patient: {
					create: {
						name: googleIdTokenPayload.name,
						email: googleEmail,
					},
				},
			},
		});
	} else {
		if (user.status === UserStatus.BLOCKED) {
			throw new AppError(httpStatus.FORBIDDEN, "User Is Blocked");
		}

		if (user.isDeleted || user.status === UserStatus.DELETED) {
			throw new AppError(httpStatus.FORBIDDEN, "User Is Deleted");
		}

		if (user.role === Role.ADMIN) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Admins must log in with email and password",
			);
		}

		// Patients and Drivers may link Google to an existing account.
		if (user.googleId !== googleIdTokenPayload.sub) {
			user = await prisma.user.update({
				where: { id: user.id },
				data: { googleId: googleIdTokenPayload.sub },
			});
		}
	}

	const { accessToken, refreshToken } = createTokens(user);

	return { accessToken, refreshToken };
};

export const AuthService = {
	registerPatient,
	registerDriver,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
};