import { betterAuth } from "better-auth/minimal";
import { authOptions } from "./options";

// CLI only: --adapter drizzle --dialect sqlite generates without a DB or secrets.
// The Worker uses createAuth(env) instead of this instance.
export const auth = betterAuth({ ...authOptions, baseURL: "http://localhost:5173" });
