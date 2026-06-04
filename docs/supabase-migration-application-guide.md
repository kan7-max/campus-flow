# 本番Supabase migration適用手順

## 重要

Codexは本番Supabaseへmigrationを勝手に適用しない。

この手順は、ユーザーがSupabase SQL Editorで手動適用するための案内。

## 未適用migration

以下を順番に適用する。

1. `supabase/migrations/20260430_sync_outbox.sql`
2. `supabase/migrations/20260430_work_sessions.sql`
3. `supabase/migrations/20260430_study_blocks.sql`
4. `supabase/migrations/20260430_assignment_steps.sql`

## 適用手順

1. Supabase Dashboardを開く
2. 対象プロジェクトを選ぶ
3. `SQL Editor` を開く
4. migrationファイルを1つずつ開き、内容をSQL Editorへ貼り付ける
5. 実行前に対象プロジェクトが本番で正しいか確認する
6. SQLを実行する
7. エラーが出た場合は次のmigrationへ進まず、エラー内容を控える
8. 4ファイルすべて完了後、Table Editorでテーブル作成を確認する

## 適用後に確認すること

- `sync_outbox` が存在する
- `work_sessions` が存在する
- `study_blocks` が存在する
- `assignment_steps` が存在する
- 各テーブルのRLSが有効
- 自分の `user_id` のデータだけ見える
- 他ユーザーの課題、作業ブロック、作業セッション、ステップが見えない

## アプリ側の確認

1. `TASKFLOW_DEMO_MODE` なしの本番相当環境でログイン
2. 課題を1件作成
3. 課題詳細を開く
4. 作業チェックリストが表示される
5. 25分作業セッションを開始できる
6. `/today` に作業ブロックが表示される
7. Google Calendar同期失敗時も課題本体が保存される

## 失敗時の扱い

以下のようなエラーが出ても、アプリの課題保存本体は壊さない設計を維持する。

- `relation does not exist`
- RLS policy不足
- Calendar同期失敗
- study block生成失敗
- assignment step生成失敗

ユーザー向けには日本語で、課題本体は保存されていることを伝える。
