import type { TripStatus } from "../../../generated/prisma/enums";

export interface IUpdateAvailabilityPayload {
	isAvailable: boolean;
}

export interface IUpdateTripStatusPayload {
	status: TripStatus;
}

export interface IDriverTripListQuery {
	page?: string;
	limit?: string;
	status?: string;
	sortBy?: string;
	sortOrder?: string;
}
