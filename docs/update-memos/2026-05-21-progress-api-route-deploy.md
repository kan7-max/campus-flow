# 2026-05-21 Progress API Route Deploy

## 目的
- `/assignments/[id]` の進捗更新で、UI反映から保存完了までの体感遅延を下げる。

## 実施内容（最小変更）
- `src/components/assignments/assignment-progress-panel.tsx`
  - 進捗保存を Server Action 直呼びから `POST /api/assignments/progress` へ変更。
  - optimistic update（即時UI反映）と失敗時ロールバックを維持。
  - `response.ok` 判定を追加し、失敗時に例外処理へ集約。

## 検証
- `npm run lint` : pass
- `npm run typecheck` : pass
- `npm run check` : pass

## 反映
- commit: `f0428bc`
- branch: `main`
- push: `origin/main` 完了（Vercel 自動デプロイトリガー）
