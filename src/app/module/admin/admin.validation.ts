import { z } from "zod";
import {
	AmbulanceStatus,
	HospitalType,
	Priority,
} from "../../../generated/prisma/enums";

export const ChangePriorityZodSchema = z.object({
	priority: z.enum(
		Object.values(Priority) as [Priority, ...Priority[]],
		"Invalid priority",
	),
});

export const AssignAmbulanceZodSchema = z.object({
	ambulanceId: z
		.string("Ambulance id is required")
		.min(1, "Ambulance id is required"),
});

export const SelectHospitalZodSchema = z.object({
	hospitalId: z
		.string("Hospital id is required")
		.min(1, "Hospital id is required"),
});

export const CreateHospitalZodSchema = z.object({
	name: z.string("Hospital name is required").min(2),
	address: z.string("Hospital address is required").min(3),
	contactNumber: z.string().optional(),
	email: z.email("Not a valid email").optional(),
	type: z
		.enum(Object.values(HospitalType) as [HospitalType, ...HospitalType[]])
		.optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
});

export const UpdateHospitalZodSchema = CreateHospitalZodSchema.partial();

export const CreateAmbulanceZodSchema = z.object({
	vehicleNumber: z
		.string("Vehicle number is required")
		.min(2, "Vehicle number must be at least 2 characters long"),
	ambulanceTypeId: z.string("Ambulance type is required").min(1),
	status: z
		.enum(
			Object.values(AmbulanceStatus) as [AmbulanceStatus, ...AmbulanceStatus[]],
		)
		.optional(),
	driverId: z.string().optional(),
	currentLatitude: z.number().optional(),
	currentLongitude: z.number().optional(),
});

export const UpdateAmbulanceZodSchema = CreateAmbulanceZodSchema.partial();

export const UpdateDriverZodSchema = z.object({
	name: z.string().min(3).optional(),
	contactNumber: z.string().optional(),
	licenseNumber: z.string().min(3).optional(),
	vehicleNumber: z.string().min(2).optional(),
	ambulanceType: z.string().optional(),
});

export const UpdateDriverStatusZodSchema = z.object({
	status: z.enum(["ACTIVE", "BLOCKED"], "Status must be ACTIVE or BLOCKED"),
});
