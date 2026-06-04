# 2026-05-19 Supabase Login `No API key found` Fix

## 問題
- Vercel環境でログイン時に `{"message":"No API key found in request"}` が発生し、Googleログインへ進めない状態。
- `NEXT_PUBLIC_SUPABASE_URL` が `/rest/v1` 付きで設定されると、OAuth URL が誤って生成される。

## 対応
- Supabase URLを実行時に正規化する処理を追加。
  - 末尾スラッシュを除去
  - `/rest/v1` または `/auth/v1` が末尾にある場合は除去
- 正規化済みURLを以下で共通利用:
  - browser client
  - server client
  - middleware proxy
  - auth callback

## 変更ファイル
- `src/lib/env.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`
- `src/app/auth/callback/route.ts`

## 実行確認
- `npm run typecheck` 成功
- commit: `dc188c8`
- push: `main -> main`

## 補足
- Vercel側の `NEXT_PUBLIC_SUPABASE_URL` は `https://<project-ref>.supabase.co`（`/rest/v1` なし）推奨。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` が未設定/空値の場合は同様に認証失敗するため、再確認が必要。
