import { z } from "zod";
import { EmergencyType, Priority } from "../../../generated/prisma/enums";

export const CreateEmergencyRequestZodSchema = z.object({
	patientName: z
		.string("Patient name is required")
		.min(2, "Patient name must be at least 2 characters long"),
	patientContact: z
		.string("Patient contact number is required")
		.min(5, "Contact number must be at least 5 characters long"),
	emergencyType: z.enum(
		Object.values(EmergencyType) as [EmergencyType, ...EmergencyType[]],
		"Invalid emergency type",
	),
	priority: z
		.enum(Object.values(Priority) as [Priority, ...Priority[]])
		.optional()
		.default(Priority.MEDIUM),
	pickupLocation: z
		.string("Pickup location is required")
		.min(5, "Pickup location must be at least 5 characters long")
		.max(255),
	pickupLatitude: z.number().optional(),
	pickupLongitude: z.number().optional(),
	additionalNote: z.string().max(500).optional(),
});
