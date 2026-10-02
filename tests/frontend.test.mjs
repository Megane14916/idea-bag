import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { ApiError, getErrorMessage, SESSION_EXPIRED_EVENT } from "../src/react-app/api/client.ts";
import * as memos from "../src/react-app/api/memos.ts";
import * as labels from "../src/react-app/api/labels.ts";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
afterEach(() => {
	globalThis.fetch = originalFetch;
	if (originalWindow === undefined) delete globalThis.window;
	else globalThis.window = originalWindow;
});

function respond(body, status = 200) {
	globalThis.fetch = async () => new Response(status === 204 ? null : JSON.stringify(body), { status });
}

test("search and label filtering use a single encoded relative URL and support cancellation", async () => {
	const abort = new AbortController();
	let call;
	globalThis.fetch = async (path, init) => { call = { path, init }; return Response.json([]); };
	assert.deepEqual(await memos.getMemos({ q: "アイデア & 100%_", labelId: "label / one" }, abort.signal), []);
	const url = new URL(call.path, "https://example.test");
	assert.ok(call.path.startsWith("/api/memos?"));
	assert.equal(url.searchParams.get("q"), "アイデア & 100%_");
	assert.equal(url.searchParams.get("labelId"), "label / one");
	assert.equal(call.init.credentials, "same-origin");
	assert.equal(call.init.signal, abort.signal);
	await memos.getMemos({ q: "", labelId: "" });
	assert.equal(call.path, "/api/memos");
});

test("memo writes preserve labelIds, encode IDs, and handle bodyless 204 responses", async () => {
	const calls = [];
	globalThis.fetch = async (path, init) => {
		calls.push({ path, ...init });
		return init.method === "DELETE" || path.endsWith("/order") ? new Response(null, { status: 204 }) : Response.json({ id: "saved" });
	};
	const body = { title: "", content: "本文", labelIds: ["label-1"] };
	assert.equal((await memos.createMemo(body)).id, "saved");
	await memos.updateMemo("memo / 1", { labelIds: [] });
	assert.equal(await memos.deleteMemo("memo / 1"), undefined);
	assert.equal(await memos.reorderMemos({ memoIds: ["m2", "m1"] }), undefined);
	assert.deepEqual(calls.map(call => [call.path, call.method]), [
		["/api/memos", "POST"], ["/api/memos/memo%20%2F%201", "PATCH"],
		["/api/memos/memo%20%2F%201", "DELETE"], ["/api/memos/order", "PATCH"],
	]);
	assert.deepEqual(JSON.parse(calls[0].body), body);
	assert.deepEqual(JSON.parse(calls[1].body), { labelIds: [] });
	assert.equal(calls[0].headers.get("Content-Type"), "application/json");
});

test("AI generation sends no body, and acceptance sends only the chosen candidate", async () => {
	const calls = [];
	const candidate = { title: "案", content: "新しい方向性" };
	globalThis.fetch = async (path, init) => { calls.push({ path, ...init }); return Response.json(path.endsWith("accept") ? { id: "new" } : { candidates: [candidate, candidate, candidate] }); };
	assert.equal((await memos.expandMemo("source")).candidates.length, 3);
	assert.equal((await memos.acceptExpandedMemo("source", candidate)).id, "new");
	assert.equal(calls[0].path, "/api/memos/source/expand");
	assert.equal(calls[0].body, undefined);
	assert.equal(calls[1].path, "/api/memos/source/expand/accept");
	assert.deepEqual(JSON.parse(calls[1].body), candidate);
});

test("label client supports list, create, rename and delete with the existing contracts", async () => {
	const calls = [];
	globalThis.fetch = async (path, init) => { calls.push({ path, ...init }); return init.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({ id: "l1", name: "開発" }); };
	await labels.getLabels(); await labels.createLabel({ name: "開発" });
	await labels.updateLabel("label / 1", { name: "技術" }); await labels.deleteLabel("label / 1");
	assert.deepEqual(calls.map(call => [call.path, call.method ?? "GET"]), [
		["/api/labels", "GET"], ["/api/labels", "POST"], ["/api/labels/label%20%2F%201", "PATCH"], ["/api/labels/label%20%2F%201", "DELETE"],
	]);
	assert.deepEqual(JSON.parse(calls[2].body), { name: "技術" });
});

test("HTTP failures produce safe Japanese messages without exposing backend details", async () => {
	for (const status of [400, 401, 403, 404, 409, 500, 502, 503]) {
		respond({ error: { code: "INTERNAL", message: "private SQL stack trace" } }, status);
		await assert.rejects(memos.getMemos(), error => {
			assert.ok(error instanceof ApiError);
			assert.equal(error.status, status);
			assert.ok(!getErrorMessage(error).includes("private"));
			assert.ok(!getErrorMessage(error).includes("SQL"));
			return true;
		});
	}
	globalThis.fetch = async () => new Response("private proxy error", { status: 502 });
	await assert.rejects(memos.expandMemo("source"), error => error.status === 502 && !error.message.includes("private"));
	assert.ok(new ApiError(409, "DUPLICATE_LABEL").message.includes("同じ名前"));
	assert.ok(new ApiError(409, "MEMO_ORDER_CONFLICT").message.includes("再読み込み"));
});

test("401 dispatches session revalidation and failed mutations remain rejected", async () => {
	const target = new EventTarget();
	globalThis.window = target;
	let rechecks = 0;
	target.addEventListener(SESSION_EXPIRED_EVENT, () => rechecks++);
	respond({ error: { code: "UNAUTHORIZED" } }, 401);
	await assert.rejects(memos.createMemo({ title: "案", content: "" }), { status: 401 });
	assert.equal(rechecks, 1);
	respond({}, 500);
	await assert.rejects(memos.reorderMemos({ memoIds: ["1"] }), { status: 500 });
	assert.equal(rechecks, 1);
});
