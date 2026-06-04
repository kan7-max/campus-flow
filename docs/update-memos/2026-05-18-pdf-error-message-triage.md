# 2026-05-18 PDF抽出エラー文の切り分け改善

## 変更概要
- `src/app/api/ai/extract-from-file/route.ts` に、PDF抽出失敗理由をユーザー向け日本語メッセージへ変換する処理を追加。
- これまで常に同じ文言（PDF本文をうまく読み取れませんでした）だった箇所を、主原因に応じて分岐:
  - タイムアウト
  - APIキー不正/未反映
  - quota/rate limit
  - PDF対応モデル未許可

## 目的
- 「なぜ失敗したか」を画面上で判断できるようにして、次アクション（ENV再設定、再デプロイ、モード切替）を即断できるようにする。

## Git反映
- commit: `971e22e`
- branch: `main`
- push: `origin/main` 反映済み

## 確認
- `npm run typecheck` PASS

