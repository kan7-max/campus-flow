# 2026-05-19 Auth Loop Third Pass (Fallback)

## 追加内容
- `src/components/layout/login-card.tsx`
  - `supabase.auth.signInWithOAuth` がブラウザ側で失敗した場合、`/api/auth/google/start` に自動フォールバックするよう変更。

## 狙い
- ブラウザ環境差分で OAuth 開始が失敗するケースでも、サーバー経由で開始できるようにする。

## 検証
- `npm run check` ✅
