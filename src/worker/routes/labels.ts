import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import type { WorkerEnv } from "../types";

const labels = new Hono<WorkerEnv>();

labels.use("*", requireAuth);

labels.get("/", (c) => c.json({ message: "Not implemented" }, 501));
labels.post("/", (c) => c.json({ message: "Not implemented" }, 501));
labels.patch("/:id", (c) => c.json({ message: "Not implemented" }, 501));
labels.delete("/:id", (c) => c.json({ message: "Not implemented" }, 501));

export default labels;
