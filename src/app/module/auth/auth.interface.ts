import type { Role } from "../../../generated/prisma/enums";

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRegisterPatientPayload {
	name: string;
	email: string;
	password: string;
	patient?: {
		contactNumber?: string;
		address?: string;
	};
}

export interface IRegisterDriverPayload {
	name: string;
	email: string;
	password: string;
	contactNumber?: string;
	licenseNumber: string;
	vehicleNumber: string;
	ambulanceType?: string;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IGoogleLoginPayload {
	idToken: string;
}
