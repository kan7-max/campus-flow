# 2026-05-19 Auth Loop Second Pass

## 追加対応
- Googleログイン開始処理を `src/components/layout/login-card.tsx` で **クライアント直呼び** (`supabase.auth.signInWithOAuth`) に変更。
  - これにより `/api/auth/google/start` 経由で起きうる PKCE verifier cookie の受け渡しブレを回避。
- `src/app/auth/callback/route.ts` でリダイレクト先生成を `x-forwarded-host` / `x-forwarded-proto` 優先に変更。
  - Vercel 複数ドメイン運用時に callback 後の遷移先ドメインがズレるケースを抑制。

## 目的
- 「Googleアカウント選択→/loginに戻るループ」を止める。
- callback 後に別ドメインへ飛んで 404 になるケースを減らす。

## 検証
- `npm run lint` ✅
- `npm run typecheck` ✅
