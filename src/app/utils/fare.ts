const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const haversineDistanceKm = (
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number => {
	const dLat = toRadians(lat2 - lat1);
	const dLon = toRadians(lon2 - lon1);

	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return EARTH_RADIUS_KM * c;
};

const DEFAULT_DISTANCE_KM = 10;

export const estimateDistanceKm = (
	pickupLat?: number | null,
	pickupLon?: number | null,
	hospitalLat?: number | null,
	hospitalLon?: number | null,
): number => {
	if (
		pickupLat === null ||
		pickupLat === undefined ||
		pickupLon === null ||
		pickupLon === undefined ||
		hospitalLat === null ||
		hospitalLat === undefined ||
		hospitalLon === null ||
		hospitalLon === undefined
	) {
		return DEFAULT_DISTANCE_KM;
	}

	return haversineDistanceKm(pickupLat, pickupLon, hospitalLat, hospitalLon);
};

export const calculateFare = (
	baseFare: number,
	perKmRate: number,
	distanceKm: number,
): number => {
	const fare = baseFare + perKmRate * distanceKm;
	return Math.round(fare * 100) / 100;
};
