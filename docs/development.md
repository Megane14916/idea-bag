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

認証の変数は将来のBetter Auth / Google OAuth用です。今回は空欄のままで起動できます。
本物のSecretは `.dev.vars` にのみ記載してください。`.dev.vars*` は既存の `.gitignore` で除外され、exampleのみGit管理対象です。

## ローカル開発

```sh
npm run db:migrate:local
npm run cf-typegen
npm run dev
```

ViteとCloudflare ViteプラグインがReactとWorkerを同じオリジン（通常 `http://localhost:5173`）で起動します。
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

スキーマは `src/worker/db/schema.ts`、SQLとDrizzleのメタデータは `drizzle/` に配置します。初期migrationは生成済みです。
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

`memos.user_id` と `labels.user_id` は将来のBetter Auth user IDを保存します。
認証テーブル・user外部キーはBetter Auth導入時に追加します。今回の `User` はAPI用の型のみです。
指定されたMemo / Labelの9ルートは、暫定的にHTTP 501と `{ "message": "Not implemented" }` を返します。
既存の `/api/` は維持しています。認証、CRUD、検索、並べ替え、ラベル付け、UI機能は未実装です。

参考：[Cloudflare Vite構成](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)、[D1 migration](https://developers.cloudflare.com/d1/reference/migrations/)、[Drizzle設定](https://orm.drizzle.team/docs/drizzle-config-file)。
