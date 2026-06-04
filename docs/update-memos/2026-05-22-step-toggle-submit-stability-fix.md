# 2026-05-22 Step Toggle Submit Stability Fix

## 目的
- スマホで作業チェックリストの完了/戻すボタンが不安定になる要因を除去する。

## 修正内容
- `src/components/assignments/assignment-step-panel.tsx`
  - submit ボタン押下時に先行 `setState` を行っていた optimistic 更新を削除。
  - 表示ソースを `localSteps` からサーバー由来 `steps` に統一。
  - hidden input の `done` 値が submit 前に反転する競合を防止。

## 検証
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run check`: pass
