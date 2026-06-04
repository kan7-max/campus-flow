# 2026-05-07 Today反映安定化メモ

## 今回の目的

AI / Inboxで保存した直近締切の課題が、`/today` で見落とされにくい状態にする。

## 変更したファイル

- `src/lib/services/todayCommandService.ts`
- `src/components/dashboard/today-command-center.tsx`
- `docs/update-memos/2026-05-07-today-recent-captures.md`

## 変更内容

- 作成から24時間以内で、締切が3日以内の課題を `recentCaptures` として抽出
- 直近締切の新規課題には、Today優先度スコアへ小さな補正を追加
- Home / Today に `新しく整理した課題` セクションを追加
- すでに `今日やること` に出ている課題は重複表示しないように調整
- AI / Inbox保存直後に、保存結果が `/today` に見えやすくなるように改善

## 確認結果

- `qa:mvp` で `/today reflects at least one saved assignment` がPASS
- `qa:inbox` で `/today reflects saved inbox candidate` がPASS
- `/today` HTTP 200
- `/dashboard` HTTP 200
- QA用データ残り0件

## 実行コマンド

- `npm run lint` OK
- `npm run typecheck` OK
- `npm run qa:mvp` OK
- `npm run qa:inbox` OK
- `npm run check` OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` OK
- `npm run qa:cleanup` OK

## 進捗

今回のMVP中核フロー安定化は約92%完了。

## 残っている課題

- `/ai` の保存後UIを、候補単位でさらに分かりやすくできる余地あり
- スマホ幅で `新しく整理した課題` が出た時の見え方は、追加で目視確認したい
- 本番Supabase未適用migrationがあるため、本番ではSQL適用手順の案内が必要

## 次に優先すべき作業

1. `/ai` 保存後の候補別保存済み表示の最終確認
2. スマホ幅で `/today`, `/dashboard`, `/ai`, `/inbox` を目視QA
3. MVP完了前の残タスク整理と引き継ぎメモ更新
