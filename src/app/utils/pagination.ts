import type { IQuery } from "../interfaces";

export type TPaginationOptions = {
	page: number;
	limit: number;
	skip: number;
	sortBy: string;
	sortOrder: "asc" | "desc";
};

const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_SORT_ORDER: "asc" | "desc" = "desc";
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const toPositiveInt = (value: unknown, fallback: number) => {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSortOrder = (value: unknown): "asc" | "desc" =>
	value === "asc" ? "asc" : "desc";

export const paginationHelper = {
	calculatePagination(options: IQuery): TPaginationOptions {
		const page = toPositiveInt(options.page, DEFAULT_PAGE);
		const requestedLimit = toPositiveInt(options.limit, DEFAULT_LIMIT);
		const limit = Math.min(requestedLimit, MAX_LIMIT);
		const skip = (page - 1) * limit;

		return {
			page,
			limit,
			skip,
			sortBy: options.sortBy || DEFAULT_SORT_BY,
			sortOrder: normalizeSortOrder(options.sortOrder || DEFAULT_SORT_ORDER),
		};
	},

	calculateMeta(total: number, page: number, limit: number) {
		return {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		};
	},

	buildDateRange(date?: string) {
		if (!date) {
			return null;
		}

		const parsed = new Date(date);
		if (Number.isNaN(parsed.getTime())) {
			return null;
		}

		const start = new Date(parsed);
		start.setHours(0, 0, 0, 0);

		const end = new Date(parsed);
		end.setHours(23, 59, 59, 999);

		return { start, end };
	},
};
