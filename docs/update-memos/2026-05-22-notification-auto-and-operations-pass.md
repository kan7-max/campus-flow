# 2026-05-22 Notification Auto + Operations Pass

## 実施内容

1. 通知キュー自動送信対応
- `src/app/api/notifications/dispatch/route.ts` を拡張
  - `Authorization: Bearer <CRON_SECRET>` のCron呼び出しを許可
  - Cron時は認証ユーザー不要で実行
  - `drain` モードで複数バッチを連続処理
- `src/lib/services/notificationService.ts`
  - `dispatchDueNotificationsUntilEmpty` を追加（キューを空になるまで処理）
- `vercel.json`
  - `/api/notifications/dispatch` を 10分おきで自動実行

2. 運営者向けページ追加（参照専用）
- `src/app/(app)/operations/page.tsx`
  - 運営指標・運用導線ページを追加
  - `OPERATIONS_ADMIN_EMAILS`（CSV）で管理者制限可能
  - 未設定時は警告表示の上で閲覧可（運用開始を妨げないため）
- `src/app/(app)/settings/page.tsx`
  - 設定画面に「運営ページ」導線を追加

3. 運営ドキュメント追加
- `docs/operations-metrics-policy.md`
  - 指標定義、優先度（Tier1/2/3）、ツール責務、プライバシールール
- `docs/operations-runbook.md`
  - 毎日/週次/月次チェック、障害時の確認項目

4. 環境変数テンプレ更新
- `.env.example`
  - `CRON_SECRET`
  - `OPERATIONS_ADMIN_EMAILS`
  - `NOTIFICATION_DISPATCH_BATCH_LIMIT`
  - `NOTIFICATION_DISPATCH_MAX_ROUNDS`

## 実行コマンド
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅

## 備考
- `npm run build` は途中で中断（ユーザー割り込み）。
- 通知完全自動化を有効にするには、Vercelに `CRON_SECRET` を設定したうえで再デプロイが必要。
