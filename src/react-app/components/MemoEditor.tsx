import { useRef, useState, type FormEvent } from "react";
import type { CreateMemoRequest, Label, Memo } from "../../shared/types";
import { getErrorMessage } from "../api/client";
import { Modal } from "./Modal";

export function MemoEditor({ memo, labels, onClose, onSave, onDelete }: {
	memo: Memo | null; labels: Label[]; onClose: () => void;
	onSave: (body: CreateMemoRequest) => Promise<void>; onDelete: () => Promise<void>;
}) {
	const [title, setTitle] = useState(memo?.title ?? "");
	const [content, setContent] = useState(memo?.content ?? "");
	const [labelIds, setLabelIds] = useState(memo?.labels.map(label => label.id) ?? []);
	const [pending, setPending] = useState<"save" | "delete" | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [error, setError] = useState("");
	const lock = useRef(false);

	const run = async (operation: "save" | "delete") => {
		if (lock.current) return;
		lock.current = true;
		setPending(operation); setError("");
		try {
			if (operation === "delete") await onDelete();
			else await onSave({ title, content, labelIds });
			onClose();
		} catch (cause) { setError(getErrorMessage(cause)); }
		finally { lock.current = false; setPending(null); }
	};
	const submit = (event: FormEvent) => { event.preventDefault(); void run("save"); };
	return (
		<Modal title={memo ? "アイデアを編集" : "新しいアイデア"} onClose={onClose} busy={!!pending}>
			<form onSubmit={submit}>
				<fieldset className="editor-fields" disabled={!!pending || confirmDelete}>
					<label htmlFor="memo-title">タイトル</label>
					<input id="memo-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="ふと思いついたこと" />
					<label htmlFor="memo-content">内容</label>
					<textarea id="memo-content" value={content} onChange={event => setContent(event.target.value)} placeholder="まだまとまっていなくても、そのまま書いてみましょう。" rows={8} />
					<fieldset className="label-picker">
						<legend>ラベル</legend>
						{labels.length ? labels.map(label => (
							<label className="checkbox-label" key={label.id}>
								<input type="checkbox" checked={labelIds.includes(label.id)} onChange={event => setLabelIds(current => event.target.checked ? [...current, label.id] : current.filter(id => id !== label.id))} />
								{label.name}
							</label>
						)) : <p className="muted">サイドバーからラベルを作成できます。</p>}
					</fieldset>
				</fieldset>
				{error && <p className="error" role="alert">{error}</p>}
				{confirmDelete ? (
					<div className="confirmation" role="group" aria-label="削除の確認">
						<p>このアイデアを削除しますか？ この操作は元に戻せません。</p>
						<div className="actions">
							<button type="button" disabled={!!pending} onClick={() => setConfirmDelete(false)}>戻る</button>
							<button type="button" className="danger" disabled={!!pending} onClick={() => { void run("delete"); }}>{pending === "delete" ? "削除中…" : "削除する"}</button>
						</div>
					</div>
				) : (
					<div className="modal-footer">
						{memo && <button type="button" className="danger-text" disabled={!!pending} onClick={() => setConfirmDelete(true)}>削除</button>}
						<div className="actions">
							<button type="button" disabled={!!pending} onClick={onClose}>キャンセル</button>
							<button type="submit" className="primary" disabled={!!pending}>{pending === "save" ? "保存中…" : "保存する"}</button>
						</div>
					</div>
				)}
			</form>
		</Modal>
	);
}
