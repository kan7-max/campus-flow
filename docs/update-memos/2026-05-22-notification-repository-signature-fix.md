# 2026-05-22 Notification Repository Signature Fix

## 目的
- Vercel本番ビルドで発生していた型エラーを解消する。
- `listDueNotifications` の呼び出し側と定義側の引数仕様を一致させる。

## 変更内容
- `src/lib/repositories/notificationRepository.ts`
  - `listDueNotifications` に `limit` 引数を追加。
  - `limit` を `1..200` にクランプ。
  - demo/store 経路で `notifyAt` 昇順ソート + `slice(limit)` を適用。
  - Supabase経路の `.limit(100)` を `.limit(safeLimit)` に変更。

## 確認結果
- `npm run lint` 通過
- `npm run typecheck` 通過
- `npm run check` 通過
- `npm run build -- --no-lint` 通過

## 補足
- この修正は通知バッチ処理の引数整合のみで、課題保存本体やAI抽出ロジックには影響なし。
