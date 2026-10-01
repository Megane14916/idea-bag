import type { Label } from "./label";

export interface Memo {
	id: string;
	title: string;
	content: string;
	order: number;
	labels: Label[];
	/** ISO 8601 UTC timestamp serialized for the API. */
	createdAt: string;
	updatedAt: string;
}

export interface CreateMemoRequest {
	title: string;
	content: string;
	labelIds?: string[];
}

export type UpdateMemoRequest = Partial<CreateMemoRequest>;
