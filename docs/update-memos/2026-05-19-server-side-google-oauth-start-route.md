# 2026-05-19 Server-side Google OAuth Start Route

## 背景
- 本番 `/login` でGoogleログイン開始時にクライアント側例外が発生し、開始に失敗するケースが残っていた。

## 対応
- `src/app/api/auth/google/start/route.ts` を追加。
  - サーバー側で `signInWithOAuth` を実行
  - 取得した `data.url` へ `NextResponse.redirect`
  - クッキー引き継ぎを保持（PKCEフロー用）
  - 失敗時は `/login?oauth_error=...` に戻す
- `src/components/layout/login-card.tsx`
  - クライアント直接 `signInWithOAuth` を廃止
  - `/api/auth/google/start` へ遷移するだけに変更
- `src/app/login/page.tsx`
  - `oauth_error` クエリを日本語メッセージに変換して表示

## 狙い
- ブラウザ環境差分によるOAuth開始失敗を避ける
- ログイン開始経路をSSR/PKCEに一本化してループ・ハングを抑制

## 確認
- `npm run typecheck` 成功
