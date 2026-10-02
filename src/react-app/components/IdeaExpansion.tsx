import { useEffect, useRef, useState } from "react";
import type { ExpandedIdeaCandidate, Memo } from "../../shared/types";
import { expandMemo } from "../api/memos";
import { getErrorMessage } from "../api/client";
import { Modal } from "./Modal";

export function IdeaExpansion({ memo, onClose, onAccept }: {
	memo: Memo; onClose: () => void; onAccept: (candidate: ExpandedIdeaCandidate) => Promise<void>;
}) {
	const [candidates, setCandidates] = useState<ExpandedIdeaCandidate[]>([]);
	const [generating, setGenerating] = useState(true);
	const [saving, setSaving] = useState<number | null>(null);
	const [error, setError] = useState("");
	const controller = useRef<AbortController | null>(null);
	const lock = useRef(false);
	const alive = useRef(true);

	// The timer avoids a duplicate AI request during StrictMode's effect replay.
	useEffect(() => {
		alive.current = true;
		const abort = new AbortController();
		controller.current = abort;
		const timer = window.setTimeout(() => {
			expandMemo(memo.id, abort.signal).then(result => {
				if (!abort.signal.aborted) setCandidates(result.candidates);
			}).catch(cause => {
				if (!abort.signal.aborted) setError(getErrorMessage(cause));
			}).finally(() => {
				if (!abort.signal.aborted) setGenerating(false);
			});
		}, 0);
		return () => { alive.current = false; window.clearTimeout(timer); controller.current?.abort(); };
	}, [memo.id]);

	const regenerate = async () => {
		if (lock.current || generating) return;
		lock.current = true; setGenerating(true); setError("");
		const abort = new AbortController();
		controller.current = abort;
		try {
			const result = await expandMemo(memo.id, abort.signal);
			if (!abort.signal.aborted) setCandidates(result.candidates);
		} catch (cause) { if (!abort.signal.aborted) setError(getErrorMessage(cause)); }
		finally { lock.current = false; if (!abort.signal.aborted) setGenerating(false); }
	};
	const accept = async (candidate: ExpandedIdeaCandidate, index: number) => {
		if (lock.current || generating) return;
		lock.current = true; setSaving(index); setError("");
		try { await onAccept(candidate); if (alive.current) onClose(); }
		catch (cause) { if (alive.current) setError(getErrorMessage(cause)); }
		finally { lock.current = false; if (alive.current) setSaving(null); }
	};
	return (
		<Modal title="AIでアイデアを広げる" onClose={onClose} busy={saving !== null} wide>
			<p className="muted">「{memo.title || "無題のアイデア"}」から、異なる方向の3案を考えます。</p>
			{generating && <p className="loading-panel" role="status">AIがアイデアを考えています…</p>}
			{error && <p className="error" role="alert">{error}</p>}
			{candidates.length > 0 && <div className="candidate-grid" aria-busy={generating}>
				{candidates.map((candidate, index) => (
					<article className="candidate" key={index}>
						<span className="eyebrow">アイデア {String(index + 1).padStart(2, "0")}</span>
						<h3>{candidate.title}</h3>
						<p>{candidate.content}</p>
						<button type="button" className="primary" disabled={generating || saving !== null} onClick={() => { void accept(candidate, index); }}>{saving === index ? "保存中…" : "これを保存する"}</button>
					</article>
				))}
			</div>}
			<p className="muted small">選んだ1件だけを新しいメモとして保存します。</p>
			<div className="actions">
				<button type="button" disabled={saving !== null} onClick={onClose}>キャンセル</button>
				<button type="button" disabled={generating || saving !== null} onClick={() => { void regenerate(); }}>{generating ? "生成中…" : candidates.length ? "もう一度生成" : "再試行"}</button>
			</div>
		</Modal>
	);
}
