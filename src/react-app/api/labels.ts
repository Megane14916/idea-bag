import type { CreateLabelRequest, Label, UpdateLabelRequest } from "../../shared/types";
import { request } from "./client";

export const getLabels = (signal?: AbortSignal) => request<Label[]>("/api/labels", { signal });
export const createLabel = (body: CreateLabelRequest) => request<Label>("/api/labels", { method: "POST", body: JSON.stringify(body) });
export const updateLabel = (id: string, body: UpdateLabelRequest) => request<Label>(`/api/labels/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteLabel = (id: string) => request<void>(`/api/labels/${encodeURIComponent(id)}`, { method: "DELETE" });
