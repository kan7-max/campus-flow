# 2026-05-22 Checklist Tap & Google Sync Hotfix

## 目的

- チェックリスト丸ボタンの「押しても反応しない」体感を改善
- Google Calendar未連携時の同期エラー多発を抑制

## 変更

### 1) チェックリストトグル後の進捗更新を best effort 化

- `src/lib/actions/assignmentActions.ts`
  - `toggleAssignmentStepAction` 内で `updateProgressAndStatus` が失敗しても
    トグル自体を無効化しないよう `try/catch` を追加。
  - これにより、進捗更新失敗でUI反映まで止まる経路を回避。

### 2) Google Calendar同期を連携ONユーザーのみに限定

- `src/lib/services/assignmentService.ts`
  - `settings.googleCalendarEnabled === true` の場合のみ
    `queueAndTryAssignmentCalendarSync` を実行。
  - 未連携ユーザーでは同期キュー投入をスキップし、不要な失敗を抑制。

### 3) OAuth成功時にGoogle連携フラグを有効化

- `src/app/api/google-calendar/callback/route.ts`
  - トークン保存時に `googleCalendarEnabled: true` を同時保存。

### 4) 手動トークン保存でも連携フラグを同期

- `src/lib/actions/settingsActions.ts`
  - `saveGoogleCalendarTokenAction` で Access Token がある場合
    `googleCalendarEnabled: true` を保存。

## 実行結果

- `npm run check` ✅

