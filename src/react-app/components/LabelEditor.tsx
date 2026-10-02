import { useRef, useState, type FormEvent } from "react";
import type { Label } from "../../shared/types";
import { getErrorMessage } from "../api/client";
import { Modal } from "./Modal";

export function LabelEditor({ label, onClose, onSave, onDelete }: {
	label: Label | null; onClose: () => void; onSave: (name: string) => Promise<void>; onDelete: () => Promise<void>;
}) {
	const [name, setName] = useState(label?.name ?? "");
	const [pending, setPending] = useState<"save" | "delete" | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [error, setError] = useState("");
	const lock = useRef(false);
	const run = async (operation: "save" | "delete") => {
		if (lock.current) return;
		lock.current = true; setPending(operation); setError("");
		try {
			if (operation === "delete") await onDelete();
			else await onSave(name.trim());
			onClose();
		} catch (cause) { setError(getErrorMessage(cause)); }
		finally { lock.current = false; setPending(null); }
	};
	const submit = (event: FormEvent) => { event.preventDefault(); void run("save"); };
	return (
		<Modal title={label ? "ラベルを編集" : "新しいラベル"} onClose={onClose} busy={!!pending}>
			<form onSubmit={submit}>
				<label htmlFor="label-name">ラベル名</label>
				<input id="label-name" value={name} onChange={event => setName(event.target.value)} required disabled={!!pending || confirmDelete} placeholder="例：開発、いつか作りたい" />
				{error && <p className="error" role="alert">{error}</p>}
				{confirmDelete ? (
					<div className="confirmation" role="group" aria-label="ラベル削除の確認">
						<p>「{label?.name}」を削除しますか？ メモは削除されません。</p>
						<div className="actions">
							<button type="button" disabled={!!pending} onClick={() => setConfirmDelete(false)}>戻る</button>
							<button type="button" className="danger" disabled={!!pending} onClick={() => { void run("delete"); }}>{pending === "delete" ? "削除中…" : "削除する"}</button>
						</div>
					</div>
				) : (
					<div className="modal-footer">
						{label && <button type="button" className="danger-text" disabled={!!pending} onClick={() => setConfirmDelete(true)}>削除</button>}
						<div className="actions">
							<button type="button" onClick={onClose} disabled={!!pending}>キャンセル</button>
							<button type="submit" className="primary" disabled={!!pending || !name.trim()}>{pending === "save" ? "保存中…" : "保存する"}</button>
						</div>
					</div>
				)}
			</form>
		</Modal>
	);
}
