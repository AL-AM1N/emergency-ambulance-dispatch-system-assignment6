import { z } from "zod";
import { PaymentMethod } from "../../../generated/prisma/enums";

export const CreatePaymentZodSchema = z.object({
	tripId: z.string("Trip id is required").min(1, "Trip id is required"),
	method: z
		.enum(Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]])
		.optional()
		.default(PaymentMethod.STRIPE),
});

export const ConfirmPaymentZodSchema = z.object({
	paymentIntentId: z
		.string("Payment intent id is required")
		.min(1, "Payment intent id is required"),
	tripId: z.string("Trip id is required").min(1, "Trip id is required"),
});
