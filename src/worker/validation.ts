import type { Context } from "hono";
import type { AcceptExpandedIdeaRequest, CreateMemoRequest, UpdateMemoRequest, ReorderMemosRequest, CreateLabelRequest } from "../shared/types";
import { ApiError } from "./api-error";
import type { WorkerEnv } from "./types";

function invalid(message: string): never {
	throw new ApiError(400, "VALIDATION_ERROR", message);
}

export function validateId(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) invalid("IDs must be non-empty strings");
	return value;
}

function ids(value: unknown, field: string): string[] {
	if (!Array.isArray(value)) invalid(`${field} must be a string array`);
	const result = value.map(validateId);
	if (new Set(result).size !== result.length) invalid(`${field} must not contain duplicate IDs`);
	return result;
}

export async function readBody(c: Context<WorkerEnv>): Promise<Record<string, unknown>> {
	let body: unknown;
	try { body = await c.req.json(); } catch { invalid("Invalid JSON body"); }
	if (!body || typeof body !== "object" || Array.isArray(body)) invalid("Body must be a JSON object");
	return body as Record<string, unknown>;
}

export function memoBody(body: Record<string, unknown>, partial: false): CreateMemoRequest;
export function memoBody(body: Record<string, unknown>, partial: true): UpdateMemoRequest;
export function memoBody(body: Record<string, unknown>, partial: boolean): UpdateMemoRequest {
	const result: UpdateMemoRequest = {};
	for (const field of ["title", "content"] as const) {
		if (!partial || field in body) {
			const value = body[field];
			if (typeof value !== "string") invalid(`${field} must be a string`);
			result[field] = value;
		}
	}
	if ("labelIds" in body) result.labelIds = ids(body.labelIds, "labelIds");
	return result;
}

export function reorderBody(body: Record<string, unknown>): ReorderMemosRequest {
	return { memoIds: ids(body.memoIds, "memoIds") };
}

export function acceptExpandedIdeaBody(body: Record<string, unknown>): AcceptExpandedIdeaRequest {
	for (const field of ["title", "content"] as const) {
		if (typeof body[field] !== "string" || !body[field].trim()) {
			invalid(`${field} must be a non-empty string`);
		}
	}
	return { title: (body.title as string).trim(), content: (body.content as string).trim() };
}

export function labelBody(body: Record<string, unknown>): CreateLabelRequest {
	if (typeof body.name !== "string" || !body.name.trim()) invalid("name must be a non-empty string");
	return { name: body.name.trim() };
}

export function memoQuery(c: Context<WorkerEnv>): { q?: string; labelId?: string } {
	const result: { q?: string; labelId?: string } = {};
	for (const field of ["q", "labelId"] as const) {
		const values = c.req.queries(field);
		if (values && values.length !== 1) invalid(`${field} must be specified once`);
		if (values) result[field] = field === "labelId" ? validateId(values[0]) : values[0];
	}
	return result;
}
