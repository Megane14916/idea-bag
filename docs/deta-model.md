# Data Model

## 概要

Cloudflare D1を使用する。

主要なテーブルは以下とする。

```text
users
memos
labels
memo_labels
```

---

## users

Better Authが管理するユーザー情報。

```text
id
name
email
image
created_at
updated_at
```

詳細な認証用テーブルについてはBetter Authのスキーマに従う。

---

## memos

メモ本体を保存する。

```text
id
user_id
title
content
source_memo_id
order_index
created_at
updated_at
```

### カラム

| カラム | 説明 |
|---|---|
| id | メモID |
| user_id | 作成したユーザー |
| title | タイトル |
| content | 本文 |
| source_memo_id | 発展元のMemo ID（通常MemoはNULL） |
| order_index | 表示順 |
| created_at | 作成日時 |
| updated_at | 更新日時 |

1ユーザーが複数のメモを持つ。

`source_memo_id` はnullableな自己参照外部キーで、`ON DELETE SET NULL` とする。
元Memoを削除しても発展Memo本体は残り、参照だけがNULLになる。発展案の生成時点では何も保存しない。
選択された1件を保存するときだけ、所有権を検証した元MemoのIDを設定する。APIでは `sourceMemoId: string | null` を返す。
追加migration `0002_broken_junta.sql` はnullable列を追加し、既存Memoとラベル関連を維持する。

```text
User 1 ─── N Memo
```

---

## labels

ユーザーが作成したラベルを保存する。

```text
id
user_id
name
created_at
updated_at
```

ラベルはユーザーごとに管理する。

APIでは名前の前後の空白を除去し、同一ユーザーの同名ラベルを拒否する（大文字小文字は区別）。既存schemaは変更せず、サービス層の条件付き単一SQLで重複する作成・編集を防ぐ。

```text
User 1 ─── N Label
```

---

## memo_labels

メモとラベルの関連を保存する中間テーブル。

```text
memo_id
label_id
```

1つのメモに複数のラベルを付けることができ、1つのラベルを複数のメモに付けることができる。

```text
Memo N ─── N Label
```

---

## Relationships

```text
User
 ├── N Memo
 │
 │     N
 │     │
 │     N
 │   Label
 │
 └── N Label
```

実際には `memo_labels` を介して関連付ける。

```text
users
  │
  ├── memos
  │      │
  │      └── memo_labels
  │               │
  └── labels ──────┘
```

---

## 補足

APIでは `camelCase` を使用する。

```text
createdAt
updatedAt
labelIds
```

データベースでは `snake_case` を使用する。

```text
created_at
updated_at
label_id
```

APIレスポンスとDB内部の形式はバックエンドで変換する。

`memo_labels` の複合主キーは同じ関連の重複を防ぐ。既存の外部キー `ON DELETE CASCADE` により、Memo / Label削除時に関連も削除する。ラベル関連付けではMemoとLabelの両方の所有ユーザーをAPIで検証する。
