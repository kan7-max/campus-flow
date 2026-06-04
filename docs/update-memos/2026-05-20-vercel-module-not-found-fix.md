# 2026-05-20 Vercel Module Not Found Fix

## 症状
- Vercel build で以下が発生:
  - `Module not found: Can't resolve '@/lib/ai/dueDateYearNormalizer'`

## 原因
- `src/lib/ai/dueDateYearNormalizer.ts` がローカルには存在したが、Git追跡対象に入っていなかった。
- ローカルWindowsでは気づきにくいが、Vercel(Linux)では未存在扱いでビルド失敗。

## 対応
- `src/lib/ai/dueDateYearNormalizer.ts` をGitに追加して commit / push。
- commit: `87a7a27`

## 次の確認
- Vercelで最新commitを再デプロイし、ビルドログで同エラー消失を確認。
