# 2026-05-23 Cron Frequency Hobby Limit Pass

## 目的
- 通知自動送信を「より高頻度」で回せるか検証し、Vercel本番へ反映する。

## 実施内容
1. `vercel.json` の Cron を `*/15 * * * *` に変更して本番デプロイを試行。
2. Vercel本番デプロイ時に以下エラーを確認:
   - `Hobby accounts are limited to daily cron jobs`
3. すぐに `vercel.json` を日次スケジュールへ戻し、再デプロイ。
   - `schedule: "0 23 * * *"`

## 結果
- Vercel Hobby 制限により 15分実行は不可。
- 日次スケジュールで本番デプロイは `READY`。
- 最新本番デプロイ:
  - URL: `new-project-qw9r1s1jj-kan7-maxs-projects.vercel.app`
  - Commit: `b2beb4b6d73059c2487e095a32141b154b67ffd4`

## 補足
- 15分/時間単位の通知自動送信が必要な場合は Vercel Pro へのアップグレードが必要。
