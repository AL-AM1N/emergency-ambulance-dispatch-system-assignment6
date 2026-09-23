import Stripe from "stripe";
import config from "../config";

const getStripeInstance = (): Stripe => {
	if (!config.stripe_secret_key) {
		throw new Error(
			"Stripe secret key is not configured in environment variables",
		);
	}
	return new Stripe(config.stripe_secret_key);
};

export const stripe = new Proxy({} as Stripe, {
	get(_, prop) {
		return getStripeInstance()[prop as keyof Stripe];
	},
});
