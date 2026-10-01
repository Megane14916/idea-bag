import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/** Create inside a request using c.env.DB; do not retain bindings at module scope. */
export function createDb(binding: Env["DB"]) {
	return drizzle(binding, { schema });
}
