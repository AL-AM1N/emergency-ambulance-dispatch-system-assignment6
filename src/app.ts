import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AdminRoutes } from "./app/module/admin/admin.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { DriverRoutes } from "./app/module/driver/driver.route";
import { PatientRoutes } from "./app/module/patient/patient.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { PublicRoutes } from "./app/module/public/public.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Stripe webhook requires the raw body for signature verification.
app.use("/api/v1/payment/webhook", express.raw({ type: "application/json" }));

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/public", PublicRoutes);
app.use("/api/v1/patient", PatientRoutes);
app.use("/api/v1/driver", DriverRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/payment", PaymentRoutes);

// Basic route
app.get("/", async (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Emergency Ambulance Dispatch System Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
