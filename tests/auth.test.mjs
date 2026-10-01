import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { betterAuth } from "better-auth/minimal";
import { testUtils } from "better-auth/plugins";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { createAuth } from "../src/worker/auth/index.ts";
import app from "../src/worker/index.ts";

const origin = "http://localhost:5173";
const bindings = {
	GOOGLE_CLIENT_ID: "test-only-client-id",
	GOOGLE_CLIENT_SECRET: "test-only-client-secret",
	BETTER_AUTH_SECRET: randomBytes(32).toString("base64"),
	BETTER_AUTH_URL: origin,
};
const protectedRoutes = [
	["GET", "/api/memos"], ["GET", "/api/memos/"], ["GET", "/api/memos/example"],
	["POST", "/api/memos"], ["PATCH", "/api/memos/example"], ["DELETE", "/api/memos/example"],
	["GET", "/api/labels"], ["GET", "/api/labels/"], ["POST", "/api/labels"],
	["PATCH", "/api/labels/example"], ["DELETE", "/api/labels/example"],
];
let worker;
let db;
let helpers;

before(async () => {
	const config = JSON.parse(await readFile(new URL("../dist/idea_bag/wrangler.json", import.meta.url), "utf8"));
	const workerRoot = new URL("../dist/idea_bag/", import.meta.url);
	const assets = await readdir(new URL("assets/", workerRoot));
	worker = new Miniflare(convertV4MiniflareOptions({
		modulesRoot: fileURLToPath(workerRoot),
		modules: ["index.js", ...assets.filter((name) => name.endsWith(".js")).map((name) => "assets/" + name)]
			.map((name) => ({ type: "ESModule", path: fileURLToPath(new URL(name, workerRoot)) })),
		compatibilityDate: config.compatibility_date,
		compatibilityFlags: config.compatibility_flags,
		bindings,
		d1Databases: { DB: "auth-test-db" },
		d1Persist: false,
	}));
	db = await worker.getD1Database("DB");
	const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
	for (const [index, entry] of journal.entries.entries()) {
		const sql = await readFile(new URL("../drizzle/" + entry.tag + ".sql", import.meta.url), "utf8");
		for (const statement of sql.split("--> statement-breakpoint")) {
			if (statement.trim()) await db.prepare(statement).run();
		}
		if (index === 0) {
			await db.prepare("INSERT INTO memos (id, user_id, title, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
				.bind("preserved-memo", "future-user", "Existing memo", "Content", 0, "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z").run();
			await db.prepare("INSERT INTO labels (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
				.bind("preserved-label", "future-user", "Existing label", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z").run();
			await db.prepare("INSERT INTO memo_labels (memo_id, label_id) VALUES (?, ?)")
				.bind("preserved-memo", "preserved-label").run();
		}
	}
	// Official helpers exist only in this test instance, never in the bundled Worker.
	const auth = betterAuth({ ...createAuth({ ...bindings, DB: db }).options, plugins: [testUtils()] });
	helpers = (await auth.$context).test;
});

after(async () => { await worker?.dispose(); });

async function login() {
	const user = helpers.createUser();
	await helpers.saveUser(user);
	return helpers.login({ userId: user.id });
}

function request(path, init = {}) {
	return worker.dispatchFetch(origin + path, init);
}

function jsonHeaders(headers, requestOrigin = origin) {
	const result = new Headers(headers);
	result.set("Content-Type", "application/json");
	result.set("Origin", requestOrigin);
	return result;
}

test("auth migration preserves app tables and existing data", async () => {
	assert.equal((await db.prepare("SELECT title FROM memos WHERE id = ?").bind("preserved-memo").first()).title, "Existing memo");
	assert.equal((await db.prepare("SELECT name FROM labels WHERE id = ?").bind("preserved-label").first()).name, "Existing label");
	assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM memo_labels").first()).count, 1);
	const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
	for (const name of ["user", "session", "account", "verification"]) {
		assert.ok(tables.results.some((table) => table.name === name));
	}
});

test("all protected routes reject anonymous requests, including bare paths", async () => {
	for (const [method, path] of [...protectedRoutes, ["GET", "/api/me"]]) {
		const response = await request(path, { method });
		assert.equal(response.status, 401, method + " " + path);
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.equal((await response.json()).error.code, "UNAUTHORIZED");
	}
});

test("D1 sessions grant access and /api/me exposes only the user DTO", async () => {
	const loggedIn = await login();
	const stored = await db.prepare("SELECT user_id FROM session WHERE id = ?").bind(loggedIn.session.id).first();
	assert.equal(stored.user_id, loggedIn.user.id);
	for (const [method, path] of protectedRoutes) {
		const response = await request(path, { method, headers: loggedIn.headers });
		assert.equal(response.status, path.endsWith("/") ? 404 : 501, method + " " + path);
	}
	const response = await request("/api/me", { headers: loggedIn.headers });
	assert.equal(response.status, 200);
	const user = await response.json();
	assert.deepEqual(Object.keys(user).sort(), ["id", "name", "email", "image", "createdAt", "updatedAt"].sort());
	assert.equal(user.id, loggedIn.user.id);
	assert.equal(user.email, loggedIn.user.email);
	assert.ok(!Number.isNaN(Date.parse(user.createdAt)));
	const session = await request("/api/auth/get-session", { headers: loggedIn.headers });
	assert.equal(session.status, 200);
	assert.equal((await session.json()).user.id, user.id);
});

test("tampered and expired sessions cannot authorize a request", async () => {
	const invalid = await request("/api/me", { headers: { Cookie: "better-auth.session_token=invalid-signature" } });
	assert.equal(invalid.status, 401);
	const loggedIn = await login();
	await db.prepare("UPDATE session SET expires_at = ? WHERE id = ?").bind(Date.now() - 1000, loggedIn.session.id).run();
	const expired = await request("/api/me", { headers: loggedIn.headers });
	assert.equal(expired.status, 401);
});

test("middleware forwards session refresh cookies and updates D1", async () => {
	const loggedIn = await login();
	const oldExpiry = Date.now() + 60_000;
	await db.prepare("UPDATE session SET created_at = ?, updated_at = ?, expires_at = ? WHERE id = ?")
		.bind(Date.now() - 3 * 86400_000, Date.now() - 3 * 86400_000, oldExpiry, loggedIn.session.id).run();
	const response = await request("/api/me", { headers: loggedIn.headers });
	assert.equal(response.status, 200);
	assert.ok(response.headers.get("Set-Cookie"));
	const stored = await db.prepare("SELECT expires_at FROM session WHERE id = ?").bind(loggedIn.session.id).first();
	assert.ok(stored.expires_at > oldExpiry);
});

test("standard sign-out revokes the D1 session", async () => {
	const loggedIn = await login();
	const response = await request("/api/auth/sign-out", {
		method: "POST", headers: jsonHeaders(loggedIn.headers), body: "{}",
	});
	assert.equal(response.status, 200);
	assert.equal(await db.prepare("SELECT id FROM session WHERE id = ?").bind(loggedIn.session.id).first(), null);
	assert.equal((await request("/api/me", { headers: loggedIn.headers })).status, 401);
});

test("Google initiation uses the configured callback and checks request origins", async () => {
	const response = await request("/api/auth/sign-in/social", {
		method: "POST", headers: jsonHeaders(),
		body: JSON.stringify({ provider: "google", callbackURL: "/", disableRedirect: true }),
	});
	assert.equal(response.status, 200);
	const location = new URL((await response.json()).url);
	assert.equal(location.hostname, "accounts.google.com");
	assert.equal(location.searchParams.get("redirect_uri"), origin + "/api/auth/callback/google");
	assert.ok(location.searchParams.get("state"));
	const untrusted = await request("/api/auth/sign-in/social", {
		method: "POST", headers: jsonHeaders({ Cookie: "better-auth.session_token=test-only-cookie" }, "https://untrusted.example"),
		body: JSON.stringify({ provider: "google" }),
	});
	assert.equal(untrusted.status, 403);
	const invalidRedirect = await request("/api/auth/sign-in/social", {
		method: "POST", headers: jsonHeaders(),
		body: JSON.stringify({ provider: "google", callbackURL: "https://untrusted.example/" }),
	});
	assert.equal(invalidRedirect.status, 403);
	const callback = await request("/api/auth/callback/google?error=access_denied", { redirect: "manual" });
	assert.ok([302, 303, 400].includes(callback.status), "OAuth error callback status: " + callback.status);
});

test("missing configuration has no fallback secret and leaves anonymous APIs protected", async () => {
	const emptyEnv = { DB: db, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", BETTER_AUTH_SECRET: "", BETTER_AUTH_URL: "" };
	const response = await app.request(origin + "/api/auth/get-session", {}, emptyEnv);
	assert.equal(response.status, 503);
	assert.equal((await response.json()).error.code, "AUTH_NOT_CONFIGURED");
	assert.equal((await app.request(origin + "/api/me", {}, emptyEnv)).status, 401);
});
