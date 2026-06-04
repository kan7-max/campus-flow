# 2026-05-23 Beta Guides Quality and Beta Notice Pass

## 目的
- スマホ向け資料が表示されない問題を回避
- 資料閲覧の画質を改善
- β版向けの不具合報告導線・連絡先・注意書きを追加

## 変更内容（最小）
- `src/app/(app)/beta-guides/page.tsx`
  - Office埋め込み依存を緩和し、`高画質で開く`（`view.aspx`）導線を追加
  - `ページ内プレビュー（軽量）` は折りたたみ表示に変更
  - β注意書き追加（AI抽出結果は保存前に手動確認）
  - 不具合報告フォームボタンと連絡先ボタン追加
  - 環境変数未設定時のフォールバック導線を追加
    - 不具合報告: GitHub Issues 新規作成
    - 連絡先: public project contact address
- `src/lib/env.ts`
  - `BETA_FEEDBACK_FORM_URL`（optional）
  - `BETA_CONTACT_EMAIL`（optional）
- `.env.example`
  - `BETA_FEEDBACK_FORM_URL=`
  - `BETA_CONTACT_EMAIL=`

## 実行結果
- `npm run lint` 成功
- `npm run typecheck` 成功
- `npm run check` 成功
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` 成功
- `npm run qa:release-local` は `qa:preprod` の既存検査で失敗
  - 指摘: `src/lib/supabase/admin.ts` に `SUPABASE_SERVICE_ROLE_KEY` 文字列あり（サーバー専用ファイル）
  - レポート: `docs/release-reports/local-release-gate-20260523-231952.md`
