# 2026-05-07 追加作業メモ（本番化前 実行チェックシート）

## 目的

- 「次の作業」を具体化し、本番化前チェックを実運用可能な手順に落とし込む
- 新機能追加なし、既存MVPを壊さずに公開前リスクを減らす

## 追加・更新したファイル

- `docs/release-preprod-runbook.md`（新規）
- `docs/mvp-completion-checklist.md`（runbook導線を追記）
- `supabase/verification/release_preprod_checks.sql`（新規）

## 追加内容

`docs/release-preprod-runbook.md` に以下を整理:

1. ローカル最終回帰コマンドの固定手順
2. Supabase migrationの手動適用順
3. migration適用後の確認SQL（テーブル存在 / RLS / policy）
4. RLS実効確認（ユーザーA/Bでの隔離確認）
5. MVP中核フローの本番相当確認項目
6. Google OAuth / Calendar確認項目
7. Vercel環境変数確認項目
8. Go / No-Go 判定条件

加えて、SQL Editorで再利用できる確認SQLを `supabase/verification/release_preprod_checks.sql` に分離。

## 補足

- Codexは本番Supabase適用や外部設定変更を実施していない
- 手順書化のみ実施
