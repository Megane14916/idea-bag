import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../api/client";

/** Abort obsolete reads, and keep prior data visible during background refreshes. */
export function useCollection<T>(load: (signal: AbortSignal) => Promise<T[]>) {
	const [data, setData] = useState<T[]>([]);
	const [revision, setRevision] = useState(0);
	const [completed, setCompleted] = useState<{ load: typeof load | null; revision: number; error: string }>({ load: null, revision: -1, error: "" });
	const active = useRef<AbortController | null>(null);
	const refresh = useCallback(() => {
		active.current?.abort();
		setRevision(value => value + 1);
	}, []);
	useEffect(() => {
		const controller = new AbortController();
		active.current = controller;
		load(controller.signal).then(value => {
			if (!controller.signal.aborted) {
				setData(value);
				setCompleted({ load, revision, error: "" });
			}
		}).catch(cause => {
			if (!controller.signal.aborted) setCompleted({ load, revision, error: getErrorMessage(cause) });
		});
		return () => controller.abort();
	}, [load, revision]);
	const loading = completed.load !== load || completed.revision !== revision;
	return { data, setData, loading, error: loading ? "" : completed.error, refresh };
}
