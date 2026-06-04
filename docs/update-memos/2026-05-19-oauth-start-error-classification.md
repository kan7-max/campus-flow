# 2026-05-19 OAuth Start Error Classification

## 目的
- `/login` で「開始失敗」のみ表示され、真因が見えず調査が止まる問題を解消。

## 対応
- `src/app/api/auth/google/start/route.ts`
  - OAuth開始エラーを分類して `oauth_error` を付与
  - 短い詳細理由を `oauth_reason` として返却
- `src/app/login/page.tsx`
  - `oauth_error` を日本語メッセージに変換
  - `oauth_reason` を追記表示
- `src/components/layout/login-card.tsx`
  - エラーボックスを `whitespace-pre-line` にして複数行表示

## 効果
- 次回失敗時に「APIキー不足 / Redirect許可不足 / Provider無効 / OAuthクライアント不正」などを即判別可能。
