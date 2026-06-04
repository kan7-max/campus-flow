# 2026-05-07 追加作業メモ（PDF抽出の文字化け対策）

## 背景

- `/api/ai/extract-from-file` のPDF処理が `file.text()` の簡易読み取りのみで、文字化けしやすかった

## 対応

1. PDF抽出をOpenAIのPDF入力（Responses API）へ対応
   - `input_file` + `input_text` で本文抽出
   - `output_text` を抽出結果として利用
2. OpenAI失敗時のfallbackを維持
   - 既存のbest-effort方針を維持
3. 文字化け判定を追加
   - 抽出結果が破損パターンの場合は空テキスト + 日本語警告へ
4. 8MB超PDFのガードを追加
5. ファイル抽出UIで warning 表示を追加

## 変更ファイル

- `src/app/api/ai/extract-from-file/route.ts`
- `src/components/ai/file-extract-panel.tsx`

## 実行結果

- `npm run check` PASS
- `npm run qa:mvp` PASS

