# 2026-05-24 Setup Reflection Compat Fix

## 目的
- `/setup` 保存時に `setup=db_missing` へ戻され、入力内容が反映されない問題を解消。

## 変更内容
- `src/lib/repositories/settingsRepository.ts`
  - `user_settings` の一部列が未適用でも保存を継続できる互換処理を追加。
  - `notification_config.__setupCompat` に setup 関連値を退避し、列不足時も再表示へ反映。
  - `display_name / onboarding_completed / preferred_* / ai_enabled / google_calendar_enabled / setup_course_names` が欠けている更新失敗時、該当列を除外して自動リトライする処理を追加。
  - `mapSettings` で `__setupCompat` を読み、setup画面・dashboard側の値にフォールバック。

## 期待効果
- 本番DBが新列未適用でも setup 入力値が保存・再表示される。
- `onboardingCompleted` フラグ相当も互換保存されるため、setup完了後に導線が進む。

## 実行確認
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅
