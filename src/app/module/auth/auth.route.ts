import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register/patient",
	validateRequest(AuthValidation.PatientRegistrationZodSchema),
	AuthController.registerPatient,
);

router.post(
	"/register/driver",
	validateRequest(AuthValidation.DriverRegistrationZodSchema),
	AuthController.registerDriver,
);

router.post(
	"/login",
	validateRequest(AuthValidation.LoginZodSchema),
	AuthController.loginUser,
);

router.post(
	"/google",
	validateRequest(AuthValidation.GoogleLoginZodSchema),
	AuthController.googleLogin,
);

router.get(
	"/me",
	auth(Role.ADMIN, Role.DRIVER, Role.PATIENT),
	AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/logout", AuthController.logout);

export const AuthRoutes = router;
