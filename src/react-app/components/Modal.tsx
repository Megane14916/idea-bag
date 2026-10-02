import { useEffect, useId, useRef, type ReactNode } from "react";

export function Modal({ title, onClose, busy = false, wide = false, children }: {
	title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: ReactNode;
}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const titleId = useId();
	useEffect(() => {
		const element = dialog.current!;
		const previousFocus = document.activeElement as HTMLElement | null;
		element.showModal();
		element.querySelector<HTMLInputElement>("input:not([disabled]), textarea:not([disabled])")?.focus();
		return () => {
			element.close();
			requestAnimationFrame(() => { if (previousFocus?.isConnected) previousFocus.focus(); });
		};
	}, []);
	return (
		<dialog ref={dialog} className={`modal ${wide ? "modal-wide" : ""}`} aria-labelledby={titleId}
			onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
			<div className="modal-header">
				<h2 id={titleId}>{title}</h2>
				<button type="button" className="icon-button" aria-label="閉じる" disabled={busy} onClick={onClose}>×</button>
			</div>
			{children}
		</dialog>
	);
}
