import { prisma } from "../lib/prisma";

export const createNotification = (
	userId: string,
	title: string,
	message: string,
) => {
	return prisma.notification.create({
		data: {
			userId,
			title,
			message,
		},
	});
};
