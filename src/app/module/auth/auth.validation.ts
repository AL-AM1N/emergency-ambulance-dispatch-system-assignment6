import z from "zod";

const passwordSchema = z
	.string()
	.min(8, "Password Must Minimum 8 Characters Long.")
	.regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
	.regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")
	.regex(/[0-9]/, "Password must contain atleast 1 Number")
	.regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character");

const PatientRegistrationZodSchema = z.object({
	name: z
		.string("Name must be a string")
		.min(3, "Name must atleast 3 characters long")
		.max(100, "Name must not exceed 100 characters"),
	email: z.email("Not a valid email"),
	password: passwordSchema,
	patient: z
		.object({
			contactNumber: z.string().optional(),
			address: z.string().optional(),
		})
		.optional(),
});

const DriverRegistrationZodSchema = z.object({
	name: z
		.string("Name must be a string")
		.min(3, "Name must atleast 3 characters long")
		.max(100, "Name must not exceed 100 characters"),
	email: z.email("Not a valid email"),
	password: passwordSchema,
	contactNumber: z.string().optional(),
	licenseNumber: z
		.string("License number must be a string")
		.min(3, "License number must atleast 3 characters long"),
	vehicleNumber: z
		.string("Vehicle number must be a string")
		.min(2, "Vehicle number must atleast 2 characters long"),
	ambulanceType: z.string().optional(),
});

const LoginZodSchema = z.object({
	email: z.email("Not a valid email"),
	password: z.string("Password is required").min(1, "Password is required"),
});

const GoogleLoginZodSchema = z.object({
	idToken: z.string("Google idToken is required").min(1, "idToken is required"),
});

export const AuthValidation = {
	PatientRegistrationZodSchema,
	DriverRegistrationZodSchema,
	LoginZodSchema,
	GoogleLoginZodSchema,
};
