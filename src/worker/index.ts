import { Hono } from "hono";
import { ApiError } from "./api-error";
import type { User } from "../shared/types";
import { AuthConfigurationError, createAuth } from "./auth";
import { requireAuth } from "./middleware/auth";
import memos from "./routes/memos";
import labels from "./routes/labels";
import type { WorkerEnv } from "./types";

const app = new Hono<WorkerEnv>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));
app.all("/api/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

app.get("/api/me", requireAuth, (c) => {
	const user = c.get("user");
	const response: User = {
		id: user.id,
		name: user.name,
		email: user.email,
		image: user.image ?? null,
		createdAt: user.createdAt.toISOString(),
		updatedAt: user.updatedAt.toISOString(),
	};
	return c.json(response);
});

app.route("/api/memos", memos);
app.route("/api/labels", labels);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));
app.onError((error, c) => {
	if (error instanceof ApiError) {
		return c.json({ error: { code: error.code, message: error.message } }, error.status);
	}
	if (error instanceof AuthConfigurationError) {
		return c.json({ error: { code: "AUTH_NOT_CONFIGURED", message: error.message } }, 503);
	}
	console.error(error);
	return c.json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } }, 500);
});

export default app;
