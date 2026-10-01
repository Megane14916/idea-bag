import { defineConfig } from "drizzle-kit";

// Generate SQL without credentials; Wrangler applies migrations to local/remote D1.
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/worker/db/schema.ts",
	out: "./drizzle",
});
