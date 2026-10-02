import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import type { WorkerEnv } from "../types";
import { createLabel, deleteLabel, listLabels, updateLabel } from "../services/labels";
import { labelBody, readBody, validateId } from "../validation";

const labels = new Hono<WorkerEnv>();

labels.use("*", requireAuth);

labels.get("/", async (c) => c.json(await listLabels(c.env.DB, c.get("user").id)));
labels.post("/", async (c) => {
	const { name } = labelBody(await readBody(c));
	return c.json(await createLabel(c.env.DB, c.get("user").id, name), 201);
});
labels.patch("/:id", async (c) => {
	const { name } = labelBody(await readBody(c));
	return c.json(await updateLabel(c.env.DB, c.get("user").id, validateId(c.req.param("id")), name));
});
labels.delete("/:id", async (c) => {
	await deleteLabel(c.env.DB, c.get("user").id, validateId(c.req.param("id")));
	return c.body(null, 204);
});

export default labels;
