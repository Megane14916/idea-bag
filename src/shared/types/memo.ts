import type { Label } from "./label";

export interface Memo {
	id: string;
	title: string;
	content: string;
	sourceMemoId: string | null;
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

export interface ReorderMemosRequest {
	memoIds: string[];
}

export type ExpandedIdeaCandidate = {
	title: string;
	content: string;
};

export type ExpandIdeaResponse = {
	candidates: ExpandedIdeaCandidate[];
};

export type AcceptExpandedIdeaRequest = ExpandedIdeaCandidate;
