# 2026-05-19 AI Speed & Inbox Accuracy Pass

## 目的
- PDF抽出と課題保存の待ち時間を短縮する。
- Inbox課題整理の精度を改善する（長文/LMS文面での候補精度向上）。

## 変更内容

### 1) 抽出速度の改善
- `src/lib/ai/providers/openaiAssignmentExtractor.ts`
  - 入力テキストの上限を `12,000 -> 8,000` 文字へ調整。
  - 長文トリミングを `head 8,500 + tail 3,000` から `head 5,500 + tail 2,000` へ軽量化。
  - `max_tokens` を `1800 -> 1200` に調整。
  - システム指示で `memo / suggestedSubtasks / studyPlan` を簡潔に返すよう制約追加。

- `src/app/api/ai/extract-from-file/route.ts`
  - 高速抽出モードのモデル候補から `gpt-4o` を除外し、再試行時間を短縮。
  - タイムアウトを `fast: 28s -> 22s`, `quality: 60s -> 45s` に調整。

### 2) 保存速度の改善
- `src/lib/services/assignmentService.ts`
  - `saveAssignmentWithIntegrations` に任意の共有コンテキスト（settings/courses）を追加し、候補保存時の重複読込を削減。
  - Calendar同期と通知登録を直列実行から `Promise.allSettled` に変更（best effort設計は維持）。
  - AI候補一括保存時に設定・授業一覧を先読みして使い回すよう最適化。

- `src/components/ai/ai-chat-panel.tsx`
  - 保存API送信時、UI内部フラグを含まない最小payloadに整形して送信（転送量削減）。

### 3) Inbox精度の改善
- `src/lib/services/inboxParsingService.ts`
  - 短文は従来の高速ルールベースを維持。
  - 長文/ LMS系文面のみ AI抽出（OpenAI）を優先し、精度向上。
  - `parseInboxTextWithUsage` を追加し、利用モデル情報を呼び出し元へ返却。

- `src/lib/actions/inboxActions.ts`
  - Inbox整理ログの `model` を実際の解析モデルに合わせて記録するよう更新。

## 検証結果
- `npm run check` : ✅ 通過
- `npm run qa:mvp` : ⚠️ 未ログイン環境のため `401`（既存スクリプト前提に依存）

## 補足
- 課題保存本体優先の設計（外部連携失敗で保存失敗にしない）は維持。
- migrationや外部サービス設定の変更は未実施。
