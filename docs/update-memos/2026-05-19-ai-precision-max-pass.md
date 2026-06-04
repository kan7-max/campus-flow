# 2026-05-19 AI Precision Max Pass

## 目的
- Inbox と AI抽出の候補精度を上げる
- 抽出・保存の体感待ち時間を短くする
- 既存UI・既存保存フローは壊さない

## 実装内容（最小変更）

### 1. AI抽出のハイブリッド統合
- 対象: `src/lib/ai/extractAssignmentInfo.ts`
- 変更:
  - OpenAI結果とヒューリスティック結果を統合する後処理を追加
  - 欠損項目（授業名/締切/提出先）を補完
  - 行動語タイトル（例: 「確認する」「作成する」）を課題名寄りに補正
  - 候補の重複除去とスコア順ソートを追加
  - サブタスク/学習計画の重複除去と整形を追加
  - OpenAI失敗時は既存通りヒューリスティックへ安全フォールバック

### 2. OpenAIプロンプト前処理を強化
- 対象: `src/lib/ai/providers/openaiAssignmentExtractor.ts`
- 変更:
  - LMSノイズ行の除去
  - 長文時は重要行（課題・締切・提出関連）を優先して圧縮
  - 入力文字数を絞って応答速度を改善
  - System指示を抽出品質重視に再調整

### 3. InboxでAIを使う閾値を見直し
- 対象: `src/lib/services/inboxParsingService.ts`
- 変更:
  - LMS系の長文はより早い段階でAI抽出に切り替えるよう調整
  - 短文はヒューリスティック維持で速度優先

### 4. 複数候補保存時の待ち時間最適化
- 対象: `src/lib/services/assignmentService.ts`
- 変更:
  - バルク保存時は `today` 再計算を候補ごとでなく最後に1回だけ実行
  - 単件保存時の既存挙動は維持

## 検証
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅

## 影響範囲
- 課題保存本体: 維持（best effort設計維持）
- Calendar同期/通知: 失敗しても保存成功扱いを維持
- UI: 変更なし（内部抽出ロジック中心）
