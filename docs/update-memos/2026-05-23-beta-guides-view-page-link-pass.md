# 2026-05-23 Beta Guides View Page Link Pass

## 目的
- β資料ボタン押下時にファイル直接ダウンロードではなく、スライド閲覧ページへ遷移するよう変更。

## 変更内容（最小）
- `src/app/(app)/beta-guides/page.tsx` を追加
  - `?view=pc` / `?view=mobile` 切替対応
  - Office Web Viewer埋め込みでPPTXをページ内表示
  - 直接ファイルリンクはフォールバックとして維持
- `src/components/layout/beta-tester-guides-gate.tsx`
  - 初回ガイド内の資料ボタン遷移先を `.pptx` 直リンクから `/beta-guides` へ変更
- `src/app/(app)/admin/page.tsx`
  - 管理画面の資料ボタン遷移先を `.pptx` 直リンクから `/beta-guides` へ変更

## 検証
- `npm run lint` 成功
- `npm run typecheck` 成功
- `npm run check` 成功

## 反映
- GitHub `main` に push 済み（commit: `f05637a`）
- Vercel production deployment `new-project-e7ollenmj-kan7-maxs-projects.vercel.app` が `Ready`
