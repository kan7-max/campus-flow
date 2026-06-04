# 2026-05-22 Checklist / Mobile Settings / Notification Check

## 対応内容

1. チェックリストの丸ボタン押下不具合を修正
   - `legacy-` ステップでも完了/未完了トグルを許可。
   - 並び替えは従来どおり `legacy-` を無効のまま維持。

2. デモ/フォールバック時の legacy ステータス反映を修正
   - `updateAssignmentStepStatus` で `legacy-<id>` を `subtasks` に反映するよう修正。

3. スマホ下部ナビに設定タブを追加
   - `/settings` への導線をモバイルナビに追加。
   - グリッド列数を 5 → 6 に更新。

## 通知設定の確認結果

- `SettingsForm` の通知スイッチ (`email`, `webPush`, `oneWeek`, `threeDays`, `oneDay`, `sameDayMorning`) は
  `updateSettingsAction` に送信される。
- `updateSettingsAction` は `patchUserSettings` を通じて `user_settings.notification_config` を更新。
- 課題保存時 (`saveAssignmentWithIntegrations`) は最新の `settings.notificationConfig` を参照し、
  `scheduleAssignmentNotifications` に渡してキュー投入する。
- 外部連携失敗は `Promise.allSettled` で吸収され、課題保存本体は失敗扱いにしない設計を維持。

## 実行コマンド

- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅

