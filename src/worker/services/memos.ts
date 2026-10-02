import { and, asc, eq, exists, or, sql } from "drizzle-orm";
import type { CreateMemoRequest, Memo, UpdateMemoRequest } from "../../shared/types";
import { ApiError } from "../api-error";
import { createDb } from "../db";
import { labels, memoLabels, memos } from "../db/schema";

type Db = ReturnType<typeof createDb>;
const ownsMemo = (userId: string, id: string) => and(eq(memos.userId, userId), eq(memos.id, id));
// One JSON parameter avoids the D1 bound-parameter limit for arbitrary ID lists.
const idList = (ids: string[]) => sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`;

export async function listMemos(binding: Env["DB"], userId: string, query: { q?: string; labelId?: string } = {}, id?: string): Promise<Memo[]> {
	const db = createDb(binding);
	const conditions = [eq(memos.userId, userId)];
	if (id !== undefined) conditions.push(eq(memos.id, id));
	if (query.q) {
		// Escape SQLite LIKE metacharacters so q remains a literal substring.
		const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
		conditions.push(or(sql`${memos.title} LIKE ${pattern} ESCAPE '\\'`, sql`${memos.content} LIKE ${pattern} ESCAPE '\\'`)!);
	}
	if (query.labelId !== undefined) {
		conditions.push(exists(db.select({ id: memoLabels.memoId }).from(memoLabels)
			.innerJoin(labels, eq(labels.id, memoLabels.labelId))
			.where(and(eq(memoLabels.memoId, memos.id), eq(labels.id, query.labelId), eq(labels.userId, userId)))));
	}
	const rows = await db.select({ memo: memos, label: { id: labels.id, name: labels.name } }).from(memos)
		.leftJoin(memoLabels, eq(memoLabels.memoId, memos.id))
		.leftJoin(labels, and(eq(labels.id, memoLabels.labelId), eq(labels.userId, userId)))
		.where(and(...conditions)).orderBy(asc(memos.orderIndex), asc(memos.id), asc(labels.name), asc(labels.id));
	const result = new Map<string, Memo>();
	for (const { memo, label } of rows) {
		let value = result.get(memo.id);
		if (!value) {
			value = { id: memo.id, title: memo.title, content: memo.content, order: memo.orderIndex,
				createdAt: memo.createdAt, updatedAt: memo.updatedAt, labels: [] };
			result.set(memo.id, value);
		}
		if (label) value.labels.push(label);
	}
	return [...result.values()];
}

export async function getMemo(binding: Env["DB"], userId: string, id: string): Promise<Memo> {
	const memo = (await listMemos(binding, userId, {}, id))[0];
	if (!memo) throw new ApiError(404, "MEMO_NOT_FOUND", "Memo not found");
	return memo;
}

async function validateLabels(db: Db, userId: string, ids: string[]): Promise<void> {
	if (!ids.length) return;
	const owned = await db.select({ id: labels.id }).from(labels)
		.where(and(eq(labels.userId, userId), sql`${labels.id} IN ${idList(ids)}`));
	if (owned.length !== ids.length) throw new ApiError(404, "LABEL_NOT_FOUND", "Label not found");
}

function associations(db: Db, userId: string, id: string, ids: string[]) {
	// Insert requested IDs directly: if a label was concurrently deleted, FK failure
	// rolls back the whole batch instead of silently dropping part of the request.
	return db.insert(memoLabels).select(db.select({
		memoId: sql<string>`${id}`.as("memo_id"),
		labelId: sql<string>`value`.as("label_id"),
	}).from(sql`json_each(${JSON.stringify(ids)})`)
		.where(exists(db.select({ id: memos.id }).from(memos).where(ownsMemo(userId, id)))));
}

export async function createMemo(binding: Env["DB"], userId: string, body: CreateMemoRequest): Promise<Memo> {
	const db = createDb(binding);
	const labelIds = body.labelIds ?? [];
	await validateLabels(db, userId, labelIds);
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const insert = db.insert(memos).values({ id, userId, title: body.title, content: body.content,
		orderIndex: sql`(SELECT coalesce(max(order_index), -1) + 1 FROM memos WHERE user_id = ${userId})`,
		createdAt: now, updatedAt: now });
	await db.batch([insert, associations(db, userId, id, labelIds)]);
	return getMemo(binding, userId, id);
}

export async function updateMemo(binding: Env["DB"], userId: string, id: string, body: UpdateMemoRequest): Promise<Memo> {
	const db = createDb(binding);
	await getMemo(binding, userId, id);
	if (body.labelIds !== undefined) await validateLabels(db, userId, body.labelIds);
	const update = db.update(memos).set({ title: body.title, content: body.content, updatedAt: new Date().toISOString() })
		.where(ownsMemo(userId, id));
	if (body.labelIds === undefined) await update;
	else await db.batch([update,
		db.delete(memoLabels).where(and(eq(memoLabels.memoId, id),
			exists(db.select({ id: memos.id }).from(memos).where(ownsMemo(userId, id))))),
		associations(db, userId, id, body.labelIds)]);
	return getMemo(binding, userId, id);
}

export async function deleteMemo(binding: Env["DB"], userId: string, id: string): Promise<void> {
	const removed = await createDb(binding).delete(memos).where(ownsMemo(userId, id)).returning({ id: memos.id });
	if (!removed.length) throw new ApiError(404, "MEMO_NOT_FOUND", "Memo not found");
}

export async function reorderMemos(binding: Env["DB"], userId: string, ids: string[]): Promise<void> {
	const db = createDb(binding);
	const current = await db.select({ id: memos.id }).from(memos).where(eq(memos.userId, userId));
	const owned = new Set(current.map((memo) => memo.id));
	if (ids.length !== current.length || ids.some((id) => !owned.has(id))) {
		throw new ApiError(400, "VALIDATION_ERROR", "memoIds must contain all of your memos exactly once");
	}
	if (!ids.length) return;
	// One UPDATE is atomic. Recheck the complete set within the write so a
	// concurrent create/delete produces a conflict instead of a partial reorder.
	const updated = await db.update(memos).set({
		orderIndex: sql`(SELECT CAST(key AS INTEGER) FROM json_each(${JSON.stringify(ids)}) WHERE value = memos.id)`,
		updatedAt: new Date().toISOString(),
	}).where(and(eq(memos.userId, userId),
		sql`(SELECT count(*) FROM memos WHERE user_id = ${userId}) = ${ids.length}`,
		sql`NOT EXISTS (SELECT 1 FROM memos WHERE user_id = ${userId} AND id NOT IN ${idList(ids)})`
	)).returning({ id: memos.id });
	if (updated.length !== ids.length) throw new ApiError(409, "MEMO_ORDER_CONFLICT", "Memo list changed; reload and retry");
}
