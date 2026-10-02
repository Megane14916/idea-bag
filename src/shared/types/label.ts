export interface Label {
	id: string;
	name: string;
}

export interface CreateLabelRequest {
	name: string;
}

export type UpdateLabelRequest = CreateLabelRequest;
