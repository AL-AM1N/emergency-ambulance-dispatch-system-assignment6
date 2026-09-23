import { Router } from "express";
import { PublicController } from "./public.controller";

const router = Router();

router.get("/ambulance-types", PublicController.getAmbulanceTypes);
router.get("/hospitals", PublicController.getHospitals);
router.get("/hospitals/:id", PublicController.getHospitalById);
router.get("/emergency-info", PublicController.getEmergencyInfo);

export const PublicRoutes = router;
