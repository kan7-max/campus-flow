# Campus TaskFlow Preprod Execution Report (2026-05-20 11:16 JST)

## 1. Local Gate / QA
- `npm run check` ✅ PASS
- `npm run qa:preprod` ✅ PASS
- `npm run qa:mvp` ✅ PASS
- `npm run qa:inbox` ✅ PASS
- `npm run qa:secrets-static` ✅ PASS
- `npm run qa:release-local` (quick) ✅ PASS  
  - report: `docs/release-reports/local-release-gate-20260520-101846.md`

## 2. Vercel Build Error Handling
- 発生エラー:
  - `Module not found: Can't resolve '@/lib/ai/dueDateYearNormalizer'`
  - `Type error ... 'tryImmediate' does not exist`
- 対応:
  - missing file tracking fix (`src/lib/ai/dueDateYearNormalizer.ts`)
  - calendar sync call-site option mismatch fix (`src/lib/services/assignmentService.ts`)
- 修正後: ユーザー実機でデプロイ/動作確認完了（会話内報告）

## 3. User-Confirmed Runtime Smoke
- 実機確認: ✅ 実施済み（ユーザー報告）
- 対象: ログイン / AI入力 / Inbox / Today / 保存反映フロー

## 4. Security / Exposure Checks
- `qa:preprod`:
  - env key presence checks ✅
  - service role key static exposure check ✅
  - migration-level RLS marker check ✅
  - migration-level GRANT marker check ✅
- `qa:secrets-static`:
  - `.next/static` への秘密値の直接混入チェック ✅

## 5. Remaining Manual Verification (External Systems)
- Supabase SQL Editor で `supabase/verification/release_preprod_checks.sql` 実行結果の最終保存（証跡）
- A/BアカウントでRLS実効確認（他ユーザーデータ不可視）
- Google OAuth / Calendar の本番再接続確認（最終1回）

## 6. Current Judgment
- Local preprod readiness: **PASS**
- Production go/no-go: **PENDING (manual external verifications only)**

## 7. Connector Live Verification (2026-05-20)
### Vercel
- Team: `team_rTTDr8OkFaPEoMBqsIpze1xq` (kan7-max's projects)
- Project: `prj_fXOWsAFzDXTAk9X7KTuHCltA8w5g` (`new-project`)
- Latest deployment: `dpl_ELGmTuaYzqxGY7yyeWuBYxUoADz8` / state `READY` / target `production`
- 直近の build エラー履歴（module not found / type error）は解消済みで、最新は READY を確認
- 最新 build logs でも `Compiled successfully` / `Deployment completed` を確認

### Supabase
- Project: `iziqrurcaeuhnhphutli`
- Auth logs:
  - `/authorize` 302, `/callback` 302, `/token` 200, `/user` 200 を確認
  - ログイン成功イベント（provider: google, pkce）を確認
- Advisors:
  - security: `function_search_path_mutable` など WARN あり（要計画対応）
  - performance: unindexed FKs / RLS init plan WARN あり（要計画対応）

### コメント
- 現時点で「認証がまったく通らない」状態ではなく、ログ上は OAuth とセッション処理が成功している時間帯がある。
- 残課題は **運用チューニング（rate limit 抑制 / policy・index最適化）** が中心。

## 8. RLS / GRANT Live SQL Spot Check (Connector)
- 対象テーブル:
  - `sync_outbox`
  - `work_sessions`
  - `study_blocks`
  - `assignment_steps`
  - `inbox_items`
  - `ai_usage_logs`
  - `ai_credit_balances`
- 確認結果:
  - 全テーブル `rls_enabled = true`
  - 全テーブル `policy_count = 1`（self policy）
  - `anon_privileges = ''`（付与なし）
  - `authenticated` / `service_role` は `DELETE, INSERT, SELECT, UPDATE`

## 9. Operational Note (Auth)
- Supabase auth logs に `/token` の `429 over_request_rate_limit` が散発。
- ログイン不可の恒久障害ではなく、短時間連打時のレート制限が主因の可能性が高い。
- 実運用時は OAuth 再試行の間隔制御（UI/サーバ側）を次スプリントで入れると安定度が上がる。

## 10. Full Gate Retry (Manual Fallback)
- `npm run qa:release-local:full` は `Demo dev server did not become ready on :3000` で失敗。
- 代替として同等ステップを手動実行し、すべて PASS を確認:
  - `npm run check` ✅
  - `npm run qa:preprod` ✅
  - `npm run qa:mvp` ✅
  - `npm run qa:inbox` ✅
  - `TASKFLOW_DEMO_MODE=1 TASKFLOW_QA_DIST_DIR=.next-qa-full-manual npm run build -- --no-lint` ✅
  - `TASKFLOW_QA_DIST_DIR=.next-qa-full-manual npm run qa:secrets-static` ✅

## 11. Minimal Auth Retry Guard Patch
- 目的: OAuth開始連打時の `/token` レート制限（429）を起こしにくくする
- 変更:
  - `src/app/api/auth/google/start/route.ts`
    - `taskflow_oauth_start_guard` cookie を使った 8秒ガードを追加
    - 連打時は `oauth_start_rate_limited` で `/login` へ戻し、日本語理由を表示
  - `src/app/auth/callback/route.ts`
    - callback 成功/失敗の全分岐で guard cookie をクリア
  - `src/app/login/page.tsx`
    - `oauth_start_rate_limited` の日本語メッセージを追加
- 検証:
  - `npm run check` ✅
  - `npm run qa:preprod` ✅

## 12. Autopilot Re-run (2026-05-20 20:55 JST)
- 再確認コマンド:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm run check` ✅
  - `npm run qa:mvp` ✅
  - `npm run qa:inbox` ✅
  - `npm run qa:preprod` ✅
  - `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` ✅
- 追加所見:
  - 自動QAで `/ai -> 保存 -> /assignments -> /today` と `/inbox` 複数候補保存フローは継続して PASS
  - build も通過し、最新ローカル状態で型/静的チェック破綻なし
