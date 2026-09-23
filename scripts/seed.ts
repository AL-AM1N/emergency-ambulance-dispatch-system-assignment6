import { prisma } from "../src/app/lib/prisma";
import { seedAdmin, seedPublicData } from "../src/app/utils/seed";

const main = async () => {
	await prisma.$connect();
	await seedAdmin();
	await seedPublicData();
	await prisma.$disconnect();
};

main().catch(async (error) => {
	console.error(error);
	process.exit(1);
});