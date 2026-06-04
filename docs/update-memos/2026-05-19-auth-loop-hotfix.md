# 2026-05-19 Auth Loop Hotfix

## 背景
- Vercel本番で Google ログイン後に `/login` へ戻るループが発生。
- 一部ケースで URL ハッシュ (`#access_token`, `#refresh_token`) 付きで戻るが、セッション未復元のままになっていた。

## 変更内容
1. `src/components/layout/login-card.tsx`
   - ログイン画面で `#access_token` / `#refresh_token` を検出した場合に `supabase.auth.setSession` で復元する処理を追加。
   - 復元成功後は `redirectTo` へ遷移。
   - 復元失敗/不足時は `oauth_error` クエリ付きで `/login` に戻し、原因表示へ接続。
   - `redirectTo` は内部パスのみ許可するよう `safeRedirectTo` を導入。

2. `src/app/auth/callback/route.ts`
   - `exchangeCodeForSession` の失敗を握りつぶさず、`oauth_error` と `oauth_reason` を付与して `/login` へ返すよう変更。
   - `next` パラメータを内部パスに制限。

3. `src/app/login/page.tsx`
   - `oauth_state_mismatch` / `oauth_code_invalid` / `oauth_callback_failed` / `oauth_hash_missing` / `oauth_hash_restore_failed` の日本語メッセージを追加。

## 確認
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅

## 補足
- ループ再発時は、Supabase Auth の `Site URL` / `Redirect URLs` と Google OAuth の承認済みリダイレクトURIがデプロイドメインと一致しているかを再確認する。
