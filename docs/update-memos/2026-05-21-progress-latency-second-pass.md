# 2026-05-21 Progress Latency Second Pass

## 目的
- スマホ実機で「進捗ボタン押下後の反映が遅い」問題の体感改善

## 実施内容
- `src/lib/repositories/assignmentRepository.ts`
  - `updateProgressAndStatus` を軽量化
  - 既存の「1回取得 + upsert一式」から、「progress/statusのみ直接update」に変更

- `src/app/(app)/assignments/[id]/page.tsx`
  - 進捗表示部分をクライアント側の即時反映コンポーネントへ切替

- `src/components/assignments/assignment-progress-panel.tsx`（新規）
  - 押下直後に進捗バー・%表示を更新（楽観更新）
  - 保存失敗時はロールバックして日本語エラー表示

- `src/components/assignments/assignment-progress-buttons.tsx`
  - `router.refresh()` を外し、再描画待ちを削減

## 確認結果
- `npm run lint` : PASS
- `npm run typecheck` : PASS
- `npm run check` : PASS

## 実機確認ポイント
- 課題詳細 `/assignments/[id]` の進捗バーが押下直後に変わること
- 失敗時に元の値へ戻ること
