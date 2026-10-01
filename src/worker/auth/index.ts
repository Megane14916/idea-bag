import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDb } from "../db";
import * as schema from "../db/schema";
import { authOptions } from "./options";

export class AuthConfigurationError extends Error {
	constructor() {
		super("Authentication configuration is missing or invalid");
	}
}

/** Construct per request; Cloudflare bindings must not be retained at module scope. */
export function createAuth(env: Env) {
	if (
		!env.GOOGLE_CLIENT_ID?.trim() || !env.GOOGLE_CLIENT_SECRET?.trim() ||
		!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 ||
		!env.BETTER_AUTH_URL?.trim()
	) {
		throw new AuthConfigurationError();
	}

	let baseURL: URL;
	try {
		baseURL = new URL(env.BETTER_AUTH_URL);
	} catch {
		throw new AuthConfigurationError();
	}
	if (
		!["http:", "https:"].includes(baseURL.protocol) ||
		baseURL.pathname !== "/" || baseURL.search || baseURL.hash ||
		baseURL.username || baseURL.password
	) {
		throw new AuthConfigurationError();
	}

	return betterAuth({
		...authOptions,
		baseURL: baseURL.origin,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [baseURL.origin],
		database: drizzleAdapter(createDb(env.DB), {
			provider: "sqlite",
			schema,
			// D1 does not support interactive SQL transactions.
			transaction: false,
		}),
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET,
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type AuthSession = Auth["$Infer"]["Session"];
