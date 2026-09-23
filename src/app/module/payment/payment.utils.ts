import { PaymentStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

export const markTripPaid = async (tripId: string, transactionId: string) => {
	const payment = await prisma.payment.findUnique({
		where: { tripId },
		select: { status: true },
	});

	if (!payment) {
		throw new Error("Payment record not found");
	}

	if (payment.status === PaymentStatus.COMPLETED) {
		return false;
	}

	await prisma.$transaction(async (tx) => {
		await tx.payment.updateMany({
			where: { tripId, status: { not: PaymentStatus.COMPLETED } },
			data: {
				status: PaymentStatus.COMPLETED,
				transactionId,
				paidAt: new Date(),
			},
		});
	});

	return true;
};
