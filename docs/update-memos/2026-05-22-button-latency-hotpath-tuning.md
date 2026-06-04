# 2026-05-22 Button Latency Hotpath Tuning

## 目的
- ボタン押下後の反映ラグを短縮する。
- 既存機能を壊さず、再検証範囲を最小化する。

## 実施内容
- `sourcePath` をホット系 Server Action に追加し、操作元ページを優先して `revalidatePath` するように調整。
- チェックリスト切替で毎回 `listAssignmentSteps` を再取得する処理を削減し、クライアント計算した `nextProgress` を利用。
- チェックリスト丸ボタンに optimistic 表示を追加（押下直後に見た目を更新）。
- 作業ブロック操作に `sourcePath` / `nextProgress` を追加し、無駄な再取得を抑制。

## 変更ファイル
- `src/lib/actions/assignmentActions.ts`
- `src/components/assignments/assignment-step-panel.tsx`
- `src/components/assignments/study-block-inline-actions.tsx`
- `src/components/assignments/assignment-quick-actions.tsx`
- `src/components/assignments/assignment-progress-panel.tsx`
- `src/components/assignments/assignment-minimal-card.tsx`
- `src/components/dashboard/today-command-center.tsx`
- `src/app/(app)/assignments/[id]/page.tsx`

## 検証
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run check` ✅
- `npm run build -- --no-lint` は時間短縮のため今回未実施（途中中断）。

## 補足
- 中断後に残っていた `next build` の `node` プロセス4本を停止済み。
