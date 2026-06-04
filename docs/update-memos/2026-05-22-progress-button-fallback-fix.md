# 2026-05-22 Progress Button Fallback Fix

## 背景
- 進捗％ボタンが反映されない事象が継続。
- 原因の一つとして、`/api/assignments/progress` が未反映の環境で更新APIが失敗すると反映不能になる経路があった。

## 修正
- `src/components/assignments/assignment-progress-panel.tsx`
  - 進捗保存を `fetch("/api/assignments/progress")` で実行。
  - `response.ok` 以外のときは `setAssignmentProgressAction` にフォールバック。
  - これにより、APIルート未反映時でも既存Server Action経路で保存可能にした。
  - `credentials: "same-origin"` を明示。

## 補足
- `src/app/api/assignments/progress/route.ts` をGit追跡対象に追加して、API経路をVercelにも確実に反映できる状態にした。

## 検証
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm run check`: pass
