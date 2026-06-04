# 2026-05-07 追加作業メモ（実PDFでの抽出精度確認）

## 対象ファイル

- Local real-course PDF path redacted before public release.

## 確認結果

1. 旧方式での問題再現（参考）
   - PDFバイナリをUTF-8文字列として読むと `%PDF-1.5` / `obj` / `stream` / `FlateDecode` が大量出現
   - このPDFは本文ではなく内部構造文字列として扱われる典型パターン
2. 現在の `/api/ai/extract-from-file`
   - 同PDF投入で `400` を返却
   - エラー文言: `PDF本文をうまく読み取れませんでした。WebClass本文をコピーして貼り付けてください。`
   - PDF内部構造をAI抽出へ渡さないことを確認
3. 現在の `/api/ai/extract`
   - `sourceType=pdf` で内部構造文字列を送ると `400` を返却
   - 二重ガードが機能

## 補足

- OpenAI PDF抽出の実測（本文品質比較）は、`.env.local` の `OPENAI_API_KEY` がプレースホルダのため実行不可（401）。
- したがって本確認で保証できるのは「文字化けデータを通さない安全性」。本文抽出精度の最終比較は有効キー設定後に再実行が必要。
