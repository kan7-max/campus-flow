# 2026-05-19 Login Loop (Account Select -> Login) Fix

## 症状
- Googleアカウント選択後に `/login` へ戻り続ける（ループ）。
- URLに `#access_token=...` が付くケースがあり、PKCEのコード交換フローに乗らない。

## 原因
- ログイン開始のフォールバックで `/auth/v1/authorize` へ直接遷移する経路があり、PKCE用のコード交換フローと不整合が起きる可能性があった。
- `middleware.ts` が Supabase URL正規化前の値を参照し、環境値によっては認証判定が不安定になる可能性があった。

## 対応
- `src/components/layout/login-card.tsx`
  - 直接 authorize URL へのフォールバックを削除
  - `signInWithOAuth`（PKCE）経路のみを利用
  - タイムアウト時は日本語エラー表示して終了（無限ローディング回避）
- `middleware.ts`
  - `supabaseProjectUrl` を利用するよう統一

## 確認
- `npm run typecheck` 成功
