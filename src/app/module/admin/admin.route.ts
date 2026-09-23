import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import {
	AssignAmbulanceZodSchema,
	ChangePriorityZodSchema,
	CreateAmbulanceZodSchema,
	CreateHospitalZodSchema,
	SelectHospitalZodSchema,
	UpdateAmbulanceZodSchema,
	UpdateDriverStatusZodSchema,
	UpdateDriverZodSchema,
	UpdateHospitalZodSchema,
} from "./admin.validation";

const router = Router();

router.use(auth(Role.ADMIN));

// Emergency Requests
router.get("/emergency-requests", AdminController.listEmergencyRequests);
router.get("/emergency-requests/:id", AdminController.getEmergencyRequest);
router.patch(
	"/emergency-requests/:id/priority",
	validateRequest(ChangePriorityZodSchema),
	AdminController.changePriority,
);
router.post(
	"/emergency-requests/:id/assign",
	validateRequest(AssignAmbulanceZodSchema),
	AdminController.assignAmbulance,
);
router.patch(
	"/emergency-requests/:id/hospital",
	validateRequest(SelectHospitalZodSchema),
	AdminController.selectHospital,
);

// Hospitals
router.post(
	"/hospitals",
	validateRequest(CreateHospitalZodSchema),
	AdminController.createHospital,
);
router.get("/hospitals", AdminController.listHospitals);
router.get("/hospitals/:id", AdminController.getHospital);
router.patch(
	"/hospitals/:id",
	validateRequest(UpdateHospitalZodSchema),
	AdminController.updateHospital,
);
router.delete("/hospitals/:id", AdminController.deleteHospital);

// Ambulances
router.post(
	"/ambulances",
	validateRequest(CreateAmbulanceZodSchema),
	AdminController.createAmbulance,
);
router.get("/ambulances", AdminController.listAmbulances);
router.get("/ambulances/:id", AdminController.getAmbulance);
router.patch(
	"/ambulances/:id",
	validateRequest(UpdateAmbulanceZodSchema),
	AdminController.updateAmbulance,
);
router.delete("/ambulances/:id", AdminController.deleteAmbulance);

// Drivers
router.get("/drivers", AdminController.listDrivers);
router.get("/drivers/:id", AdminController.getDriver);
router.patch(
	"/drivers/:id",
	validateRequest(UpdateDriverZodSchema),
	AdminController.updateDriver,
);
router.patch(
	"/drivers/:id/status",
	validateRequest(UpdateDriverStatusZodSchema),
	AdminController.updateDriverStatus,
);

// Trips
router.get("/trips", AdminController.listTrips);
router.get("/trips/:id", AdminController.getTrip);

// Dashboard & Reports
router.get("/dashboard/stats", AdminController.getDashboardStats);
router.get("/reports/trips", AdminController.getReportsTrips);
router.get("/reports/revenue", AdminController.getReportsRevenue);

export const AdminRoutes = router;
