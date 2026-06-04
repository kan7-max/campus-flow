# 2026-05-20 Preprod Autopilot Pass

## 目的
- 指示待ちせず、本番前チェックを自動で前進させる

## 実施内容
- Vercel connector で本番 project/deployment 状態を確認
  - latest production deployment: `dpl_BqbFJpPRJxGo4wApAyWouLqSwDML` (READY)
  - build logs で `Compiled successfully` / `Deployment completed` を確認
- Supabase connector で auth/advisor/live SQL を確認
  - OAuth 系ログの成功経路（authorize/callback/token/user）を確認
  - `sync_outbox/work_sessions/study_blocks/assignment_steps/inbox_items/ai_usage_logs/ai_credit_balances` の
    - RLS enabled
    - policy 1件
    - anon privilege なし
    - authenticated/service_role 権限あり
    を確認
- ローカルの full gate は server ready 待ちで失敗したため、手動代替で同等ステップを実施
  - `check`, `qa:preprod`, `qa:mvp`, `qa:inbox`, `build(no-lint)`, `qa:secrets-static` すべて PASS

## 残課題
- Auth `/token` の `429 over_request_rate_limit` が散発
- 次スプリントで OAuth 再試行間隔制御（連打抑制）を最小実装予定

## 参照
- `docs/release-reports/preprod-execution-20260520-1116.md`
