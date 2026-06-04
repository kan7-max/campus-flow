# 2026-05-22 Progress Button Submit Path Fix

## 目的
- スマホで進捗 `%` ボタンが押下後に反映しない問題を解消する。

## 問題
- クライアント fetch 経路に依存しており、環境差分やデプロイ遅延時に更新が不安定になるケースがあった。

## 修正
- `src/components/assignments/assignment-progress-panel.tsx`
  - 進捗更新を `form action={setAssignmentProgressAction}` に統一。
  - 各 `%` ボタンは submit でサーバー更新する。
  - `onClick` で optimistic 表示は維持。
  - `useTransition` と fetch 依存を除去。

## 検証
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run check`: pass
