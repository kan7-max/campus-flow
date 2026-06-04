# Campus TaskFlow 本番化前 実施記録テンプレ

このテンプレは `docs/release-preprod-runbook.md` の実施結果を記録するためのもの。

## 基本情報

- 実施日:
- 実施時刻:
- 実施者:
- 対象環境:
- 参照runbook: `docs/release-preprod-runbook.md`

## 1. ローカル最終回帰

- [ ] `npm run check` OK
- [ ] `npm run qa:mvp` OK
- [ ] `npm run qa:inbox` OK
- [ ] `npm run qa:preprod` OK
- [ ] `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` OK

メモ:

## 2. Supabase migration 手動適用

実行対象:

- [ ] `20260430_sync_outbox.sql`
- [ ] `20260430_work_sessions.sql`
- [ ] `20260430_study_blocks.sql`
- [ ] `20260430_assignment_steps.sql`
- [ ] `20260501_inbox_items.sql`（必要時）
- [ ] `20260501_ai_usage_logs.sql`（必要時）
- [ ] `20260501_ai_credit_balances.sql`（必要時）

エラー:

- なし / あり（内容を記載）

## 3. DB確認SQL結果

実行ファイル: `supabase/verification/release_preprod_checks.sql`

- テーブル存在: PASS / FAIL
- RLS有効: PASS / FAIL
- Policy存在: PASS / FAIL

証跡メモ:

## 4. RLS実効確認（A/Bユーザー）

- [ ] ユーザーA作成データがAで見える
- [ ] ユーザーBからAデータが見えない
- [ ] `/assignments` `/today` `/inbox` `/assignments/[id]` で隔離を確認

結果:

## 5. 中核フロー確認

- [ ] `/ai` 長文入力
- [ ] 複数候補抽出
- [ ] プレビュー編集
- [ ] 選択保存
- [ ] `/assignments` 反映
- [ ] `/today` 反映
- [ ] `/inbox` 候補別保存（部分保存 / 全保存）
- [ ] `raw_text` 保持
- [ ] Calendar同期失敗時でも課題保存成功

結果:

## 6. OAuth / Calendar / Vercel確認

- [ ] Google OAuth redirect URI一致
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 設定確認
- [ ] Vercel必須環境変数確認
- [ ] 連携失敗時の日本語メッセージ確認

結果:

## 7. UI最終確認（スマホ幅）

- [ ] `/ai` 入力欄・候補カード・保存ボタン
- [ ] `/inbox` 候補確認・保存
- [ ] `/today` 「今日やること」「次の締切」「AI入力導線」
- [ ] `/dashboard` 情報量と折り畳み導線
- [ ] `/assignments/[id]` 主要操作

結果:

## 8. Go / No-Go 判定

- 判定: Go / No-Go
- 判定時刻:
- 判定者:

理由:

## 9. ブロッカー・次アクション

1. 
2. 
3. 

