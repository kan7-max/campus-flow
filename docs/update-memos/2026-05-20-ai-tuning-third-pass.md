# 2026-05-20 AI Tuning Third Pass

## 目的
- AI抽出の精度を維持/改善しつつ、体感待ち時間を短縮する
- Inboxの候補精度が低くなりやすい短文/曖昧入力でAI活用率を上げる

## 変更内容（最小変更）
- `src/lib/ai/extractAssignmentInfo.ts`
  - `heuristic-fast-path` を追加
  - 短文・高信頼・欠損なしケースは OpenAI 呼び出しを省略し即時返却
  - OpenAI失敗時フォールバックは事前計算した heuristic 結果を返すよう整理
- `src/lib/services/inboxParsingService.ts`
  - 先に heuristic で一次判定
  - 「候補複数」「締切/授業名欠損」「低信頼」「LMS信号あり」などのケースで AI 抽出を積極利用
  - 単純ケースは heuristic を返して高速化
- `src/lib/ai/providers/openaiAssignmentExtractor.ts`
  - 入力長に応じた `max_tokens` の可変化（750/900/1000）
  - system 指示を補強（複数課題分離、quiz/exam/presentationの日付解釈、memo簡潔化）

## 検証
- `npm run check` ✅
- `npm run qa:mvp` ✅
- `npm run qa:inbox` ✅
- `npm run qa:preprod` ✅
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` ✅
  - 途中で OneDrive `.next` `readlink` エラー再発
  - 既定手順（dev停止→`.next`削除→再build）で解消

## 運用メモ
- dev server は `TASKFLOW_DEMO_MODE=1` で `http://localhost:3000` 起動済み
- OneDrive 配下では build 後に `.next` 再生成手順を優先
