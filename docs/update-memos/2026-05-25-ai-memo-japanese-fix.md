# 2026-05-25 AIメモ英語化バグ修正

## 事象
- PDF抽出→プレビュー作成後の課題候補で、`memo` が英語になるケースがあった。

## 原因
- OpenAI抽出プロンプトが英語中心で、`memo` 言語を明示的に制御していなかった。
- 日本語ソース時でも英語メモが返る場合の後処理がなかった。

## 対応
- `src/lib/ai/providers/openaiAssignmentExtractor.ts` を修正。
  - 日本語優勢ソースを判定する関数を追加。
  - 日本語優勢ソース時は、英語優勢の `memo` を日本語ソースから再構成して置換。
  - 置換できない場合は日本語フォールバック文を設定。
  - システムプロンプトに「日本語ソース時は summary/memo/subtasks/studyPlan を日本語で返す」制約を追加。
  - `summary` も日本語優勢ソースで英語のみの場合は日本語文へ補正。

## 検証
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run check` ✅

