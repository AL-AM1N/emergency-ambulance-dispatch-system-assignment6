import { z } from "zod";
import { TripStatus } from "../../../generated/prisma/enums";

export const UpdateAvailabilityZodSchema = z.object({
	isAvailable: z.boolean({ message: "isAvailable must be a boolean" }),
});

export const UpdateTripStatusZodSchema = z.object({
	status: z.enum(
		[
			TripStatus.EN_ROUTE,
			TripStatus.PICKED_UP,
			TripStatus.HOSPITAL_ARRIVED,
			TripStatus.COMPLETED,
		] as [TripStatus, ...TripStatus[]],
		{ message: "Invalid trip status" },
	),
});
