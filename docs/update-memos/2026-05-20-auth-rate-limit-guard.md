# 2026-05-20 Auth Rate Limit Guard

## 背景
- Supabase auth logs で `/token` `429 over_request_rate_limit` が散発
- ログイン連打や多重起動で再現しやすい状態だった

## 最小修正
- `src/app/api/auth/google/start/route.ts`
  - `taskflow_oauth_start_guard` cookie を追加
  - 8秒以内の再開始をブロックし、`oauth_start_rate_limited` で `/login` に戻す
- `src/app/auth/callback/route.ts`
  - callback 成功/失敗時に guard cookie を確実に削除
- `src/app/login/page.tsx`
  - `oauth_start_rate_limited` の日本語エラーメッセージ追加

## 期待効果
- 認証開始の短時間連打による OAuth 開始多重化を抑制
- `/token` レート制限発生確率の低減
- ユーザーに「待って再試行」の意図を明示

## 検証
- `npm run check` PASS
- `npm run qa:preprod` PASS
