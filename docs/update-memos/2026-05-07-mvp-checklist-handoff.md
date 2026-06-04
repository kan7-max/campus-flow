# 2026-05-07 MVPチェックリスト・引き継ぎ整理メモ

## 今回の目的

MVP完了前の残作業を見える化し、次回以降すぐ続きに入れるように最新版のチェックリストと引き継ぎメモを作成する。

## 変更したファイル

- `scripts/cleanup-qa-demo-assignments.mjs`
- `docs/mvp-completion-checklist.md`
- `docs/handoff-latest.md`
- `docs/update-memos/2026-05-07-mvp-checklist-handoff.md`

## 変更内容

- QA掃除スクリプトの対象に `UIQA` を追加
- MVP中核フローの完了前チェックリストを作成
- 最新版の引き継ぎメモを作成
- 現在進捗を約94%として整理
- 未適用migration、本番Supabase注意、OneDrive / `.next` 注意を再整理

## 確認結果

- `node --check scripts/cleanup-qa-demo-assignments.mjs` OK
- `npm run check` OK
- `npm run qa:cleanup` OK
- `npm run qa:mvp` OK
- `npm run qa:inbox` OK
- QA用データは各QA内で削除済み

## 残っている課題

- スマホ幅相当の最終目視QA
- 本番Supabase migration適用手順書の作成
- MVP完了宣言前の最終確認

## 次に優先すべき作業

1. スマホ幅で `/ai`, `/inbox`, `/today`, `/dashboard`, `/assignments/[id]` を確認
2. 問題なければMVP完了宣言用の最終QAを実行
3. 本番Supabase migration適用手順書を作成
