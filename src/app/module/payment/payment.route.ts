import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import {
	ConfirmPaymentZodSchema,
	CreatePaymentZodSchema,
} from "./payment.validation";

const router = Router();

router.post("/webhook", PaymentController.handleWebhook);

router.post(
	"/create",
	auth(Role.PATIENT),
	validateRequest(CreatePaymentZodSchema),
	PaymentController.createPaymentIntent,
);

router.post(
	"/confirm",
	auth(Role.PATIENT),
	validateRequest(ConfirmPaymentZodSchema),
	PaymentController.confirmPayment,
);

export const PaymentRoutes = router;
