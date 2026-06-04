# 2026-05-07 追加作業メモ（PDF抽出モデル自動切替）

## 背景

- PDF抽出で文字化けが継続
- `OPENAI_MODEL` がPDF入力非対応モデルの場合、AI抽出に失敗し fallback 側（簡易読み取り）へ戻る可能性があった

## 対応

1. PDF抽出時のモデル候補を追加
   - 優先順: `OPENAI_PDF_MODEL` -> `gpt-4o-mini` -> `gpt-4o` -> `OPENAI_MODEL`
2. モデルごとに順次試行し、成功したものを採用
3. 抽出結果が破損判定の場合は次候補へ自動再試行
4. すべて失敗したときのみ既存fallbackへ

## 変更ファイル

- `src/lib/env.ts`
- `src/app/api/ai/extract-from-file/route.ts`

## 検証

- `npm run check` PASS
- `npm run qa:mvp` PASS

