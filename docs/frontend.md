# フロントエンド

Idea BagのReact UIは、既存のHono APIとBetter Auth clientを同一オリジンで利用します。API、認証方式、DB schema、Workers bindingsの変更はありません。

## ファイルと画面

- `src/react-app/App.tsx`: セッション確認画面、Googleログイン画面、ヘッダー・検索・ラベル一覧・メモカードを持つメイン画面。
- `src/react-app/components/Modal.tsx`: native dialogによるフォーカス制御、Escape・閉じるボタン。
- `src/react-app/components/MemoEditor.tsx`: タイトル・本文・ラベルの作成／編集、削除確認。
- `src/react-app/components/LabelEditor.tsx`: ラベル作成／名前変更、メモを残す削除確認。
- `src/react-app/components/IdeaExpansion.tsx`: AI生成中表示、3候補比較、再生成、1件の選択保存、キャンセル。
- `src/react-app/hooks/useSession.ts`: loading / authenticated / unauthenticated、セッション再確認、ログアウト。
- `src/react-app/hooks/useCollection.ts`: loading / error / 再取得、AbortControllerによる古い取得結果の抑止。
- `src/react-app/hooks/useWorkspace.ts`: 検索の300ms debounce、ラベル絞り込み、保存後の一覧更新、並べ替え。
- `src/react-app/App.css`・`index.css`: PCのサイドバーとカード一覧、モバイルの開閉式ラベル一覧、レスポンシブなダイアログ。
- `index.html`・`public/idea-bag.svg`: 日本語、Idea Bagのタイトル、袋のfavicon。
- `tests/frontend.test.mjs`・`package.json`: API clientのテストと `npm run test:frontend`。

## API clientと共通型

`api/client.ts` は同一オリジンのfetch、JSON、204、エラーの日本語化、401の再確認イベントを扱います。サーバーのmessageやstack traceは画面へ表示しません。
`api/memos.ts` は一覧・CRUD・並べ替え・発展案生成／選択保存、`api/labels.ts` はラベルCRUD、`api/auth.ts` は既存 `lib/auth-client.ts` を介したセッション・Googleログイン・ログアウトを扱います。

`src/shared/types` の `Memo`、`Label`、`User`、`CreateMemoRequest`、`UpdateMemoRequest`、`ReorderMemosRequest`、`CreateLabelRequest`、`UpdateLabelRequest`、`ExpandedIdeaCandidate`、`ExpandIdeaResponse`、`AcceptExpandedIdeaRequest` を利用します。Better Authのユーザー日時は `User` のISO文字列へ変換します。

## 操作と更新

- メモ作成／編集はタイトル・本文・選択した `labelIds` を既存POST／PATCHへ送信。削除は確認後にDELETE。成功時に一覧へ反映し、サーバーから再取得します。ページ全体のreloadはありません。
- ラベル作成／変更／削除も既存APIを使い、ラベル一覧とメモの表示を更新します。選択中のラベルを削除するとラベルフィルタを解除します。
- 検索とラベル絞り込みは `q`・`labelId` を併用してサーバーへ送信。検索仕様はフロント側で再実装しません。
- 並べ替えは上下ボタンで即座に表示を更新し、全Memo IDを表示順で `/api/memos/order` へ送信。失敗時は元の順序へ戻しエラーを表示します。検索・絞り込み中、一覧取得失敗時、通信中は無効です。
- AIは `/expand` の3候補をブラウザ内だけに保持。再生成は候補を置き換えます。選択した1件のtitle/contentのみを `/expand/accept` へ送信し、成功時に閉じて新しいメモを一覧へ追加します。キャンセルでは保存しません。生成中・保存中の重複操作を防ぎます。
- 検索・絞り込み中に新しいメモ／AI案を保存すると、見つけやすいよう条件を解除し「すべてのアイデア」を表示します。編集時は現在の検索条件をサーバーで再評価します。
- 認証失敗401ではセッションを再確認し、未ログインならログイン画面へ戻します。初回のセッション確認に失敗した場合は再試行画面を表示します。

新しい依存パッケージは追加していません。React stateと専用hooks、native dialog、上下ボタンで実装しています。

## 検証

- `npm run typecheck`: 成功。
- `npm run build`: 成功。sandbox内でのesbuildのファイルアクセス拒否を避け、通常権限で実行。
- `npm run lint`: エラー0。既存の `worker-configuration.d.ts` に未使用eslint-disableの警告2件。
- `npm run test:frontend`: 6件成功。相対URL・queryエンコード・204・CRUD形式・選択候補だけの送信・安全なエラー表示・401イベントを検証。
- `npx tsx --test tests/auth.test.mjs`: 既存の22件成功。事前build後に実行。認証、Googleログイン開始、ログアウト、CRUD、検索・ラベル併用、全件並べ替え、生成時非保存、3候補、選択1件保存、400／401／404／409／500／502を検証。

ブラウザの更新操作は、既存Honoコード・実セッション・一時D1を使う127.0.0.1限定の検証サーバーで確認しました。AI応答だけをテスト用に置き換え、通常のlocalhostの既存データとセッションを維持します。検証サーバーは `node_modules/.tmp` に置く一時ファイルで、製品コード／ビルドには含まれません。

実GoogleアカウントによるOAuth callback完了と実Gemmaの生成品質は別途確認が必要です。デプロイはこのタスクには含みません。

### ブラウザで確認した範囲

- 通常のローカルサーバー: ログイン済みセッションの取得、既存メモ一覧の表示、Reactの起動。
- 一時D1の検証サーバー: ラベル付きメモの作成・タイトル／本文の編集・保存後の一覧反映、ラベル作成／名前変更、ラベルと検索の併用、絞り込み解除。
- 上下ボタンによる並べ替えと、500を返した場合の元の順序への復元。
- AI生成中表示、正確に3候補の比較、再生成による入れ替え、選択1件の保存で件数が1件増えること、502の日本語エラー、キャンセル。
- メモ／ラベルの削除確認とキャンセル。削除API自体は自動テストで検証し、ブラウザで最終削除ボタンを押す検証はしていません。
- ログアウトでログイン画面へ戻ること、Googleログインボタンの表示。
- ダイアログを開いた際の入力フォーカス、Escapeで閉じる操作、閉じた後のフォーカス復元。
- 幅390pxでラベル一覧の開閉、ダイアログの幅が画面に収まること、documentの横幅がviewportを超えないこと。

要求された基本機能に未実装項目はありません。実Google OAuth callback完了、実Gemma推論、実端末での操作、ブラウザからの最終削除操作は未確認です。
