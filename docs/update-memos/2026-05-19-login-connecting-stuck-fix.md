# 2026-05-19 Login "Connecting..." Stuck Fix

## 症状
- `/login` で Googleログイン押下後に `Connecting...` のまま停止する。

## 原因
- ログイン開始処理で例外やURL未取得ケースを捕捉しておらず、`loading=true` のまま復帰できないケースがあった。

## 対応
- `src/components/layout/login-card.tsx` の `loginWithGoogle` を最小修正。
  - `try/catch` 追加
  - `signInWithOAuth` を `skipBrowserRedirect: true` にしてURL取得を明示化
  - `data.url` が返らない場合の日本語エラー表示を追加
  - `window.location.assign(data.url)` で遷移を明示実行

## 影響
- ログイン開始失敗時に無限ローディングしない
- 成功時は即Google認証画面へ遷移

## 確認
- `npm run typecheck` 成功
