import { useRef, useState } from "react";
import type { Label, Memo, User } from "../shared/types";
import { signInWithGoogle } from "./api/auth";
import { getErrorMessage } from "./api/client";
import { IdeaExpansion } from "./components/IdeaExpansion";
import { LabelEditor } from "./components/LabelEditor";
import { MemoEditor } from "./components/MemoEditor";
import { useSession } from "./hooks/useSession";
import { useWorkspace } from "./hooks/useWorkspace";
import "./App.css";

function BagMark() {
	return <span className="bag-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M10 11V9a6 6 0 0 1 12 0v2M7 11h18l2 16H5l2-16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 17c0 5 8 5 8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></span>;
}

function Login() {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(() => new URLSearchParams(window.location.search).has("loginError") ? "ログインを完了できませんでした。もう一度お試しください。" : "");
	const lock = useRef(false);
	const login = async () => {
		if (lock.current) return;
		lock.current = true; setPending(true); setError("");
		try { await signInWithGoogle(); }
		catch (cause) { setError(getErrorMessage(cause)); }
		finally { lock.current = false; setPending(false); }
	};
	return <main className="login-page">
		<div className="login-card">
			<BagMark />
			<p className="eyebrow">思いつきを、ひとつずつ。</p>
			<h1>Idea Bag</h1>
			<p className="login-description">アイデアを気軽に保存し、<br />AIと一緒に広げるためのメモアプリ</p>
			<button type="button" className="google-button" disabled={pending} onClick={() => { void login(); }}>
				<span className="google-letter" aria-hidden="true">G</span>{pending ? "ログインを開始しています…" : "Googleでログイン"}
			</button>
			{error && <p className="error" role="alert">{error}</p>}
			<p className="muted small">小さな思いつきも、次のアイデアの種に。</p>
		</div>
	</main>;
}

type EditorState = { kind: "memo"; memo: Memo | null } | { kind: "label"; label: Label | null } | { kind: "ai"; memo: Memo } | null;
const dateFormatter = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" });
function updatedDate(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "日時不明" : dateFormatter.format(date);
}

function Workspace({ user, loggingOut, onLogout }: { user: User; loggingOut: boolean; onLogout: () => void }) {
	const workspace = useWorkspace();
	const { memos, labels } = workspace;
	const [editor, setEditor] = useState<EditorState>(null);
	const [labelsOpen, setLabelsOpen] = useState(false);
	const disabled = workspace.busy || loggingOut;
	const selectedLabel = labels.data.find(label => label.id === workspace.labelId);
	const selectLabel = (id: string) => { workspace.setLabelId(id); setLabelsOpen(false); };
	const reload = () => { memos.refresh(); labels.refresh(); };
	return <div className="app-shell">
		<header className="app-header">
			<a className="brand" href="/" onClick={event => { event.preventDefault(); if (!disabled) { workspace.setSearch(""); workspace.setLabelId(""); } }}><BagMark /><span>Idea Bag</span></a>
			<div className="search-field">
				<span aria-hidden="true">⌕</span>
				<input type="search" aria-label="アイデアを検索" placeholder="アイデアを検索" value={workspace.search} disabled={disabled} onChange={event => workspace.setSearch(event.target.value)} />
			</div>
			<div className="user-menu">
				<span className="avatar" aria-hidden="true">{user.name.slice(0, 1) || "U"}</span>
				<span className="user-name" title={user.email}>{user.name || user.email}</span>
				<button type="button" className="quiet" disabled={disabled || editor !== null} onClick={onLogout}>{loggingOut ? "ログアウト中…" : "ログアウト"}</button>
			</div>
		</header>
		<div className="workspace-layout">
			<aside className="sidebar" aria-label="ラベル">
				<div className="sidebar-heading"><h2>ラベル</h2><button type="button" className="mobile-label-toggle" aria-expanded={labelsOpen} aria-controls="labels-nav" onClick={() => setLabelsOpen(value => !value)}>{labelsOpen ? "閉じる" : "一覧を開く"}</button></div>
				<div id="labels-nav" className={`labels-nav ${labelsOpen ? "is-open" : ""}`}>
					<button type="button" className={`label-filter ${!workspace.labelId ? "selected" : ""}`} aria-pressed={!workspace.labelId} disabled={disabled} onClick={() => selectLabel("")}><span aria-hidden="true">▤</span>すべてのアイデア</button>
					{labels.loading && <p className="muted small" role="status">ラベルを読み込み中…</p>}
					{labels.error && <div className="error" role="alert"><p>{labels.error}</p><button type="button" disabled={disabled} onClick={labels.refresh}>再試行</button></div>}
					{labels.data.map(label => <div className="label-row" key={label.id}>
						<button type="button" className={`label-filter ${workspace.labelId === label.id ? "selected" : ""}`} aria-pressed={workspace.labelId === label.id} disabled={disabled || labels.loading} onClick={() => selectLabel(label.id)}><span aria-hidden="true">#</span><span className="label-name">{label.name}</span></button>
						<button type="button" className="icon-button label-edit" aria-label={`${label.name}を編集`} disabled={disabled || labels.loading} onClick={() => setEditor({ kind: "label", label })}>✎</button>
					</div>)}
					<button type="button" className="add-label" disabled={disabled || labels.loading || !!labels.error} onClick={() => setEditor({ kind: "label", label: null })}>＋ ラベルを追加</button>
				</div>
				<p className="sidebar-note">まとまる前のアイデアも、<br />ここに入れておこう。</p>
			</aside>
			<main className="ideas-main">
				<div className="ideas-heading">
					<div><p className="eyebrow">YOUR IDEAS</p><h1>{selectedLabel?.name || "すべてのアイデア"}</h1><p className="muted">気になったこと、作りたいもの。自由に放り込もう。</p></div>
					<button type="button" className="primary new-idea" disabled={disabled || labels.loading || !!labels.error} onClick={() => setEditor({ kind: "memo", memo: null })}>＋ 新しいアイデア</button>
				</div>
				<div className="list-toolbar">
					<span>{memos.data.length} 件{workspace.query ? ` · 「${workspace.query}」の検索結果` : ""}</span>
					<button type="button" className="quiet" disabled={disabled || memos.loading || labels.loading} onClick={reload}>再読み込み</button>
				</div>
				{workspace.filtered && <p className="filter-note">検索・絞り込み中です。並べ替えは「すべてのアイデア」で検索を解除すると使えます。 <button type="button" className="text-button" disabled={disabled} onClick={() => { workspace.setSearch(""); workspace.setLabelId(""); }}>条件を解除</button></p>}
				{workspace.notice && <p className="notice" role="status">{workspace.notice}</p>}
				{workspace.error && <p className="error" role="alert">{workspace.error}</p>}
				{memos.error && <div className="error" role="alert"><p>{memos.error}</p><button type="button" disabled={disabled || memos.loading} onClick={memos.refresh}>再試行</button></div>}
				{memos.loading && <p className="loading-panel" role="status">アイデアを読み込み中…</p>}
				{workspace.busy && !editor && <p className="muted small" role="status">並び順を保存中…</p>}
				{!memos.loading && !memos.error && memos.data.length === 0 && <div className="empty-state"><BagMark /><h2>{workspace.filtered ? "アイデアが見つかりませんでした" : "最初のアイデアを入れてみよう"}</h2><p className="muted">{workspace.filtered ? "検索ワードやラベルを変えてお試しください。" : "ひとことのメモから、気軽に始められます。"}</p>{!workspace.filtered && <button type="button" disabled={disabled || labels.loading || !!labels.error} className="primary" onClick={() => setEditor({ kind: "memo", memo: null })}>＋ 新しいアイデア</button>}</div>}
				<div className="memo-grid" aria-busy={memos.loading || workspace.busy}>
					{memos.data.map((memo, index) => <article className="memo-card" key={memo.id}>
						<button type="button" className="memo-open" disabled={disabled || memos.loading || labels.loading || !!labels.error} aria-label={`${memo.title || "無題のアイデア"}を編集`} onClick={() => setEditor({ kind: "memo", memo })}>
							{memo.sourceMemoId && <span className="source-note">発展させたアイデア</span>}
							<h2>{memo.title || "無題のアイデア"}</h2><p className="memo-content">{memo.content || "内容はまだありません。"}</p>
						</button>
						<div className="memo-labels">{memo.labels.map(label => <span className="label-chip" key={label.id}>{label.name}</span>)}</div>
						<time dateTime={memo.updatedAt} className="memo-date">更新 {updatedDate(memo.updatedAt)}</time>
						<div className="memo-actions">
							<button type="button" className="ai-button" disabled={disabled || memos.loading} onClick={() => setEditor({ kind: "ai", memo })}>✧ AIで広げる</button>
							<div className="order-controls" aria-label="並べ替え">
								<button type="button" className="icon-button" aria-label={`${memo.title || "無題のアイデア"}を上へ移動`} title="上へ移動" disabled={disabled || memos.loading || !!memos.error || workspace.filtered || index === 0} onClick={() => { void workspace.moveMemo(index, -1); }}>↑</button>
								<button type="button" className="icon-button" aria-label={`${memo.title || "無題のアイデア"}を下へ移動`} title="下へ移動" disabled={disabled || memos.loading || !!memos.error || workspace.filtered || index === memos.data.length - 1} onClick={() => { void workspace.moveMemo(index, 1); }}>↓</button>
							</div>
						</div>
					</article>)}
				</div>
			</main>
		</div>
		{editor?.kind === "memo" && <MemoEditor memo={editor.memo} labels={labels.data} onClose={() => setEditor(null)} onSave={body => workspace.saveMemo(editor.memo, body)} onDelete={() => workspace.removeMemo(editor.memo!)} />}
		{editor?.kind === "label" && <LabelEditor label={editor.label} onClose={() => setEditor(null)} onSave={name => workspace.saveLabel(editor.label, name)} onDelete={() => workspace.removeLabel(editor.label!)} />}
		{editor?.kind === "ai" && <IdeaExpansion memo={editor.memo} onClose={() => setEditor(null)} onAccept={candidate => workspace.acceptCandidate(editor.memo.id, candidate)} />}
	</div>;
}

export default function App() {
	const session = useSession();
	if (session.status === "loading") return <main className="session-page"><BagMark /><h1>Idea Bag</h1>{session.error ? <><p className="error" role="alert">{session.error}</p><button type="button" disabled={session.checking} onClick={() => { void session.refresh(); }}>{session.checking ? "確認中…" : "再試行"}</button></> : <p role="status" className="muted">ログイン状態を確認しています…</p>}</main>;
	return <>{session.error && <div className="session-error error" role="alert">{session.error}<button type="button" disabled={session.checking} onClick={() => { void session.refresh(); }}>再試行</button></div>}{session.status === "authenticated" ? <Workspace key={session.user.id} user={session.user} loggingOut={session.loggingOut} onLogout={() => { void session.logout(); }} /> : <Login />}</>;
}
