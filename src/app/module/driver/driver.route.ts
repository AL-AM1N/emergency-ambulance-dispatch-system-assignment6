import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DriverController } from "./driver.controller";
import {
	UpdateAvailabilityZodSchema,
	UpdateTripStatusZodSchema,
} from "./driver.validation";

const router = Router();

router.use(auth(Role.DRIVER));

router.get("/profile", DriverController.getProfile);

router.patch(
	"/availability",
	validateRequest(UpdateAvailabilityZodSchema),
	DriverController.updateAvailability,
);

router.get("/trips/current", DriverController.getCurrentTrip);

router.get("/trips", DriverController.myTrips);

router.get("/trips/:id", DriverController.getTripById);

router.post("/trips/:id/accept", DriverController.acceptTrip);

router.patch(
	"/trips/:id/status",
	validateRequest(UpdateTripStatusZodSchema),
	DriverController.updateTripStatus,
);

router.get("/notifications", DriverController.notifications);

router.patch("/notifications/:id/read", DriverController.markNotificationRead);

export const DriverRoutes = router;
