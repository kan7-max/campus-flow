# 2026-05-22 Login Session Persist (Same Device)

## 目的
- 同じ端末でタブ/ホーム画面を開き直したときに、毎回ログイン前画面へ戻る問題を軽減する。

## 変更内容
- `src/app/api/auth/sync-session/route.ts` を追加。
  - クライアント側に残っている Supabase セッション（access/refresh token）を受け取り、
    サーバー側（SSR/middleware が参照する cookie）に同期する API を実装。
- `src/components/layout/login-card.tsx` を更新。
  - `/login` 表示時に既存ブラウザセッションを検出したら、
    `/api/auth/sync-session` を呼んで cookie を再同期し、
    `redirectTo` へ自動遷移する処理を追加。

## 安全性
- 既存の Google OAuth 方式は変更していない。
- 課題保存・AI抽出・通知など認証以外の処理には未影響。

## 検証
- `npm run check` ✅
