import type { AcceptExpandedIdeaRequest, CreateMemoRequest, ExpandIdeaResponse, Memo, ReorderMemosRequest, UpdateMemoRequest } from "../../shared/types";
import { request } from "./client";

export function getMemos(query: { q?: string; labelId?: string } = {}, signal?: AbortSignal) {
	const params = new URLSearchParams();
	if (query.q) params.set("q", query.q);
	if (query.labelId) params.set("labelId", query.labelId);
	return request<Memo[]>(`/api/memos${params.size ? `?${params}` : ""}`, { signal });
}

const memoPath = (id: string) => `/api/memos/${encodeURIComponent(id)}`;
export const createMemo = (body: CreateMemoRequest) => request<Memo>("/api/memos", { method: "POST", body: JSON.stringify(body) });
export const updateMemo = (id: string, body: UpdateMemoRequest) => request<Memo>(memoPath(id), { method: "PATCH", body: JSON.stringify(body) });
export const deleteMemo = (id: string) => request<void>(memoPath(id), { method: "DELETE" });
export const reorderMemos = (body: ReorderMemosRequest) => request<void>("/api/memos/order", { method: "PATCH", body: JSON.stringify(body) });
export const expandMemo = (id: string, signal?: AbortSignal) => request<ExpandIdeaResponse>(`${memoPath(id)}/expand`, { method: "POST", signal });
export const acceptExpandedMemo = (id: string, body: AcceptExpandedIdeaRequest) => request<Memo>(`${memoPath(id)}/expand/accept`, { method: "POST", body: JSON.stringify(body) });
