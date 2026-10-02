import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateMemoRequest, Label, Memo } from "../../shared/types";
import * as memosApi from "../api/memos";
import * as labelsApi from "../api/labels";
import { getErrorMessage } from "../api/client";
import { useCollection } from "./useCollection";

export function useWorkspace() {
	const [search, setSearch] = useState("");
	const [query, setQuery] = useState("");
	const [labelId, setLabelId] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const mutationLock = useRef(false);
	useEffect(() => {
		const timer = window.setTimeout(() => setQuery(search), 300);
		return () => window.clearTimeout(timer);
	}, [search]);
	const loadMemos = useCallback((signal: AbortSignal) => memosApi.getMemos({ q: query, labelId }, signal), [query, labelId]);
	const memos = useCollection<Memo>(loadMemos);
	const labels = useCollection<Label>(labelsApi.getLabels);
	const filtered = Boolean(search || query || labelId);

	const mutate = async <T,>(action: () => Promise<T>): Promise<T> => {
		if (mutationLock.current) throw new Error("Operation in progress");
		mutationLock.current = true;
		setBusy(true);
		setError("");
		setNotice("");
		try { return await action(); }
		finally { mutationLock.current = false; setBusy(false); }
	};

	const showSavedMemo = (memo: Memo, isNew: boolean) => {
		// Filtering remains a server responsibility. Show newly created ideas in All.
		if (isNew && filtered) {
			setSearch(""); setQuery(""); setLabelId("");
			memos.setData([memo]);
			setNotice("保存しました。すべてのアイデアを表示しています。");
		} else {
			memos.setData(current => current.some(item => item.id === memo.id)
				? current.map(item => item.id === memo.id ? memo : item)
				: [...current, memo]);
			setNotice("アイデアを保存しました。");
		}
		memos.refresh();
	};

	const saveMemo = (memo: Memo | null, body: CreateMemoRequest) => mutate(async () => {
		const saved = memo ? await memosApi.updateMemo(memo.id, body) : await memosApi.createMemo(body);
		showSavedMemo(saved, !memo);
	});

	const removeMemo = (memo: Memo) => mutate(async () => {
		await memosApi.deleteMemo(memo.id);
		memos.setData(current => current.filter(item => item.id !== memo.id));
		memos.refresh();
		setNotice("アイデアを削除しました。");
	});

	const saveLabel = (label: Label | null, name: string) => mutate(async () => {
		const saved = label ? await labelsApi.updateLabel(label.id, { name }) : await labelsApi.createLabel({ name });
		labels.setData(current => [...current.filter(item => item.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, "ja")));
		labels.refresh(); memos.refresh();
		setNotice("ラベルを保存しました。");
	});

	const removeLabel = (label: Label) => mutate(async () => {
		await labelsApi.deleteLabel(label.id);
		labels.setData(current => current.filter(item => item.id !== label.id));
		memos.setData(current => current.map(memo => ({ ...memo, labels: memo.labels.filter(item => item.id !== label.id) })));
		if (labelId === label.id) setLabelId("");
		labels.refresh(); memos.refresh();
		setNotice("ラベルを削除しました。メモはそのまま残ります。");
	});

	const moveMemo = async (index: number, direction: -1 | 1) => {
		if (filtered || busy || memos.loading || mutationLock.current) return;
		const previous = memos.data;
		const target = index + direction;
		if (target < 0 || target >= previous.length) return;
		const next = [...previous];
		[next[index], next[target]] = [next[target], next[index]];
		memos.setData(next);
		try {
			await mutate(async () => {
				await memosApi.reorderMemos({ memoIds: next.map(memo => memo.id) });
				memos.refresh();
				setNotice("並び順を保存しました。");
			});
		} catch (cause) {
			memos.setData(previous);
			setError(getErrorMessage(cause));
		}
	};

	const acceptCandidate = (id: string, candidate: Parameters<typeof memosApi.acceptExpandedMemo>[1]) => mutate(async () => {
		const saved = await memosApi.acceptExpandedMemo(id, candidate);
		showSavedMemo(saved, true);
	});

	return { search, setSearch, query, labelId, setLabelId, filtered, busy, error, notice, memos, labels,
		saveMemo, removeMemo, saveLabel, removeLabel, moveMemo, acceptCandidate };
}
