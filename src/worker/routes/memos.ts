import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import type { WorkerEnv } from "../types";
import { createMemo, deleteMemo, getMemo, listMemos, reorderMemos, updateMemo } from "../services/memos";
import { memoBody, memoQuery, readBody, reorderBody, validateId } from "../validation";

const memos = new Hono<WorkerEnv>();

memos.use("*", requireAuth);

memos.get("/", async (c) => c.json(await listMemos(c.env.DB, c.get("user").id, memoQuery(c))));
memos.post("/", async (c) => c.json(await createMemo(c.env.DB, c.get("user").id,
	memoBody(await readBody(c), false)), 201));

// Register the static path before /:id.
memos.patch("/order", async (c) => {
	const { memoIds } = reorderBody(await readBody(c));
	await reorderMemos(c.env.DB, c.get("user").id, memoIds);
	return c.body(null, 204);
});
memos.get("/:id", async (c) => c.json(await getMemo(c.env.DB, c.get("user").id, validateId(c.req.param("id")))));
memos.patch("/:id", async (c) => c.json(await updateMemo(c.env.DB, c.get("user").id,
	validateId(c.req.param("id")), memoBody(await readBody(c), true))));
memos.delete("/:id", async (c) => {
	await deleteMemo(c.env.DB, c.get("user").id, validateId(c.req.param("id")));
	return c.body(null, 204);
});

export default memos;
