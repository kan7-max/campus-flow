# 2026-05-07 追加作業メモ（UI崩れ復旧 / OneDrive .next ENOENT）

## 発生事象

- 全体UIが崩れる / 一部画面が白画面・500
- `next-dev.err.log` に `ENOENT`:
  - `.next/server/vendor-chunks/next.js` が見つからない
  - `/today`, `/inbox`, `/assignments`, `/calendar` などで500

## 原因

- OneDrive配下で `.next` 生成物が壊れる既知事象
- コードロジックよりビルドキャッシュ破損の影響が大きい

## 実施した復旧

1. `:3000` の dev server プロセス停止
2. ワークスペース内 `.next` を安全削除
3. `TASKFLOW_DEMO_MODE=1` で `npm run dev -- -p 3000` 再起動

## 復旧確認

- `GET /` 200
- `GET /dashboard` 200
- `GET /today` 200
- `GET /inbox` 200
- `GET /assignments` 200
- `GET /ai` 200

## メモ

- 再発時は同じ手順（停止→`.next`削除→再起動）で最短復旧
- 今回のUI崩れはコード変更起因ではなく、`.next` 破損起因

