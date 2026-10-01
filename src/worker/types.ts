import type { AuthSession } from "./auth";

export type WorkerEnv = {
	Bindings: Env;
	Variables: {
		user: AuthSession["user"];
		session: AuthSession["session"];
	};
};
