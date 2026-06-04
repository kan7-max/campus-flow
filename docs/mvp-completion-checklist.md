# Campus TaskFlow MVP完成チェックリスト

## 現在の進捗

ローカルdemo MVPは完成。

本番一般リリースは未完了。未適用migration、外部サービス設定、法務・安全導線が残っている。

中核フロー:

1. AI入力
2. 複数課題候補抽出
3. プレビュー編集
4. 選択保存
5. `/assignments` 反映
6. `/today` 反映
7. 課題詳細確認

## 完了済み

- `/ai` で長文から複数候補を抽出できる
- `/ai` で候補ごとに概要を確認できる
- `/ai` で候補を選択して保存できる
- `/ai` 保存後に保存完了、保存済み件数、保存課題リンクが表示される
- `/inbox` で複数候補を候補ごとに表示できる
- `/inbox` で候補ごとに保存できる
- `/inbox` で部分保存時は `parsed`、全候補保存時は `saved` 扱い
- `raw_text` は保持される
- `/assignments` に保存結果が反映される
- `/today` に保存結果が反映される
- Home / Today で低優先パネルを折り畳み表示に整理
- AI / Inboxで保存した直近締切課題を `新しく整理した課題` として表示
- Calendar同期失敗が課題保存失敗にならない設計を維持
- demo modeで主要フロー確認済み
- QA用データ削除スクリプトあり

## 最終確認済みコマンド

- `npm run lint` OK
- `npm run typecheck` OK
- `npm run check` OK
- `npm run qa:mvp` OK
- `npm run qa:inbox` OK
- `npm run qa:preprod` OK
- `npm run qa:cleanup` OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` OK

## MVP完了前に残っていること

- スマホ幅相当で `/ai`, `/inbox`, `/today`, `/dashboard`, `/assignments/[id]` を追加目視確認
- スマホで候補カード、保存ボタン、折り畳みパネルが押しやすいか追加確認
- 本番SupabaseへはCodexが勝手に適用しない
- 最終引き継ぎメモを最新状態に保つ

## 本番化前に必須

- 未適用migrationのSQL適用
- RLS policy確認
- Google OAuth設定確認
- Vercel環境変数確認
- プライバシーポリシー、利用規約、データ削除導線
- service role keyがクライアントへ出ていないことの確認
- 実行チェックシート: `docs/release-preprod-runbook.md`
- 実施記録テンプレ: `docs/release-preprod-execution-template.md`

## 次の推奨作業

1. スマホ幅の追加目視QA
2. 本番Supabase migration適用
3. 一般リリース前の法務・安全導線整理
4. 実ユーザー試用前のデータ保護確認
