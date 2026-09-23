import bcrypt from "bcryptjs";
import httpStatus from "http-status";
import { HospitalType, Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "./AppError";

export const seedAdmin = async () => {
	try {
		const isAdminExist = await prisma.user.findFirst({
			where: { role: Role.ADMIN },
		});

		if (isAdminExist) {
			console.log("Admin Already Exists!");
			return;
		}

		const name = config.admin_name;
		const email = config.admin_email;
		const password = config.admin_password;

		if (!name || !email || !password) {
			throw new AppError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Admin Name, Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const admin = await prisma.user.create({
			data: {
				name,
				email: email.trim().toLowerCase(),
				password: hashedPassword,
				role: Role.ADMIN,
				emailVerified: true,
				needPasswordChange: false,
			},
			omit: { password: true },
		});

		console.log("Admin Created : ", admin);
	} catch (error) {
		console.log("Error Seeding Admin : ", error);
	}
};

const DEFAULT_AMBULANCE_TYPES = [
	{
		name: "Basic Life Support (BLS)",
		description:
			"Standard ambulance with basic life support equipment for non-critical transport.",
		baseFare: 15,
		perKmRate: 1.2,
		capacity: 1,
	},
	{
		name: "Advanced Life Support (ALS)",
		description:
			"Fully equipped ambulance with paramedics, defibrillator and advanced monitoring.",
		baseFare: 25,
		perKmRate: 2,
		capacity: 1,
	},
	{
		name: "Patient Transport",
		description:
			"Comfortable transport for patients who are medically stable but need assistance.",
		baseFare: 10,
		perKmRate: 0.8,
		capacity: 2,
	},
	{
		name: "Neonatal Ambulance",
		description:
			"Specialised ambulance with neonatal intensive care equipment and trained staff.",
		baseFare: 35,
		perKmRate: 2.5,
		capacity: 1,
	},
];

const DEFAULT_HOSPITALS = [
	{
		name: "City General Hospital",
		address: "12 Greenway Avenue, City Center",
		contactNumber: "+1-555-0100",
		email: "contact@citygeneral.example.com",
		type: HospitalType.GENERAL,
		latitude: 23.8103,
		longitude: 90.4125,
	},
	{
		name: "Metropolitan Emergency & Trauma Center",
		address: "45 Riverside Road, Downtown",
		contactNumber: "+1-555-0123",
		email: "er@metro-trauma.example.com",
		type: HospitalType.TRAUMA,
		latitude: 23.7805,
		longitude: 90.3986,
	},
	{
		name: "St. Mary's Specialised Hospital",
		address: "88 Hill Crest, Uptown",
		contactNumber: "+1-555-0145",
		email: "info@stmarys.example.com",
		type: HospitalType.SPECIALIZED,
		latitude: 23.7468,
		longitude: 90.3758,
	},
];

const DEFAULT_EMERGENCY_CONTACTS = [
	{
		name: "National Emergency Hotline",
		phone: "112",
		type: "GENERAL",
		description: "Universal emergency number for all emergency services.",
	},
	{
		name: "Ambulance Service",
		phone: "199",
		type: "AMBULANCE",
		description:
			"Request an ambulance directly in case of a medical emergency.",
	},
	{
		name: "Police Emergency",
		phone: "911",
		type: "POLICE",
		description: "Report crimes or security emergencies to the police.",
	},
	{
		name: "Fire Service",
		phone: "109",
		type: "FIRE",
		description: "Report fire and rescue emergencies.",
	},
];

export const seedAmbulanceTypes = async () => {
	const existing = await prisma.ambulanceType.count();
	if (existing > 0) {
		console.log("Ambulance Types Already Seeded!");
		return;
	}

	await prisma.ambulanceType.createMany({
		data: DEFAULT_AMBULANCE_TYPES,
		skipDuplicates: true,
	});

	console.log("Ambulance Types Seeded!");
};

export const seedHospitals = async () => {
	const existing = await prisma.hospital.count();
	if (existing > 0) {
		console.log("Hospitals Already Seeded!");
		return;
	}

	await prisma.hospital.createMany({
		data: DEFAULT_HOSPITALS,
		skipDuplicates: true,
	});

	console.log("Hospitals Seeded!");
};

export const seedEmergencyContacts = async () => {
	const existing = await prisma.emergencyContact.count();
	if (existing > 0) {
		console.log("Emergency Contacts Already Seeded!");
		return;
	}

	await prisma.emergencyContact.createMany({
		data: DEFAULT_EMERGENCY_CONTACTS,
		skipDuplicates: true,
	});

	console.log("Emergency Contacts Seeded!");
};

export const seedPublicData = async () => {
	await seedAmbulanceTypes();
	await seedHospitals();
	await seedEmergencyContacts();
};
