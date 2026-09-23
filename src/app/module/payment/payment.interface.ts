import type { PaymentMethod } from "../../../generated/prisma/enums";

export interface ICreatePaymentPayload {
	tripId: string;
	method: PaymentMethod;
}

export interface IConfirmPaymentPayload {
	paymentIntentId: string;
	tripId: string;
}
