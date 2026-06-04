# 2026-05-07 Today表示順調整メモ

## 今回の目的

`/today` で `今はこれだけ` を `今日のタイムライン` より上に表示し、画面を開いた直後に次の行動が分かるようにする。

## 変更したファイル

- `src/components/dashboard/today-command-center.tsx`
- `docs/update-memos/2026-05-07-today-next-block-order.md`

## 変更内容

- Today画面の表示順を変更
  - 変更前: 現在の作戦 → 今日のタイムライン → 今日やること → 今はこれだけ
  - 変更後: 現在の作戦 → 今はこれだけ → 今日のタイムライン → 今日やること
- Dashboard側の表示順は維持
- UI全面刷新はせず、コンポーネントの並び替えだけで対応

## 確認結果

- `/today` HTTP 200
- `今はこれだけ` 表示あり
- `今日のタイムライン` 表示あり

## 実行コマンド

- `npm run lint` OK
- `npm run typecheck` OK

## 次に優先すべき作業

- スマホ幅で `/today` の上部表示を目視確認
- 問題なければMVP最終QAへ進む
