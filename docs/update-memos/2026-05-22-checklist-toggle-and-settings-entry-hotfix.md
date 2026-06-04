# 2026-05-22 Checklist Toggle & Settings Entry Hotfix

## 変更内容

- `src/components/assignments/assignment-step-panel.tsx`
  - 完了/未完了トグルを常時押せるように変更（完了済み課題でも解除可能）。
  - 並び替えボタンは従来どおり `legacy` と完了課題で無効。

- `src/components/layout/mobile-nav.tsx`
  - モバイル下部ナビに `設定 (/settings)` タブを追加。
  - グリッド列を `5 -> 6` に変更。

- `src/components/layout/top-bar.tsx`
  - 上部バーに `設定` ボタンを追加（モバイルでも到達可能な導線を確保）。

- `src/lib/repositories/assignmentStepRepository.ts`
  - フォールバック/デモ時に `legacy-<id>` のトグル更新を `subtasks` へ反映する処理を追加。

## 確認

- `npm run check` ✅

