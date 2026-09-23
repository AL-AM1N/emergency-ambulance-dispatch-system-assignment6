import type { EmergencyType, Priority } from "../../../generated/prisma/enums";

export interface ICreateEmergencyRequestPayload {
	patientName: string;
	patientContact: string;
	emergencyType: EmergencyType;
	priority?: Priority;
	pickupLocation: string;
	pickupLatitude?: number;
	pickupLongitude?: number;
	additionalNote?: string;
}

export interface ITripListQuery {
	page?: string;
	limit?: string;
	status?: string;
	sortBy?: string;
	sortOrder?: string;
}
