# 2026-05-23 Admin Local Access Fallback

## 背景
- `/admin` / `/admin/credits` に入れない問題を確認
- 原因は `ADMIN_EMAILS` / `OPERATIONS_ADMIN_EMAILS` 未設定時に常時拒否される仕様

## 対応
- `src/lib/adminAccess.ts` に開発環境限定フォールバックを追加
  - 条件: `NODE_ENV !== "production"` かつ adminメール設定が空
  - 上記条件では、ローカル開発中のみ管理ページアクセスを許可
  - 本番(`production`)は従来どおり adminメール一致必須

## 影響
- `localhost` で運営ページに入れない問題を即時解消
- 本番の権限制御は維持
