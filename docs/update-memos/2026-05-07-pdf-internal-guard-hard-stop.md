# 2026-05-07 追加作業メモ（PDF内部構造ガード）

## 背景

- PDF抽出で本文ではなく `%PDF-` / `obj` / `stream` などの内部構造文字列が `rawText` に混入するケースがあった
- 原因の一つとして、`/api/ai/extract-from-file` のPDF fallbackで `file.text()` を使っていた

## 対応

1. PDF内部構造の検出ユーティリティを追加
   - `src/lib/ai/pdfInternalTextGuard.ts`
   - `%PDF-`、`startxref`、`%%EOF`、`FlateDecode`、`obj/stream` 多発などを検出
2. `/api/ai/extract-from-file` のPDF fallbackを変更
   - PDFを `file.text()` で本文扱いしない
   - OpenAI抽出が失敗、または内部構造検出時はAI入力に渡さず日本語エラーで停止
3. `/api/ai/extract` でも二重ガード
   - `sourceType=pdf` かつ内部構造文字列なら抽出処理を実行せずに日本語エラー返却
4. 既存方針維持
   - 通常テキスト入力フローは維持
   - 失敗時も画面全体が落ちないように維持
   - Calendar同期と課題保存の分離方針には影響なし

## 変更ファイル

- `src/lib/ai/pdfInternalTextGuard.ts`
- `src/app/api/ai/extract-from-file/route.ts`
- `src/app/api/ai/extract/route.ts`

## 実行結果

- `npm run lint` PASS
- `npm run typecheck` PASS
- `npm run check` PASS
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` PASS

