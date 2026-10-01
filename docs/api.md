# API

## 概要

APIはすべて `/api` 配下に配置する。

認証には Better Auth + Google OAuth を使用する。  
メモに関するAPIはログイン必須とし、ログイン中のユーザー自身のデータのみ操作できるものとする。

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
500 Internal Server Error
```