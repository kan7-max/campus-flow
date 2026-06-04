# 2026-05-21 Image OCR Enable Pass

## 事象
- `/api/ai/extract-from-file` の画像分岐が固定で `ocr-not-enabled` を返していたため、
  画像アップロード時に常に「画像OCRはまだ有効ではありません。」となっていた。

## 対応
- 画像ファイルに対して OpenAI Responses API を使う OCR 処理を追加。
- モード連動:
  - `fast` -> 低詳細・短め出力
  - `quality` -> 高詳細・広め出力
- 画像サイズ上限 (6MB) を追加。
- 失敗時の日本語エラーメッセージを追加。
- 旧 `ocr-not-enabled` 固定分岐を削除。

## 変更ファイル
- `src/app/api/ai/extract-from-file/route.ts`
- `src/lib/env.ts`
- `.env.example`

## 環境変数
- 必須: `OPENAI_API_KEY`
- 任意: `OPENAI_IMAGE_MODEL`（未設定時は `gpt-4o-mini` 優先）

## 検証
- `npm run lint` PASS
- `npm run typecheck` PASS
- `npm run check` PASS
