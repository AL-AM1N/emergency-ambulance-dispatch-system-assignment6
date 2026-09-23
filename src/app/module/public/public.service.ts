import httpStatus from "http-status";
import type { HospitalType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type { IHospitalListQuery } from "./public.interface";

const getAmbulanceTypes = async () => {
	return prisma.ambulanceType.findMany({
		where: { isActive: true },
		orderBy: { name: "asc" },
	});
};

const getHospitals = async (query: IHospitalListQuery) => {
	const where = {
		isActive: true,
		isDeleted: false,
		...(query.type ? { type: query.type as HospitalType } : {}),
	};

	return prisma.hospital.findMany({
		where,
		orderBy: { name: "asc" },
	});
};

const getHospitalById = async (id: string) => {
	const hospital = await prisma.hospital.findFirst({
		where: { id, isActive: true, isDeleted: false },
	});

	if (!hospital) {
		throw new AppError(httpStatus.NOT_FOUND, "Hospital not found");
	}

	return hospital;
};

const getEmergencyInfo = async () => {
	const contacts = await prisma.emergencyContact.findMany({
		where: { isActive: true },
		orderBy: { type: "asc" },
	});

	return {
		contacts,
		system: {
			name: "Emergency Ambulance Dispatch System",
			version: "1.0.0",
			description:
				"On-demand emergency ambulance dispatch platform connecting patients, drivers and dispatchers.",
			howItWorks: [
				"Create an emergency request with your pickup location and emergency type.",
				"A dispatcher checks the priority and assigns the nearest available ambulance.",
				"The assigned driver accepts, travels to you and transports you to the selected hospital.",
				"After the trip is completed, you pay the generated fare securely via Stripe.",
			],
		},
		safetyGuidelines: [
			"Stay calm and provide accurate patient information.",
			"Keep your location details clear for easier pickup.",
			"For life-threatening emergencies always call the national emergency hotline first.",
		],
	};
};

export const PublicService = {
	getAmbulanceTypes,
	getHospitals,
	getHospitalById,
	getEmergencyInfo,
};
