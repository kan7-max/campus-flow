# 2026-05-28 Timetable Extract Accuracy Image/PDF Pass

## 目的

- 授業AI抽出で、画像/PDF内の開始時刻・終了時刻など細かい情報の取りこぼしを減らす。

## 変更

### 1) 時間割抽出に開始/終了時刻を追加

- `src/lib/ai/timetableImageExtractor.ts`
  - 候補型を拡張:
    - `period: number | null`
    - `startTime: string | null`
    - `endTime: string | null`
  - 小さい文字の読取を促す抽出プロンプトへ更新。
  - 時刻正規化を追加:
    - 全角数字対応
    - `9:00`, `９：００`, `9時`, `0900` などを `HH:MM` へ変換
    - `09:00-10:30`, `9時〜10時30分` などの時間帯を開始/終了へ分解
  - 曜日不明のみ除外し、時限未取得でも時刻が取れる候補を残すように変更。
  - 画像OCR detail を `high` 固定にして細字の読取精度を優先。

### 2) PDF時間割抽出を追加

- `src/lib/ai/timetableImageExtractor.ts`
  - `extractTimetableCandidatesFromPdf` を追加。
  - PDFを `input_file` で渡し、同じ構造化JSONへ正規化。

### 3) 抽出APIを画像+PDF対応に拡張

- `src/app/api/ai/extract-timetable/route.ts`
  - 対応ファイルを画像のみから「画像またはPDF」に拡張。
  - 画像は画像抽出、PDFはPDF抽出へ自動分岐。
  - レスポンス候補に `startTime/endTime` を追加。
  - サイズ上限を分離（画像6MB / PDF8MB）。
  - 失敗時は従来どおり `candidates: [] + fallbackReason` を返す。

### 4) 画面側で抽出時刻を反映

- `src/components/courses/course-image-importer.tsx`
  - 候補型を `startTime/endTime` 対応へ更新。
  - 抽出済み時刻がある場合はその値を優先し、未取得時のみ時限マップで補完。
  - 入力受け付けを `image/*` から `image/*,.pdf` に拡張。
  - 文言を「画像/PDF」対応に更新。

## 実行結果

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅
