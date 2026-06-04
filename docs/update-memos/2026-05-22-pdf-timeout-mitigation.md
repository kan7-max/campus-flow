# 2026-05-22 PDF Timeout Mitigation

## 変更目的
- `/api/ai/extract-from-file` で `PDF抽出がタイムアウトしました` が出やすい問題を最小変更で軽減。

## 変更内容
- `src/app/api/ai/extract-from-file/route.ts`
  - Route runtime を `nodejs` 明示。
  - `maxDuration = 120` を追加（Vercel上の実行時間上限を広げる意図）。
  - PDF抽出タイムアウトを延長:
    - `fast: 28s`（旧 16s）
    - `quality: 75s`（旧 45s）
  - `quality` モードがタイムアウトした場合、
    - 自動で `fast` モードへ1回フォールバック。
    - 成功時は `warning` を返し、画面側で「精度重視タイムアウト→高速抽出結果」を表示。

## 影響範囲
- PDF/画像アップロード抽出APIのみ。
- 課題保存、通知、認証には影響なし。

## 検証
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅
