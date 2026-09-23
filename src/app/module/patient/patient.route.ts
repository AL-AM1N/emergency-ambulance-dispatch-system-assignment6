import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PatientController } from "./patient.controller";
import { CreateEmergencyRequestZodSchema } from "./patient.validation";

const router = Router();

router.use(auth(Role.PATIENT));

router.post(
	"/emergency-requests",
	validateRequest(CreateEmergencyRequestZodSchema),
	PatientController.createEmergencyRequest,
);

router.get("/emergency-requests", PatientController.myEmergencyRequests);

router.get("/emergency-requests/:id", PatientController.getEmergencyRequest);

router.patch(
	"/emergency-requests/:id/cancel",
	PatientController.cancelEmergencyRequest,
);

router.get("/trips", PatientController.myTrips);

router.get("/trips/:id", PatientController.getTripById);

router.get("/notifications", PatientController.notifications);

router.patch("/notifications/:id/read", PatientController.markNotificationRead);

export const PatientRoutes = router;
