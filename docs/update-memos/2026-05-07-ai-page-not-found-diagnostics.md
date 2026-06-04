# 2026-05-07 追加作業メモ（AIページ not found 診断と安定化）

## 事象

- ユーザー報告: `/ai` が見つからない、エラーが多い

## 診断結果

1. 同一ワークスペースで `:3000` と `:3001` の Next dev server が同時起動していた
   - `.next` 生成物の競合でルート挙動が不安定化する可能性
2. OneDrive配下のdemo store保存で `rename EPERM` が継続発生
   - 既存実装では `direct write` フォールバックがあり、読み込みタイミング次第でJSON不整合が起きやすい

## 対応

1. dev serverを1本化
   - `:3000` のみ起動（`TASKFLOW_DEMO_MODE=1`）
   - `.next` を削除してクリーン再起動
2. demo store保存を安全化
   - `src/lib/mock/store.ts` を修正
   - `rename` 失敗時は `.taskflow-demo-store.latest.json` へスナップショット保存
   - 起動時は `mtime` が新しい方（main/latest）を読み込む
   - 壊れたJSON読み込み時は警告して次候補へフォールバック

## 検証

- `npm run check` PASS
- `npm run qa:mvp` PASS
- HTTP確認:
  - `http://127.0.0.1:3000/ai` 200
  - `http://127.0.0.1:3000/dashboard` 200
  - `http://127.0.0.1:3000/inbox` 200
  - `http://127.0.0.1:3000/today` 200

