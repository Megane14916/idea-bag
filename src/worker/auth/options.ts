import type { BetterAuthOptions } from "better-auth";

// Shared by the runtime and official schema generator.
export const authOptions = {
	basePath: "/api/auth",
	emailAndPassword: { enabled: false },
	session: { cookieCache: { enabled: false } },
} satisfies BetterAuthOptions;
