import { Hono } from "hono";
import memos from "./routes/memos";
import labels from "./routes/labels";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/", (c) => c.json({ name: "Cloudflare" }));

app.route("/api/memos", memos);
app.route("/api/labels", labels);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

export default app;
