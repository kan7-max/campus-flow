# 2026-05-22 Post-Deploy Verification Pass

## 実施内容
- `fix(notifications): align due-list limit signature for vercel build` の反映後、Vercel本番デプロイ状態を確認。
- 本番最新デプロイが `READY` であることを確認。
- OAuth開始導線(`/api/auth/google/start`)がSupabase OAuth URLへ `307` リダイレクトすることを確認。
- 通知ディスパッチAPI(`/api/notifications/dispatch`)が未認証時 `401` を返すことを確認（想定通り）。
- `vercel env ls production` で `CRON_SECRET` が Production に存在することを確認。

## 確認結果
- 最新本番デプロイ: `READY`
- 最新コミット: `f5540b7`
- OAuth開始: 正常
- 通知APIの保護: 正常
- `CRON_SECRET`(Production): 設定あり

## 補足
- Preview 環境には env が未設定だったため、Previewでの挙動確認が必要な場合は別途設定が必要。
