# 2026-05-07 本番化前チェック・スマホ幅QAメモ

## 目的

新機能追加なしで、正式リリース前に危険箇所を洗い出す。

## 実施内容

1. 既存MVP導線の回帰確認
2. スマホ幅QA（実行可能範囲）
3. console error / 白画面確認
4. 本番化前リスク監査（RLS / 秘密鍵 / OAuth / Vercel）

## 実行コマンド結果

- `npm run lint` OK
- `npm run typecheck` OK
- `npm run check` OK
- `npm run qa:mvp` OK
- `npm run qa:inbox` OK
- `npm run qa:cleanup` OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` OK
- build後に `.next` 削除 + demo dev server再起動済み

## 画面確認

HTTPで以下が全て `200`:

- `/`
- `/ai`
- `/inbox`
- `/today`
- `/dashboard`
- `/assignments/97bf53b1-00b4-4212-a074-06dbb628291a`

## スマホ幅QAの実施状況

- Browser Useプラグイン経由では `localhost` が `オフラインです` 表示になり、ログイン済み画面での実描画モバイルQAが不可
- 代替として、レスポンシブclassのコード監査を実施
  - `/ai`, `/inbox` で `w-full sm:w-auto` と折り畳み要素を確認
  - `/today` で `今はこれだけ` が `今日のタイムライン` より上にあることを確認
  - `/assignments/[id]` の主要操作ボタンとパネル構成を確認

## 修正内容（最小変更）

- 課題詳細のGoogle同期表示を改善
  - 同期状態を日本語化（同期待ち / 同期済み / 同期失敗）
  - 同期失敗時に「課題データは保存されている」日本語メッセージを表示
  - 低レイヤーエラー文は `詳細` として補助表示

対象:

- `src/app/(app)/assignments/[id]/page.tsx`

## 監査結果（重要）

- `SUPABASE_SERVICE_ROLE_KEY` は `env.ts` に定義のみ、クライアント露出・実利用は未検出
- Supabaseクライアントは `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` 利用
- migration内で `sync_outbox`, `work_sessions`, `study_blocks`, `assignment_steps`, `inbox_items`, `ai_usage_logs`, `ai_credit_balances` はRLS policyあり
- `subscriptions` テーブルは未実装（将来追加時はRLS必須）
- `next-dev.err.log` はOneDrive由来の `.taskflow-demo-store.json` 原子的書き込み警告が出る場合あり（直書きfallbackあり）

## 本番化前に残る課題

1. 本番Supabaseへ未適用migrationを手動適用
2. 本番環境でRLSの実効確認（他ユーザーデータ隔離）
3. Google OAuth redirect URI / callback URL整合確認
4. Vercel環境変数の最終確認
5. Browser Useでの実描画モバイルQA不可のため、実機または通常ブラウザDevToolsでスマホ幅目視QAを追加実施
