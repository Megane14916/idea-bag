# Architecture

## 概要

本プロジェクトでは、フロントエンドとバックエンドを同一リポジトリ・同一オリジンで構成する。

フロントエンドには React + TypeScript + Vite、バックエンドには Hono + Cloudflare Workers を使用する。データベースには Cloudflare D1 を使用する。

```text
Cloudflare Workers
│
├─ Static Assets
│  └─ React + TypeScript + Vite
│
└─ /api/*
   └─ Hono
      ├─ Authentication
      └─ D1
```

## 技術スタック

### Frontend

- React
- TypeScript
- Vite

### Backend

- Hono
- Cloudflare Workers

### Database

- Cloudflare D1

### Authentication

- Better Auth
- Google OAuth

## 同一オリジン構成

フロントエンドとバックエンドは同じオリジンから配信する。

ローカル環境では、例えば以下のようになる。

```text
http://localhost:5173/
```

```text
/              → React
/ideas         → React
/api/ideas     → Hono
/api/auth/*    → Hono / Better Auth
```

本番環境でも同様に、Cloudflare Workers Static Assetsを利用して同一オリジンから配信する。

```text
https://<app-name>.<subdomain>.workers.dev/
```

```text
/              → React
/api/*         → Hono
```

そのため、フロントエンドからAPIを呼び出す際はホスト名を指定せず、相対URLを使用する。

```ts
fetch("/api/ideas")
```

以下のような環境依存のURLは原則使用しない。

```ts
fetch("http://localhost:8787/api/ideas")
```

これにより、ローカル環境と本番環境で同じコードを利用できる。

## API

バックエンドAPIはすべて `/api` 配下に配置する。

例：

```text
GET    /api/ideas
GET    /api/ideas/:id
POST   /api/ideas
PATCH  /api/ideas/:id
DELETE /api/ideas/:id
```

フロントエンド側のルーティングと衝突しないよう、APIには必ず `/api` プレフィックスを付ける。

## 認証

認証には Better Auth と Google OAuth を使用する。

認証関連のエンドポイントは以下に配置する。

```text
/api/auth/*
```

Google OAuthのコールバックも同一オリジン上に配置する。

ローカル：

```text
http://localhost:5173/api/auth/callback/google
```

本番：

```text
https://<app-name>.<subdomain>.workers.dev/api/auth/callback/google
```

ログイン状態はCookieベースのセッションで管理する。

フロントエンド側でJWTなどをlocalStorageに保存する方式は使用しない。

## データベース

Cloudflare D1を使用する。

ローカル開発ではWranglerが提供するローカルD1を使用し、本番環境ではCloudflare上のD1を使用する。

```text
Local
Hono
 ↓
Local D1

Production
Hono
 ↓
Cloudflare D1
```

ローカル開発中に本番D1を直接使用しない。

## ディレクトリ構成

基本的に以下の構成とする。

```text
src/
├─ react-app/
│  ├─ components/
│  ├─ features/
│  └─ ...
│
├─ worker/
│  ├─ routes/
│  ├─ middleware/
│  ├─ services/
│  ├─ db/
│  └─ index.ts
│
└─ shared/
   ├─ types/
   └─ constants/
```

### `react-app`

フロントエンド専用のコードを配置する。

### `worker`

Hono、D1、認証などバックエンド専用のコードを配置する。

### `shared`

フロントエンド・バックエンドの両方から利用する型や定数を配置する。

## 型の共有

APIを通してやり取りするデータ型は `src/shared` に配置する。

例：

```ts
export type Idea = {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}
```

一方、D1やDrizzleなどバックエンド内部でのみ使用する型は `src/worker` 側に配置し、フロントエンドとは共有しない。

```text
APIで利用する型
→ src/shared

DB内部の型
→ src/worker

React内部のみで利用する型
→ src/react-app
```

## 開発方針

フロントエンドとバックエンドは実装上の責務を分離するが、デプロイとオリジンは統合する。

```text
コード
React | Hono
  ↓      ↓
明確に分離

デプロイ
React + Hono
     ↓
Cloudflare Workers
```

フロントエンド担当とバックエンド担当は、主に以下を共通仕様として扱う。

- APIのURL
- Request形式
- Response形式
- エラー形式
- 認証方式
- APIで使用する共通型

バックエンド内部のDB設計やService層などは、API仕様を変更しない限りフロントエンドから独立して変更できるものとする。