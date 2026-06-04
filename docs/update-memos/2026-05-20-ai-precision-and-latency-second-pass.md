# 2026-05-20 AI Precision and Latency Second Pass

## 目的
- Inbox整理とAI抽出の体感速度をさらに改善
- 候補精度改善の流れを維持しつつ、保存待ちを短縮

## 実装内容（最小変更）

### 1) Inbox解析結果キャッシュ
- 変更: `src/lib/services/inboxParsingService.ts`
- 内容:
  - `rawText` ベースのSHA1キーで解析結果をメモリキャッシュ
  - TTL 10分 / 最大64件
  - 同一テキストの再解析（再試行や編集往復）で待ち時間を短縮

### 2) 保存時の外部連携を非同期実行可能に
- 変更: `src/lib/services/assignmentService.ts`
- 内容:
  - `saveAssignmentWithIntegrations` に `deferIntegrations` オプションを追加
  - `deferIntegrations=true` のとき、Calendar同期/通知スケジュールを待たずに非同期実行
  - 課題保存本体の完了を優先し、外部連携はbest effortを維持
  - AI複数候補保存フローでは `deferIntegrations=true` を適用

### 3) Inbox候補保存にも非同期連携を適用
- 変更: `src/lib/actions/inboxActions.ts`
- 内容:
  - Inboxから候補を課題保存する導線で `deferIntegrations=true` を利用
  - 保存ボタン後の待機を短縮

## 検証
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅

## 備考
- 課題保存本体は従来通り優先成功
- Calendar/通知は失敗しても保存成功扱いの方針を維持
