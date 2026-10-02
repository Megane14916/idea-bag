import type { User } from "../../shared/types";
import { authClient } from "../lib/auth-client";
import { ApiError, notifyUnauthorized } from "./client";

export async function getCurrentUser(): Promise<User | null> {
	const result = await authClient.getSession({ query: { disableCookieCache: true } });
	if (result.error) throw new ApiError(result.error.status, result.error.code);
	const user = result.data?.user;
	return user ? {
		id: user.id, name: user.name, email: user.email, image: user.image ?? null,
		createdAt: new Date(user.createdAt).toISOString(), updatedAt: new Date(user.updatedAt).toISOString(),
	} : null;
}

export async function signInWithGoogle() {
	const result = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/?loginError=1" });
	if (result.error) throw new ApiError(result.error.status, result.error.code);
}

export async function signOut() {
	const result = await authClient.signOut();
	if (result.error) {
		notifyUnauthorized(result.error.status);
		throw new ApiError(result.error.status, result.error.code);
	}
}
