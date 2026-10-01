import { getSessionCookie } from "better-auth/cookies";
import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";
import type { WorkerEnv } from "../types";

export const requireAuth = createMiddleware<WorkerEnv>(async (c, next) => {
	c.header("Cache-Control", "no-store");
	const unauthorized = () => c.json({
		error: { code: "UNAUTHORIZED", message: "Authentication required" },
	}, 401);

	// Anonymous requests need no auth configuration or database access.
	if (!getSessionCookie(c.req.raw)) return unauthorized();

	const { response: currentSession, headers } = await createAuth(c.env).api.getSession({
		headers: c.req.raw.headers,
		returnHeaders: true,
	});
	// Keep session refresh / cookie deletion headers produced by Better Auth.
	for (const cookie of headers.getSetCookie()) {
		c.header("Set-Cookie", cookie, { append: true });
	}
	if (!currentSession) return unauthorized();

	c.set("user", currentSession.user);
	c.set("session", currentSession.session);
	await next();
});
