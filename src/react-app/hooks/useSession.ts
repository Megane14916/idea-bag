import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "../../shared/types";
import { getCurrentUser, signOut } from "../api/auth";
import { ApiError, getErrorMessage, SESSION_EXPIRED_EVENT } from "../api/client";

type SessionState =
	| { status: "loading"; user: null }
	| { status: "authenticated"; user: User }
	| { status: "unauthenticated"; user: null };

export function useSession() {
	const [session, setSession] = useState<SessionState>({ status: "loading", user: null });
	const [error, setError] = useState("");
	const [checking, setChecking] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	const generation = useRef(0);
	const logoutLock = useRef(false);

	const refresh = useCallback(async () => {
		const current = ++generation.current;
		setChecking(true);
		try {
			const user = await getCurrentUser();
			if (current !== generation.current) return;
			setSession(user ? { status: "authenticated", user } : { status: "unauthenticated", user: null });
			setError("");
		} catch (cause) {
			if (current !== generation.current) return;
			if (cause instanceof ApiError && cause.status === 401) {
				setSession({ status: "unauthenticated", user: null });
			} else setError(getErrorMessage(cause));
		} finally {
			if (current === generation.current) setChecking(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
		const lifecycle = generation;
		const recheck = () => { void refresh(); };
		window.addEventListener(SESSION_EXPIRED_EVENT, recheck);
		window.addEventListener("focus", recheck);
		return () => {
			lifecycle.current++;
			window.removeEventListener(SESSION_EXPIRED_EVENT, recheck);
			window.removeEventListener("focus", recheck);
		};
	}, [refresh]);

	const logout = async () => {
		if (logoutLock.current) return;
		logoutLock.current = true;
		setLoggingOut(true);
		setError("");
		try {
			await signOut();
			generation.current++;
			setSession({ status: "unauthenticated", user: null });
		} catch (cause) { setError(getErrorMessage(cause)); }
		finally { logoutLock.current = false; setLoggingOut(false); }
	};

	return { ...session, error, checking, loggingOut, refresh, logout };
}
