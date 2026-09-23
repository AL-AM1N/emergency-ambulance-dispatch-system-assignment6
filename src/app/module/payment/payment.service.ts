import httpStatus from "http-status";
import {
	PaymentMethod,
	PaymentStatus,
	TripStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { stripe } from "../../lib/stripe";
import { AppError } from "../../utils/AppError";
import type {
	IConfirmPaymentPayload,
	ICreatePaymentPayload,
} from "./payment.interface";
import { markTripPaid } from "./payment.utils";

const getOwnedCompletedTrip = async (userId: string, tripId: string) => {
	const trip = await prisma.emergencyRequest.findUnique({
		where: { id: tripId },
	});

	if (!trip) {
		throw new AppError(httpStatus.NOT_FOUND, "Trip not found");
	}

	const patient = await prisma.patient.findUnique({ where: { userId } });

	if (!patient || patient.id !== trip.patientId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not authorized to pay for this trip",
		);
	}

	if (trip.status !== TripStatus.COMPLETED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment can only be made for completed trips",
		);
	}

	if (trip.fare === null || trip.fare === undefined) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Fare has not been generated for this trip yet",
		);
	}

	return trip;
};

const createPaymentIntent = async (
	userId: string,
	payload: ICreatePaymentPayload,
) => {
	const { tripId, method } = payload;

	const trip = await getOwnedCompletedTrip(userId, tripId);

	const existingPayment = await prisma.payment.findUnique({
		where: { tripId },
	});

	if (existingPayment?.status === PaymentStatus.COMPLETED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment has already been completed for this trip",
		);
	}

	let payment: {
		id: string;
		amount: number;
	} & Record<string, unknown>;

	if (existingPayment) {
		payment = { id: existingPayment.id, amount: existingPayment.amount };
	} else {
		payment = await prisma.payment.create({
			data: {
				tripId,
				userId,
				amount: trip.fare as number,
				method,
				status: PaymentStatus.PENDING,
			},
		});
	}

	if (method === PaymentMethod.STRIPE) {
		const paymentIntent = await stripe.paymentIntents.create({
			amount: Math.round(payment.amount * 100),
			currency: "usd",
			metadata: {
				tripId,
				userId,
			},
		});

		await prisma.payment.update({
			where: { id: payment.id },
			data: { stripePaymentIntentId: paymentIntent.id },
		});

		return {
			clientSecret: paymentIntent.client_secret,
			paymentId: payment.id,
			amount: payment.amount,
		};
	}

	return {
		paymentId: payment.id,
		amount: payment.amount,
		message: "Payment record created. Complete payment via SSLCommerz.",
	};
};

const confirmPayment = async (
	userId: string,
	payload: IConfirmPaymentPayload,
) => {
	const { paymentIntentId, tripId } = payload;

	await getOwnedCompletedTrip(userId, tripId);

	const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

	if (paymentIntent.status !== "succeeded") {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Payment has not been completed",
		);
	}

	await markTripPaid(tripId, paymentIntentId);

	return { success: true };
};

const handleWebhook = async (payload: Buffer, signature: string) => {
	const endpointSecret = config.stripe_webhook_secret;

	if (!endpointSecret) {
		throw new Error("Stripe webhook secret is not configured");
	}

	const event = stripe.webhooks.constructEvent(
		payload,
		signature,
		endpointSecret,
	);

	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as {
				metadata?: Record<string, string | undefined>;
				id: string;
			};
			const tripId = session.metadata?.tripId;
			const userId = session.metadata?.userId;

			if (!tripId || !userId) {
				console.log("Webhook: Missing metadata in checkout.session.completed");
				return;
			}

			await markTripPaid(tripId, session.id);

			break;
		}

		case "payment_intent.succeeded": {
			const paymentIntent = event.data.object as {
				metadata?: Record<string, string | undefined>;
				id: string;
			};
			const tripId = paymentIntent.metadata?.tripId;
			const userId = paymentIntent.metadata?.userId;

			if (!tripId || !userId) {
				console.log("Webhook: Missing metadata in payment_intent.succeeded");
				return;
			}

			await markTripPaid(tripId, paymentIntent.id);

			break;
		}

		default:
			console.log(`Webhook: Unhandled event type ${event.type}`);
			break;
	}
};

export const PaymentService = {
	createPaymentIntent,
	confirmPayment,
	handleWebhook,
};
