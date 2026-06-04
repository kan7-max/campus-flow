# 2026-05-19 Auth Loop Fourth Pass (Server OAuth Start Fixed)

## 目的
- Vercel本番で Google ログイン後に `/login` に戻る/進めない問題を、最小変更で切り分けしやすくする。

## 実施内容
- `src/components/layout/login-card.tsx`
  - Googleログイン開始をブラウザSDK直接呼び出しから外し、常に `/api/auth/google/start` を通すように統一。
  - 本番での開始フローを1本化し、ドメイン差異による揺れを減らす。
- `src/app/api/auth/debug-session/route.ts`
  - `taskflow_oauth_callback_trace` を返すように追加。
  - `incomingSessionCookieNames` と `incomingCodeVerifierCookieNames` を分離して返すように追加。
- `src/app/login/page.tsx`
  - `oauth_code_missing` / `oauth_provider_error` の日本語エラー文言を追加。

## 確認
- `npm run check` 成功（lint + typecheck）

## 追加観測ポイント
- `/api/auth/google/start?next=%2Fdashboard&debug=1` が `oauth_start_ok` を返すこと
- ログイン試行後 `/api/auth/debug-session` で以下を確認:
  - `callbackTrace`
  - `incomingSessionCookieNames`
  - `incomingCodeVerifierCookieNames`

