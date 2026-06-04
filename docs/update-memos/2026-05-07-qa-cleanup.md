# Campus TaskFlow 更新メモ 2026-05-07

## 今回の目的

QAスクリプトが作るデモ課題で Dashboard / Today が散らかる問題を解消する。

## 変更内容

- `qa:mvp` の最後に、その実行で作成したQA課題だけを既存の課題削除Server Action経由でsoft deleteする処理を追加した。
- `qa:inbox` の最後に、その実行で作成したQA課題だけをsoft deleteする処理を追加した。
- 過去に溜まったQA課題を片付ける `npm run qa:cleanup` を追加した。
- `qa:cleanup` は `MVPQA######` / `IBXQA######` を含む未削除課題だけを対象にする。
- `qa:inbox` のToday確認は、表示枠から押し出された場合に失敗ではなくWARNにするよう調整した。

## 変更ファイル

- `scripts/qa-mvp-flow.mjs`
- `scripts/qa-inbox-multi-candidate.mjs`
- `scripts/cleanup-qa-demo-assignments.mjs`
- `package.json`
- `docs/update-memos/2026-05-07-qa-cleanup.md`

## 実行したコマンド

- `npm run qa:cleanup`: OK
  - 過去QA課題24件をsoft delete
- `npm run qa:mvp`: OK
  - 新規作成2件を検証後にsoft delete
- `npm run qa:inbox`: OK
  - 新規作成3件を検証後にsoft delete
- `npm run check`: OK

## 確認結果

- `.taskflow-demo-store.json` 上のアクティブなQA課題: 0件
- `/dashboard` にQA prefix表示なし
- `/today` にQA prefix表示なし
- `/dashboard` / `/today` Runtime Errorなし
- 折り畳みパネル表示は維持

## 注意点

- `qa:cleanup` はQA prefix付きの未削除課題だけをsoft deleteする。
- Inbox item自体はraw text保持方針のため削除しない。
- 本番Supabaseや外部サービス設定には触れていない。

## 次に優先する作業

1. `/ai` と `/inbox` の候補プレビュー表示を近づける。
2. スマホ幅で折り畳みsummaryが読みにくくないか確認する。
3. QA用Inbox itemが処理済み一覧に増えすぎる場合、表示側で折り畳みや件数制限を調整する。
