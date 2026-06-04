# 2026-05-07 ローカルdemo MVP完成メモ

## 今回の目的

Campus TaskFlowのMVP中核フローを、ローカルdemo環境で完成扱いにできる状態まで確認する。

## 完成扱いにした範囲

ローカルdemo MVP:

1. AI入力
2. 複数課題候補抽出
3. プレビュー確認・編集
4. 選択保存
5. `/assignments` 反映
6. `/today` 反映
7. 課題詳細確認
8. Inbox複数候補の候補別保存
9. Home / Today の情報量整理

## 変更したファイル

- `docs/mvp-completion-checklist.md`
- `docs/handoff-latest.md`
- `docs/supabase-migration-application-guide.md`
- `docs/update-memos/2026-05-07-mvp-complete.md`

## 確認結果

- `npm run check` OK
- `npm run qa:mvp` OK
- `npm run qa:inbox` OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` OK
- build後に `.next` を削除してdemo dev serverを再起動済み
- `npm run qa:cleanup` OK
- 主要画面ブラウザ巡回 OK
  - `/`
  - `/dashboard`
  - `/today`
  - `/ai`
  - `/inbox`
  - `/assignments`
- アプリ側console error 0件

## 現在の状態

- dev server: `http://localhost:3000`
- demo mode: `TASKFLOW_DEMO_MODE=1`
- ローカルdemo MVPは完成
- 本番一般リリースは未完了

## 本番前に残っていること

- 本番Supabase migration適用
- RLS確認
- Google OAuth / Calendar設定確認
- Vercel環境変数確認
- プライバシーポリシー、利用規約、データ削除導線
- 実ユーザー試用前のデータ保護確認

## 次に優先すべき作業

1. 本番Supabase migrationをユーザーがSQL Editorで適用
2. 本番相当環境でログインから課題保存まで確認
3. 一般リリース前の安全・法務導線を作る
