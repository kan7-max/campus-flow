# 2026-05-07 追加作業メモ（本番化前チェック次工程）

## 実施目的

- 本番化前の残課題を進める
- 新機能追加なしで、危険箇所の確認と運用しやすいQA導線を追加する

## 変更内容

1. `allowedDevOrigins` を追加（開発時の cross-origin 警告対策）
   - `next.config.mjs`
   - `allowedDevOrigins: ["localhost", "127.0.0.1"]`

2. 本番化前の静的監査スクリプトを追加
   - `scripts/qa-preprod-readiness.mjs`
   - 監査内容:
     - 必須/任意環境変数の存在確認
     - `SUPABASE_SERVICE_ROLE_KEY` の `src` 露出チェック（`src/lib/env.ts` 以外）
     - 必須 migration ファイル存在確認
     - RLS/policy マーカーの migration レベル静的確認

3. npm script追加
   - `package.json`
   - `qa:preprod` を追加

## 実行コマンドと結果

- `npm run qa:preprod` -> PASS（optional warn: `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`）
- `npm run check` -> PASS
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` -> PASS

## 開発サーバー安定化（OneDrive対策）

build後に以下を実施:

1. `:3000` の dev プロセス停止
2. `.next` を workspace ガード付きで削除
3. `TASKFLOW_DEMO_MODE=1` で dev server 再起動

確認:

- `http://localhost:3000` listening（PID 26240）
- `next-dev.log` で Ready を確認
- `http://127.0.0.1:3000/ai` `200`
- `http://127.0.0.1:3000/inbox` `200`
- `http://127.0.0.1:3000/today` `200`
- `http://127.0.0.1:3000/dashboard` `200`
- `http://127.0.0.1:3000/assignments` `200`

## 残課題

- 実機/DevToolsでのスマホ幅目視QA（Browser Use側の localhost 表示制約があるため）
- 本番Supabase未適用 migration の手動適用と本番RLS実効確認
- Google OAuth / Calendar / Vercel環境変数の本番最終照合
