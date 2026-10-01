import { createAuthClient } from "better-auth/react";

// Same-origin requests; credentials and OAuth redirects are handled by Better Auth.
export const authClient = createAuthClient({ basePath: "/api/auth" });
