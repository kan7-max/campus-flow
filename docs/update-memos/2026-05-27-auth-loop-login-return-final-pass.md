# 2026-05-27 Auth Loop / Login Return / Session Persist Final Pass

## 目的
- Google OAuth後に `/login` へ戻るループを止める。
- 未認証遷移時に `redirectTo` を保持し、OAuth後に意図画面へ戻せるようにする。
- 認証失敗理由（`oauth_reason`）を可読な状態で表示できるようにする。

## 実施内容
1. `src/middleware.ts` を新設し、認証ガードの実体を `src` 配下に配置。
   - `src/app` 構成のため、Next.js 15.5 で確実に middleware が有効化される配置へ統一。
   - 未認証時の `/login` リダイレクトで `redirectTo` を保持。
   - `/login` でログイン済み時は `redirectTo` 優先遷移（`/login` 再帰は `/dashboard` にフォールバック）。
   - adminガードロジック（既存）を維持。
2. ルート直下の `middleware.ts` / `proxy.ts` は `src/middleware` への再エクスポートに統一。
3. `src/app/api/auth/google/start/route.ts`
   - `x-forwarded-host` / `x-forwarded-proto` 優先で `origin` を決定。
   - `next` を内部パスに正規化。
   - `oauth_reason` の二重エンコードを解消。
4. `src/app/auth/callback/route.ts`
   - `origin` 決定を start と同基準に統一。
   - `next` 正規化を追加。
   - `oauth_reason` の二重エンコードを解消。
5. `src/lib/auth.ts`
   - middlewareを通らない経路向けに `requireUser()` 側でも `redirectTo` 推定フォールバックを追加。

## 検証
- `npm run check` ✅
- `TASKFLOW_QA_DIST_DIR=.next-auth-build npm run build` ✅
  - ビルド出力に `ƒ Middleware` を確認。
- 本番相当起動での確認:
  - `GET /dashboard?foo=1&bar=2` → `307 /login?redirectTo=%2Fdashboard%3Ffoo%3D1%26bar%3D2`
  - `GET /api/auth/google/start?next=%2Fdashboard%3Ftab%3Dtoday&debug=1`（forwarded host付き）
    - `code: oauth_start_ok`
    - `origin/callback` が forwarded host 基準で返ることを確認。
