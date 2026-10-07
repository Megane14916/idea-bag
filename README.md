# Idea Bag

アイデアをメモとして保存・整理し、AIで発展案を生成できるWebアプリです。

## 使用技術

- フロントエンド：React / TypeScript / Vite
- バックエンド：Hono / Cloudflare Workers
- データベース：Cloudflare D1 / Drizzle ORM
- 認証：Better Auth / Google OAuth
- AI：Workers AI / Gemma 4

## システム構成

ReactとAPIを同一のCloudflare Workerから配信します。

```text
ブラウザ → React
         → Hono API → D1
                    → Google OAuth（Better Auth）
                    → Workers AI
```

## ディレクトリ構成

```text
src/
├─ react-app/    # フロントエンド
├─ worker/       # API・認証・DB・AI処理
└─ shared/       # 共通の型

drizzle/         # マイグレーション
public/          # 静的ファイル
tests/           # テスト
docs/            # 詳細ドキュメント
```

## 開発環境構築

### 前提条件

- Node.js 22.12以上 / npm
- Cloudflareアカウント
- Google OAuthクライアント（Web application）

### セットアップ

1. `npm ci` で依存関係をインストールします。
2. `wrangler.jsonc.example` を `wrangler.jsonc` にコピーします（作成済みなら不要）。
3. `.dev.vars.example` を `.dev.vars` にコピーし、環境変数を設定します。
4. Google OAuthのリダイレクトURIに `http://localhost:5173/api/auth/callback/google` を登録します。
5. 以下を実行します。

```sh
npx wrangler login
npm run db:migrate:local
npm run cf-typegen
npm run dev
```

[http://localhost:5173](http://localhost:5173) で開きます。DBはローカル、AI推論はCloudflare上で実行します。

## 環境変数

`.dev.vars` に設定します。

| 変数名 | 値 |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `BETTER_AUTH_SECRET` | 32文字以上のランダムな文字列 |
| `BETTER_AUTH_URL` | `http://localhost:5173` |

## デプロイ

1. 本番D1を作成し、`wrangler.jsonc` の `REPLACE_WITH_D1_DATABASE_ID` を自分のDBのIDに置き換えます（設定済みなら不要）。
2. `.env.production` に上記4項目の本番用の値を設定します。`BETTER_AUTH_URL` は公開先のHTTPSオリジンにします。
3. Google OAuthに `<公開先のオリジン>/api/auth/callback/google` を登録します。

```sh
# D1未作成の場合のみ
npx wrangler d1 create idea-bag-db

# 設定後に実行
npm run cf-typegen
npm run db:migrate:remote
npm run build
npm run deploy -- --secrets-file .env.production
```

環境変数はWorkers Secretsとして登録されます（[公式ドキュメント](https://developers.cloudflare.com/workers/configuration/secrets/#upload-secrets-alongside-code)）。
