import { asc, eq, and, sql } from "drizzle-orm";
import type { Label } from "../../shared/types";
import { ApiError } from "../api-error";
import { createDb } from "../db";
import { labels } from "../db/schema";

export function listLabels(binding: Env["DB"], userId: string): Promise<Label[]> {
	return createDb(binding).select({ id: labels.id, name: labels.name }).from(labels)
		.where(eq(labels.userId, userId)).orderBy(asc(labels.name), asc(labels.id));
}

export async function createLabel(binding: Env["DB"], userId: string, name: string): Promise<Label> {
	const db = createDb(binding);
	const now = new Date().toISOString();
	// A single conditional write prevents duplicate names even with concurrent requests.
	const result = await db.get<Label>(sql`
		INSERT INTO labels (id, user_id, name, created_at, updated_at)
		SELECT ${crypto.randomUUID()}, ${userId}, ${name}, ${now}, ${now}
		WHERE NOT EXISTS (SELECT 1 FROM labels WHERE user_id = ${userId} AND name = ${name})
		RETURNING id, name`);
	if (!result) throw new ApiError(409, "DUPLICATE_LABEL", "Label name already exists");
	return result;
}

export async function updateLabel(binding: Env["DB"], userId: string, id: string, name: string): Promise<Label> {
	const db = createDb(binding);
	const own = and(eq(labels.id, id), eq(labels.userId, userId));
	if (!(await db.select({ id: labels.id }).from(labels).where(own))[0]) {
		throw new ApiError(404, "LABEL_NOT_FOUND", "Label not found");
	}
	const result = await db.get<Label>(sql`
		UPDATE labels SET name = ${name}, updated_at = ${new Date().toISOString()}
		WHERE id = ${id} AND user_id = ${userId}
		AND NOT EXISTS (SELECT 1 FROM labels WHERE user_id = ${userId} AND name = ${name} AND id <> ${id})
		RETURNING id, name`);
	if (!result) {
		if (!(await db.select({ id: labels.id }).from(labels).where(own))[0]) {
			throw new ApiError(404, "LABEL_NOT_FOUND", "Label not found");
		}
		throw new ApiError(409, "DUPLICATE_LABEL", "Label name already exists");
	}
	return result;
}

export async function deleteLabel(binding: Env["DB"], userId: string, id: string): Promise<void> {
	const removed = await createDb(binding).delete(labels)
		.where(and(eq(labels.id, id), eq(labels.userId, userId))).returning({ id: labels.id });
	if (!removed.length) throw new ApiError(404, "LABEL_NOT_FOUND", "Label not found");
	// Existing ON DELETE CASCADE removes only the associations, leaving memos intact.
}
