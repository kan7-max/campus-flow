# 2026-05-22 Button Reactivity Form Fallback

## 症状
- スマホでチェックリスト丸ボタン、作業ブロック操作（25分開始/完了/明日/戻す）が反応しない。
- 長押しでも反応しないケースが発生。

## 対応方針
- クリックイベント依存を減らし、`form + Server Action` に統一。
- JavaScript が不安定でも送信自体は成立する（progressive enhancement）経路を優先。

## 変更ファイル
- `src/components/assignments/assignment-step-panel.tsx`
- `src/components/assignments/study-block-inline-actions.tsx`

## 変更内容
- `assignment-step-panel`:
  - `use client` と `onClick` ベースの丸ボタン切替を廃止。
  - 丸ボタン/戻すを `toggleAssignmentStepAction` のフォーム送信へ変更。
  - 並び替えは既存フォーム送信を維持。
- `study-block-inline-actions`:
  - `use client` と `useTransition` を廃止。
  - `25分開始/完了/明日/戻す` を各 Server Action フォーム送信へ変更。
  - 詳細リンクは維持。

## 実行コマンド
- `npm run lint` : OK
- `npm run typecheck` : OK
- `npm run check` : OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` : OK

## 期待効果
- タップ時の操作がクライアントイベントに依存しにくくなり、スマホ実機での無反応を抑制。
- Hydration やクライアント側不安定時でも操作が通る確率を改善。
