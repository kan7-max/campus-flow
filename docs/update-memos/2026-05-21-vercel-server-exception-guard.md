# 2026-05-21 Vercel Server Exception Guard

## 目的
- `Application error: a server-side exception ... Digest: 1596678535` の再発防止
- Supabase初期化/認証チェック失敗時に白画面ではなく、ログイン誘導または安全フォールバックにする

## 実施内容（最小変更）
- `src/lib/supabase/server.ts`
  - Supabase server client 初期化を `try/catch` 化
  - 失敗時は `console.warn` + `null` を返す
- `src/lib/auth.ts`
  - `getCurrentUser()` の `supabase.auth.getUser()` を `try/catch` 化
  - 失敗時は例外を画面へ伝播させず `null` を返す
- `middleware.ts`
  - middleware の Supabase client 初期化を `try/catch` 化
  - 初期化失敗時は公開ページは通し、保護ページは `/login` へ誘導

## ローカル確認
- `npm run typecheck` : OK
- `npm run lint` : OK
- `npm run check` : OK

## 備考
- 課題保存やAI抽出ロジックには未変更
- 本番設定値（Vercel/Supabase/Google）は未変更
