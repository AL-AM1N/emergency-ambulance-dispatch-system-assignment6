export const stringifyQuery = (query: object): Record<string, string> => {
	const source = query as Record<string, unknown>;
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(source)) {
		if (typeof value === "string") {
			result[key] = value;
		} else if (Array.isArray(value) && value.length > 0) {
			result[key] = String(value[0]);
		}
	}

	return result;
};
