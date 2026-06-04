# 2026-05-22 Google OAuth 400 Minimal Login Params

## 背景
- iOS実機で Google ログイン開始時に `accounts.google.com` 側で `400 malformed request` が発生するケースがある。

## 実施内容（最小変更）
- `src/app/api/auth/google/start/route.ts` のログイン用 `signInWithOAuth` から、以下の強制パラメータを外した。
  - `access_type=offline`
  - `prompt=consent`
- ログイン用途では最小スコープのみ指定するように変更。
  - `scopes: "openid email profile"`

## ねらい
- Google 側での malformed 判定に繋がりやすい追加パラメータを除去し、まずログイン成功率を上げる。
- `offline/consent` が必要な処理は、既存の Google Calendar 連携フロー側で継続する（ログイン本体とは分離）。

## 検証
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅
