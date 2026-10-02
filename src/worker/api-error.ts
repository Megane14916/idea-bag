export class ApiError extends Error {
	constructor(public status: 400 | 404 | 409 | 502, public code: string, message: string) {
		super(message);
	}
}
