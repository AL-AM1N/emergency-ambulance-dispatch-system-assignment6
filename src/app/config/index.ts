import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	database_url: process.env.DATABASE_URL,
	backend_url: process.env.BACKEND_URL,
	frontend_url: process.env.FRONTEND_URL,
	bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
	jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
	google_client_id: process.env.GOOGLE_CLIENT_ID!,
	admin_name: process.env.ADMIN_NAME!,
	admin_email: process.env.ADMIN_EMAIL!,
	admin_password: process.env.ADMIN_PASSWORD!,
	stripe_publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
	stripe_secret_key: process.env.STRIPE_SECRET_KEY,
	stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
};
