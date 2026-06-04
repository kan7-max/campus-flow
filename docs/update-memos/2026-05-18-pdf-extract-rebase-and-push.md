# 2026-05-18 PDF抽出修正のrebase反映メモ

## 実施内容
- `src/app/api/ai/extract-from-file/route.ts` を更新
  - `file.type` が空でも `.pdf` 拡張子でPDF判定できるように修正
  - `403` 時に即中断せず、次モデルへフォールバックするよう調整
  - PDF抽出モデル候補を `gpt-4o-mini` 優先で試行

## Git反映
- commit: `acdd83c`
- branch: `main`
- push: `origin/main` へ反映済み

## 補足
- rebase中に `scripts/qa-release-local.ps1` と `scripts/qa-secrets-static.mjs` の未追跡衝突が発生したため、
  ローカル退避ディレクトリ `.tmp-git-backup/` にバックアップを作成して解消。
- バックアップ版と最新追跡版のハッシュは一致していないため、必要なら内容比較を行う。

## 検証
- `npm run typecheck` PASS

## 次の確認
1. Vercel本番を再デプロイ（自動済みなら最新デプロイ完了待ち）
2. `/ai` で PDF を「高速抽出」で再テスト
3. 失敗時は `/api/ai/extract-from-file` のレスポンス文言を記録（次の切り分け用）

