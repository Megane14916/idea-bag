/** API representation only; the authentication schema will be managed by Better Auth. */
export interface User {
	id: string;
	name: string;
	email: string;
	image: string | null;
	/** ISO 8601 UTC timestamps. */
	createdAt: string;
	updatedAt: string;
}
