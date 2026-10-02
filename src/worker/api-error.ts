export class ApiError extends Error {
	constructor(public status: 400 | 404 | 409, public code: string, message: string) {
		super(message);
	}
}
