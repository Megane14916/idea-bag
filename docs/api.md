# API

## 概要

APIはすべて `/api` 配下に配置する。

認証には Better Auth + Google OAuth を使用する。  
Memo / Label APIはすべてログイン必須とし、ログイン中のユーザー自身のデータのみ操作できるものとする。

---

## Authentication

認証関連の処理は Better Auth の `/api/auth/*` を使用する。

### Googleログイン

```http
POST /api/auth/sign-in/social
```

Google OAuthを使用してログインする。

### ログアウト

```http
POST /api/auth/sign-out
```

### セッション取得

```http
GET /api/auth/get-session
```

---

## Memo

### メモ一覧取得

```http
GET /api/memos
```

### Query Parameters

```text
q        検索文字列
labelId  ラベルID
```

例：

```http
GET /api/memos?q=ハッカソン&labelId=label_1
```

### Response

```json
[
  {
    "id": "memo_1",
    "title": "ハッカソン案",
    "content": "アイデア管理アプリ",
    "sourceMemoId": null,
    "order": 0,
    "labels": [
      {
        "id": "label_1",
        "name": "開発"
      }
    ],
    "createdAt": "2026-10-01T10:00:00Z",
    "updatedAt": "2026-10-01T10:00:00Z"
  }
]
```

検索対象は `title` と `content` とする。

一覧は `order` 昇順（同値はID順）。`q` はSQLiteの `LIKE` による部分一致で、ASCII英字の大文字小文字は区別しない。`%`・`_`・`\` は通常の文字として検索する。空の `q` は検索条件なしとする。
`labelId` は自分のラベルが付いたメモだけを対象にし、存在しないIDや他ユーザーのIDでは空配列を返す。`q` と `labelId` はAND条件で併用できる。
同じquery parameterの複数指定、空文字・空白のみの `labelId` は400。

---

### メモ取得

```http
GET /api/memos/:id
```

---

### メモ作成

```http
POST /api/memos
```

### Request

```json
{
  "title": "ハッカソン案",
  "content": "アイデア管理アプリ",
  "labelIds": ["label_1"]
}
```

### Response

```http
201 Created
```

```json
{
  "id": "memo_1",
  "title": "ハッカソン案",
  "content": "アイデア管理アプリ",
  "order": 0,
  "sourceMemoId": null,
  "labels": [
    {
      "id": "label_1",
      "name": "開発"
    }
  ],
  "createdAt": "2026-10-01T10:00:00Z",
  "updatedAt": "2026-10-01T10:00:00Z"
}
```

---

### メモ編集

```http
PATCH /api/memos/:id
```

### Request

変更したい項目のみ送信する。

```json
{
  "title": "新しいタイトル",
  "content": "更新した内容",
  "labelIds": ["label_1", "label_2"]
}
```

---

### メモ削除

```http
DELETE /api/memos/:id
```

### Response

```http
204 No Content
```

---

### メモ並べ替え

```http
PATCH /api/memos/order
```

### Request

表示順にメモIDを送信する。

```json
{
  "memoIds": [
    "memo_3",
    "memo_1",
    "memo_2"
  ]
}
```

---

### AIでメモを発展させる

```http
POST /api/memos/:id/expand
```

認証必須。Request bodyは不要。元MemoのIDとログインユーザーの所有権を確認し、存在しない・他ユーザー所有の場合は404 `MEMO_NOT_FOUND`。
Workers AIで異なる方向性の候補を3件生成し、200で返す。この時点では新しいMemoをD1へ保存しない。候補の一時保存も行わない。

```json
{
  "candidates": [
    { "title": "共同編集できるアイデア管理", "content": "複数人でアイデアを育て、変更点を共有する。" },
    { "title": "授業で使うアイデア管理", "content": "生徒が発想を共有し、相互に意見を付ける。" },
    { "title": "振り返り付きアイデア管理", "content": "過去のメモから次の行動を提案する。" }
  ]
}
```

候補は正確に3件。title/contentは空白だけでないstringで、titleは100文字以内、contentは500文字以内（Unicodeコードポイント数）。前後の空白は除去する。
AIのJSON・形式・件数・文字列・長さをサーバーで検証する。AI呼び出し失敗、不正JSON、不正候補、出力打ち切りは502 `AI_GENERATION_FAILED`。失敗時にもMemoは保存しない。

### 選択した発展案を保存する

```http
POST /api/memos/:id/expand/accept
```

`:id` は元MemoのID。認証必須。元Memoの所有権を再確認し、保存SQLでも検証する。他ユーザー所有・存在しない場合は404。

```json
{
  "title": "共同編集できるアイデア管理",
  "content": "複数人でアイデアを育て、変更点を共有する。"
}
```

title/contentは空白だけでないstring必須。前後の空白を除去する。不正JSON・型不正・空文字は400 `VALIDATION_ERROR`。
指定された1件だけを新しいMemoとして保存し、通常のMemo形式を201で返す。

```json
{
  "id": "new_memo_id",
  "title": "共同編集できるアイデア管理",
  "content": "複数人でアイデアを育て、変更点を共有する。",
  "sourceMemoId": "source_memo_id",
  "order": 1,
  "labels": [],
  "createdAt": "2026-10-02T00:00:00.000Z",
  "updatedAt": "2026-10-02T00:00:00.000Z"
}
```

user_idはセッションのユーザー、source_memo_idはURLの元Memo、order_indexはユーザーの現在の最大値+1。日時は保存時に設定する。
bodyのuserId/sourceMemoId/order/labelIdsなどは使用しない。元Memoのラベルはコピーしない。
候補はブラウザからtitle/contentを送り直すstateless設計で、生成内容との完全一致は証明しない。内容を変更して保存することも許容する。
元Memoを削除しても発展Memoは残り、そのsourceMemoIdはnullになる。通常MemoもsourceMemoIdはnull。

モデル名は `src/worker/services/idea-expander.ts` の定数で管理する。メモのtitle/contentだけを入力データとし、本文の命令に従わず、異なる方向の具体案を作るよう指示する。
出力はJSONのみ、最大1800 completion tokens、thinking/streamingは無効。Gemmaは[公式JSON Mode対応一覧](https://developers.cloudflare.com/workers-ai/features/json-mode/#supported-models)に未記載のため、JSON Modeに依存しない。
[モデル公式仕様](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/)のchat completion形式を解析する。

---

## Label

### ラベル一覧取得

```http
GET /api/labels
```

### Response

```json
[
  {
    "id": "label_1",
    "name": "開発"
  },
  {
    "id": "label_2",
    "name": "面白そう"
  }
]
```

---

### ラベル作成

```http
POST /api/labels
```

### Request

```json
{
  "name": "開発"
}
```

---

### ラベル編集

```http
PATCH /api/labels/:id
```

### Request

```json
{
  "name": "技術"
}
```

---

### ラベル削除

```http
DELETE /api/labels/:id
```

---

## Error

エラー形式は統一する。

```json
{
  "error": {
    "code": "MEMO_NOT_FOUND",
    "message": "Memo not found"
  }
}
```

主なHTTPステータスコード：

```text
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error
502 Bad Gateway
```

## Memo / Label APIの補足

| API | 成功時のステータス / 本文 |
| --- | --- |
| `GET /api/memos` | 200 / `Memo[]` |
| `GET /api/memos/:id` | 200 / ラベルを含む `Memo` |
| `POST /api/memos` | 201 / 作成した `Memo` |
| `POST /api/memos/:id/expand` | 200 / `ExpandIdeaResponse`（3候補、DB保存なし） |
| `POST /api/memos/:id/expand/accept` | 201 / 選択した候補の新しい `Memo` |
| `PATCH /api/memos/:id` | 200 / 更新した `Memo` |
| `DELETE /api/memos/:id` | 204 / 本文なし |
| `PATCH /api/memos/order` | 204 / 本文なし |
| `GET /api/labels` | 200 / `Label[]`（名前、IDの昇順） |
| `POST /api/labels` | 201 / 作成した `Label` |
| `PATCH /api/labels/:id` | 200 / 更新した `Label` |
| `DELETE /api/labels/:id` | 204 / 本文なし |

- Memo作成時の `title`・`content` はstring必須（空文字は可）。`labelIds` は任意のstring配列。表示順はユーザーの現在の最大値 + 1（最初は0）。
- Memo編集は `title`・`content`・`labelIds` の指定項目だけを更新し、`updatedAt` を更新する。`labelIds` の省略は関連を維持し、指定時は全置換、空配列は全解除。作成・編集の本文更新とラベル関連更新はD1 batchで原子的に行う。
- `labelIds`・`memoIds` は空文字・空白のみのID、string以外、重複IDを拒否する。Memo削除は関連も削除する。Label削除は関連だけを削除し、Memo本体は残す。
- 並べ替えはユーザーの全Memo IDをちょうど1回ずつ送信し、配列順に0から番号を付ける。空の一覧には空配列を送信できる。`updatedAt` も更新する。
- Labelの `name` はstring必須で前後の空白を除去する。空文字・空白のみは拒否する。同一ユーザーの同名ラベルは409（大文字小文字は区別）。別ユーザーには同名を許可する。
- Request bodyはJSON object必須。不正JSON・型不正は400。未定義のbody項目は使用しない。`userId` や `order` をbodyで指定しても反映しない。

| エラーコード | HTTP | 条件 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | 不正なbody/query/ID、全件を満たさない並べ替え |
| `UNAUTHORIZED` | 401 | 未ログイン・無効なセッション |
| `MEMO_NOT_FOUND` | 404 | Memoが存在しない、または所有者が異なる |
| `LABEL_NOT_FOUND` | 404 | 操作対象または指定したLabelが存在しない、または所有者が異なる |
| `DUPLICATE_LABEL` | 409 | 同一ユーザーに同名Labelが存在する |
| `MEMO_ORDER_CONFLICT` | 409 | 並べ替え検証後にMemo一覧が変化した（再取得して再送） |
| `INTERNAL_SERVER_ERROR` | 500 | 内部エラー（DB詳細・stack traceは返さない） |
| `AI_GENERATION_FAILED` | 502 | AI呼び出し失敗・不正JSON・不正な候補・出力打ち切り |

実装で参照した公式仕様：[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)、[D1 limits](https://developers.cloudflare.com/d1/platform/limits/)、[Drizzle batch](https://orm.drizzle.team/docs/batch-api)。
