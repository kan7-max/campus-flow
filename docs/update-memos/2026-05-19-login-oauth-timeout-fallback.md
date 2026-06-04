# 2026-05-19 Login OAuth Timeout Fallback

## 背景
- Vercel本番 `/login` で Googleログイン押下後、`Connecting...` のまま停止するケースが発生。

## 対応
- `src/components/layout/login-card.tsx` に最小修正を実施。
  - Supabase URLの正規化（`/rest/v1`・`/auth/v1` の混入を吸収）
  - `signInWithOAuth` に 8秒タイムアウトを追加
  - タイムアウト/URL未取得/エラー時は、`/auth/v1/authorize` へ直接遷移フォールバック

## 目的
- ブラウザ・拡張機能・ネットワーク条件でSDK呼び出しがハングしても、認証フローを継続可能にする。
- 無限 `Connecting...` の体感停止を避ける。

## 確認
- `npm run typecheck` 成功
