# 2026-05-22 Mobile Action Button Reactivity Pass

## 目的
- スマホで「長押ししないと反応しない / 反応しない」状態になっていた以下を修正
  - 課題詳細の作業チェックリスト丸ボタン
  - Today / 課題詳細の作業ブロック (`25分開始` / `完了` / `明日` / `戻す`)

## 変更内容（最小変更）
- `src/components/assignments/assignment-step-panel.tsx`
  - 丸ボタンの実行経路をフォーム送信依存からクライアント実行に変更。
  - 押下時に楽観更新し、失敗時は復元。
  - 反映待ち表示（`反映中...`）を追加。
- `src/components/assignments/study-block-inline-actions.tsx`（新規）
  - 作業ブロック操作をクライアントから直接 Server Action 呼び出しに統一。
  - 失敗時はカード内エラー文を表示。
- `src/components/dashboard/today-command-center.tsx`
  - 作業ブロック操作UIを新コンポーネントに置換。
- `src/app/(app)/assignments/[id]/page.tsx`
  - 作業ブロック操作UIを新コンポーネントに置換。

## 実行コマンド
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅

## 備考
- Supabase 側の `assignment_steps / study_blocks / work_sessions` は存在し、RLS/GRANT も確認済み。
- 反応遅延の主因は「フォーム送信経路の不安定さ」と判断し、該当ボタンのみ実行経路を切り替えた。
