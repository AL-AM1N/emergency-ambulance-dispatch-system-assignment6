import type {
	AmbulanceStatus,
	HospitalType,
} from "../../../generated/prisma/enums";

export interface IAssignAmbulancePayload {
	ambulanceId: string;
}

export interface ISelectHospitalPayload {
	hospitalId: string;
}

export interface ICreateHospitalPayload {
	name: string;
	address: string;
	contactNumber?: string;
	email?: string;
	type?: HospitalType;
	latitude?: number;
	longitude?: number;
}

export type IUpdateHospitalPayload = Partial<ICreateHospitalPayload>;

export interface ICreateAmbulancePayload {
	vehicleNumber: string;
	ambulanceTypeId: string;
	status?: AmbulanceStatus;
	driverId?: string;
	currentLatitude?: number;
	currentLongitude?: number;
}

export type IUpdateAmbulancePayload = Partial<ICreateAmbulancePayload>;

export interface IUpdateDriverPayload {
	name?: string;
	contactNumber?: string;
	licenseNumber?: string;
	vehicleNumber?: string;
	ambulanceType?: string;
}

export interface IAdminListQuery {
	page?: string;
	limit?: string;
	searchTerm?: string;
	status?: string;
	priority?: string;
	type?: string;
	driverId?: string;
	ambulanceId?: string;
	date?: string;
	startDate?: string;
	endDate?: string;
	sortBy?: string;
	sortOrder?: string;
}
