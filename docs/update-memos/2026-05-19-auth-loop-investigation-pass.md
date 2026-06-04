# 2026-05-19 Auth Loop Investigation Pass

## 目的
- Vercel本番での Google ログイン後に `/login` へ戻る/進めない現象の原因切り分けを加速する。

## 実施内容（最小変更）
1. `src/app/api/auth/google/start/route.ts`
   - `signInWithOAuth` 失敗時の分類を強化（`oauth_network_failed`, `oauth_start_exception`）。
   - 失敗理由（`oauth_reason`）を正規化して `/login` に返す。
   - 例外 throw 時も 500 で落とさず `/login` へ戻して理由を表示。
   - `origin` / `callback` / env有無の診断ログ追加。

2. `src/app/auth/callback/route.ts`
   - `exchangeCodeForSession` の例外 throw を捕捉して `/login` に理由付きで返す。
   - callback成功時に `Set-Cookie` 名（`sb-*`）をログへ出力。
   - callback失敗時にエラー分類と理由をログへ出力。

3. `middleware.ts`
   - 保護ページから `/login` へ戻す分岐で、発火理由のログを追加。

4. `src/app/login/page.tsx`
   - unknownな `oauth_error` でも code をそのまま表示。
   - `oauth_reason` の decode 失敗時フォールバックを追加。

## ローカル確認
- `npm run check` ✅

## 次の観測ポイント（Vercel）
- `/api/auth/google/start` 実行時の warning/error ログ
- `/auth/callback` 実行時の
  - `OAuth callback exchange succeeded` の有無
  - `outgoingAuthCookieNames` が空でないか
- middleware の `user missing` / `auth check failed` ログ発火有無
