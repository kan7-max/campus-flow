# 2026-05-07 追加作業メモ（RLS検証時のdemo mode注意）

## 背景

- RLS実効確認で「A/Bで同じデータが見える」報告が発生
- 原因は `TASKFLOW_DEMO_MODE=1` で、全セッションが `demo-user` 扱いになる構成

## 対応

1. demo mode無効サーバーを `:3001` で起動
2. `http://127.0.0.1:3001/login` で `Googleでログイン` 表示を確認
3. `docs/release-preprod-runbook.md` に以下の前提を追記
   - demo mode無効
   - login画面でGoogleログインが表示
   - A/Bで異なるGoogleアカウントを使用

