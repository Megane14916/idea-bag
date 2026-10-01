# 開発手順

## 初回セットアップ

Node.js 22.12以降を使用し、リポジトリのルートで実行します。

```sh
npm ci
```

`.dev.vars.example` を `.dev.vars` にコピーします（PowerShellの例）。

```powershell
Copy-Item .dev.vars.example .dev.vars
```

認証を使う場合は、後述のGoogle OAuth設定と4つの環境変数の設定が必要です。空欄でも開発サーバーは起動できますが、認証APIは503を返します。
本物のSecretは `.dev.vars` にのみ記載してください。`.dev.vars*` は既存の `.gitignore` で除外され、exampleのみGit管理対象です。

## ローカル開発

```sh
npm run db:migrate:local
npm run cf-typegen
npm run dev
```

ViteとCloudflare ViteプラグインがReactとWorkerを同じオリジン（`http://localhost:5173`）で起動します。
フロントエンドは `fetch("/api/...")` のように相対URLで呼び出します。
`assets.run_worker_first` により `/api/*` はHonoへ、それ以外は既存のSPAへルーティングされます。

ローカル開発から始める場合、本番D1の作成・IDの設定・本番migrationはまだ不要です。
ローカルD1のデータは `.wrangler/state` に保存され、ViteとWranglerのローカルmigrationで共有されます。

### ローカルDBと本番DBの切り替え

| 操作 | 使用するDB |
| --- | --- |
| `npm run dev` | ローカルD1 |
| `npm run db:migrate:local` | ローカルD1にSQLを適用 |
| `npm run db:migrate:remote` | Cloudflare上の本番D1にSQLを適用 |
| `npm run build` → `npm run deploy` | デプロイされたWorkerは本番D1を使用 |

どちらもWorker内では同じ `c.env.DB` と `createDb(c.env.DB)` を使います。アプリコードや接続URLを変更する必要はありません。
`wrangler.json` のD1 bindingに `remote: false` を明示しており、開発時はローカルD1を使います。この設定はデプロイ先で本番D1を使うことを妨げません。
実際の `database_id` を設定しても `npm run dev` はローカルDBを使います。
ローカルと本番のデータ・migrationの適用履歴は別々で、自動で同期されません。
`wrangler.json` のIDプレースホルダーのままでもローカル開発・migrationが可能です。

## 本番D1の準備（公開する段階で実行）

本番DBが必要になった時点で、CloudflareアカウントでログインしてD1を作成します。作成済みの場合は再作成不要です。ローカル開発だけなら、この節の作業は不要です。

```sh
npx wrangler login
npx wrangler d1 create idea-bag-db
```

設定の自動追記を尋ねられた場合は手動設定を選び、既存bindingを重複させないでください。
返された実際の `database_id` で、`wrangler.json` 内の `REPLACE_WITH_D1_DATABASE_ID` を置き換えます。
`binding: "DB"`、`database_name: "idea-bag-db"`、`migrations_dir: "./drizzle"` は維持します。
IDを変更するとローカルDBの保存先も変わるため、ローカルmigrationを再度実行してください。

```sh
npm run db:migrate:local
npm run cf-typegen
```

## スキーマとmigration

スキーマは `src/worker/db/schema.ts`、SQLとDrizzleのメタデータは `drizzle/` に配置します。アプリ用の初期migrationとBetter Auth用の追加migrationは生成済みです。
スキーマ変更後、次のコマンドでSQLを生成し、内容を確認してローカルDBに適用します。

```sh
npm run db:generate
npm run db:migrate:local
```

生成したSQLと `drizzle/meta/` は両方Git管理します。生成は認証情報不要で、適用にはWranglerを使います。
同じ変更に対して `wrangler d1 migrations create` や `drizzle-kit push` を併用しないでください。

本番を準備する段階で、D1を実際に作成し、IDを設定した後に本番migrationを実行します。今ローカル開発を始めるために実行する必要はありません。本番DBを変更するコマンドです。

```sh
npm run db:migrate:remote
```

binding変更時の型生成と検証：

```sh
npm run cf-typegen
npm run typecheck
npm run lint
npm run build
npm run check
```

`cf-typegen` は `wrangler types` を実行し、`worker-configuration.d.ts` を更新します。
`check` にはデプロイのdry-runが含まれます。

## 実装の境界

APIの型は `src/shared/types` の独立したcamelCase型です。日時はISO 8601 UTC文字列を使います。
DBの型・実装は `src/worker/db` に閉じ、今後APIを実装する際はレスポンスを明示的に組み立てます。
たとえばDBの `order_index`（Drizzleでは `orderIndex`）をAPIの `order` に変換し、`user_id` などDBの行をそのまま返さないようにします。
DBの日時は作成・更新処理側で設定する前提です。DBクライアントはリクエスト内で `createDb(c.env.DB)` として作成します。

`memos.user_id` と `labels.user_id` はBetter Authのuser IDを保存する前提です。既存データを維持するため、この2カラムへのuser外部キー追加は今回行っていません。
認証のDB型はWorker内に閉じ、`src/shared/types/User` はAPI用の型として独立させています。
指定されたMemo / Labelの9ルートは認証必須です。未ログイン時は401、ログイン済みの場合は暫定的にHTTP 501と `{ "message": "Not implemented" }` を返します。
既存の `/api/` は維持しています。CRUD、検索、並べ替え、ラベル付け、ログインUIは未実装です。

参考：[Cloudflare Vite構成](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)、[D1 migration](https://developers.cloudflare.com/d1/reference/migrations/)、[Drizzle設定](https://orm.drizzle.team/docs/drizzle-config-file)。

## Google OAuth / Better Auth

Better AuthをHonoの `/api/auth/*` にマウントしています。OAuthのstate・callback・Cookie処理はBetter Auth標準の実装を使用し、セッションはD1に保存します。Email / Password認証は無効です。
既存の `nodejs_compat` を維持しています。Better Authが内部で使うAsyncLocalStorageに必要で、現在のcompatibility dateで対応しています。

### Google Cloud Console

Google CloudプロジェクトでOAuth同意画面を設定し、OAuth Client IDを作成します。Application Typeは **Web application** を選んでください。
開発用と本番用のOAuth Clientは分け、それぞれ次のAuthorized Redirect URIを登録します。文字列は完全一致させてください。

| 環境 | Authorized Redirect URI |
| --- | --- |
| ローカル | `http://localhost:5173/api/auth/callback/google` |
| 本番 | `https://<app>.workers.dev/api/auth/callback/google` |

独自ドメインで公開する場合は、本番URLをそのドメインに置き換えます。Authorized JavaScript originsを設定する場合はパスを含めず、その環境のオリジンを指定します。
作成したClient ID / Client Secretを、ローカルでは `.dev.vars`、本番ではWorkers Secretsへ設定します。
Viteはポート5173を固定し、そのポートが使用中の場合はエラーで終了します。ブラウザも `http://localhost:5173` を使用してください。

### ローカルの環境変数

既存の `.dev.vars` がなければ、初回セットアップのコピーを実行します。作成済みのファイルは上書きせず、次の値を設定してください。

| 変数 | ローカルで設定する値 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | 開発用OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | 開発用OAuth Client Secret |
| `BETTER_AUTH_SECRET` | 32文字以上の安全なランダム値 |
| `BETTER_AUTH_URL` | `http://localhost:5173`（`/api/auth` は付けない） |

ランダム値は手元の端末で生成し、`.dev.vars` のみに保存します。例：

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

`.dev.vars.example` には実値を書かず、Secretを `VITE_*` 変数やフロントエンドへ渡さないでください。
設定が不足・不正な場合、認証APIは `503 AUTH_NOT_CONFIGURED` を返します。認証必須APIへのCookieなしのアクセスは401です。

### 認証schemaとmigration

`src/worker/db/auth-schema.ts` はBetter Auth 1.7.7の公式CLI（npm package `auth`）で生成した、`user` / `session` / `account` / `verification` のschemaです。
`src/worker/db/schema.ts` から再exportし、既存3テーブルと同じD1で使います。追加SQLは `drizzle/0001_even_microbe.sql` です。
初回は生成済みmigrationを適用するだけで利用できます。

```sh
npm run db:migrate:local
npm run cf-typegen
npm run dev
```

Better Authを更新・設定変更してschemaの再生成が必要な場合：

```sh
npm run auth:generate
npm run db:generate
npm run db:migrate:local
```

`auth:generate` は認証情報やD1接続が不要なCLI専用設定を使用します。runtimeでは `createAuth(c.env)` が実際のbindingとSecretを使用します。
生成したschemaとSQLを確認し、Git管理します。`auth migrate` はDrizzle構成では使いません。

### 認証APIとmiddleware

| API | 用途 |
| --- | --- |
| `POST /api/auth/sign-in/social` | Googleログイン開始 |
| `GET /api/auth/callback/google` | Googleのcallback（Better Authが処理） |
| `GET /api/auth/get-session` | Better Auth標準のセッション取得 |
| `POST /api/auth/sign-out` | ログアウト、D1セッションを失効 |
| `GET /api/me` | 認証必須。id / name / email / image / createdAt / updatedAtのみを返す |

`requireAuth` はセッションを検証し、未ログイン時はJSONの401を返します。ログイン済みの場合は `c.get("user")` と `c.get("session")` が型安全に取得できます。保護されたレスポンスは `Cache-Control: no-store`、セッション更新時のSet-Cookieも返します。
Memo / Labelの各routeで `use("*", requireAuth)` を適用しており、末尾スラッシュなしのパスも保護します。既存のHonoのstrict routingは維持し、未定義の末尾スラッシュ付きrouteは認証後404です。`/api/auth/*` 自体にこのmiddlewareは適用しません。

Workerで認証必須routeを追加する例：

```ts
import { Hono } from "hono";
import { requireAuth } from "./middleware/auth";
import type { WorkerEnv } from "./types";

const app = new Hono<WorkerEnv>();
app.get("/api/example", requireAuth, (c) => {
  const user = c.get("user");
  return c.json({ userId: user.id });
});
```

### ローカルでのログイン確認

上記の設定・migrationを済ませて `npm run dev` を起動し、`http://localhost:5173` を開きます。UIは追加していません。
開発中はブラウザのDevTools Consoleから、最小限のReact clientを読み込んで確認できます（Vite dev専用）。

```js
const { authClient } = await import("/src/react-app/lib/auth-client.ts");
await authClient.signIn.social({ provider: "google", callbackURL: "/" });
```

Googleログインから戻ったら、Consoleで次を実行してユーザー情報を確認します。

```js
await fetch("/api/me").then((response) => response.json());
```

ログアウト確認ではclientを再読み込みし、`await authClient.signOut()` を実行します。その後 `/api/me`、`/api/memos`、`/api/labels` が401になることを確認します。
Cookieベースの同一オリジン通信を使い、session tokenをlocalStorageへ保存しません。

自動テスト：

```sh
npm run test:auth
```

ビルドしたWorkerをMiniflareで起動し、独立した一時D1へmigrationを適用します。既存データの保持、未ログインの401、ログイン済みのアクセス、レスポンスの項目、期限切れ、Cookie更新、ログアウト、Googleログイン開始を確認します。
テスト用ログインにはBetter Auth公式のtest-utilsを使用し、本番Workerには含めません。実際のGoogleアカウントでのcallback完了は上記手順で確認してください。

### 本番公開前

本番D1の実際のIDを `wrangler.json` に設定し、`npm run db:migrate:remote` で認証migrationも適用します。
本番用Google OAuth Clientには公開URLのcallbackを登録します。Workers Secretsを以下の4つ設定してください（コマンドは入力を求めます）。

```sh
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
```

`BETTER_AUTH_SECRET` は本番用の別のランダム値、`BETTER_AUTH_URL` は公開先のHTTPSオリジン（例：`https://<app>.workers.dev`）にします。
Wranglerの `secrets.required` は必要な名前のみを宣言しています。実値を設定ファイルへ書かず、`.dev.vars` が本番へ自動で登録される前提にしないでください。
`wrangler secret put` はCloudflare側の設定を変更するコマンドです。設定後に `npm run cf-typegen`、`npm run build`、`npm run deploy` を実行します。
ローカルと本番のD1・OAuth Client・Secretはそれぞれ独立しています。

参考：[Better Auth Hono](https://better-auth.com/docs/integrations/hono)、[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[公式CLI](https://better-auth.com/docs/concepts/cli)、[Google provider](https://better-auth.com/docs/authentication/google)、[Google OAuth Web application](https://developers.google.com/identity/protocols/oauth2/web-server)、[Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。
