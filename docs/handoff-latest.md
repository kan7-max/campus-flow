# Campus TaskFlow 引き継ぎメモ 最新版

## 作業場所

Repository root

## 起動状態

- dev server: `http://localhost:3000`
- demo mode: `TASKFLOW_DEMO_MODE=1`
- build後はOneDrive配下 `.next` の `ENOENT` / `readlink` 系エラーが出ることがある
- build後に画面確認する場合は、dev server停止、`.next` 削除、demo mode dev server再起動を優先

## 最重要方針

- 課題保存本体を最優先
- AI解析、Calendar同期、通知、study block生成、assignment step生成はbest effort
- 外部連携失敗で課題保存を失敗扱いにしない
- `raw_text` やユーザー入力は失敗時も消さない
- DB未適用でも画面を白画面にしない
- 本番Supabase migrationや外部サービス設定はCodexが勝手に実行しない

## 現在の進捗

ローカルdemo MVPは完成。

本番一般リリースは未完了。Supabase migration適用、外部サービス設定、法務・安全導線は別工程。

安定化済みフロー:

1. `/ai` 入力
2. 複数課題候補抽出
3. プレビュー確認・編集
4. 選択保存
5. `/assignments` 反映
6. `/today` 反映
7. 課題詳細確認

## 最近完了したこと

### Inbox複数候補保存

- `alternativeCandidates` を候補ごとに表示
- 候補ごとに保存
- 保存済み候補と未保存候補を区別
- 部分保存は `parsed` のまま
- 全候補保存後は `saved`
- `savedCandidateAssignmentIds` で保存状態を保持
- `raw_text` は保持

### `/ai` プレビュー改善

- 候補カードを折り畳み式に変更
- 候補数、選択中、保存済み件数を表示
- `未保存`、`保存対象`、`保存済み`、`要確認` を分かりやすく表示
- 保存後に保存課題リンクを表示

### Today / Home 情報整理

- 低優先パネルを折り畳み
- `今日やること`、`今日のタイムライン`、`今はこれだけ`、AI入力導線を優先
- `/today` では `今はこれだけ` を `今日のタイムライン` より上に表示
- 今日使える時間と今日のモードは選択後に小さくまとまる
- AI / Inbox保存直後の直近締切課題を `新しく整理した課題` として表示

### QA整備

- `npm run qa:mvp`
- `npm run qa:inbox`
- `npm run qa:cleanup`
- `qa:cleanup` は `MVPQA`、`IBXQA`、`UIQA` を対象

## 確認済み

- `/ai` 抽出、プレビュー、保存、保存済み表示 OK
- `/inbox` 複数候補、候補別保存 OK
- `/assignments` 反映 OK
- `/today` 反映 OK
- `/dashboard` 反映 OK
- `/dashboard`, `/today`, `/inbox` のconsole error 0件
- QA用データ削除 OK

## 最終実行コマンド

- `npm run lint` OK
- `npm run typecheck` OK
- `npm run check` OK
- `npm run qa:mvp` OK
- `npm run qa:inbox` OK
- `npm run qa:cleanup` OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint` OK

## 未適用migration

本番Supabaseには勝手に適用しない。

- `supabase/migrations/20260430_sync_outbox.sql`
- `supabase/migrations/20260430_work_sessions.sql`
- `supabase/migrations/20260430_study_blocks.sql`
- `supabase/migrations/20260430_assignment_steps.sql`

必要になったら、SQL Editorでの手順と確認項目だけ提示して止まる。

## 残タスク

- スマホ幅相当の追加目視QA
- 本番Supabase migration適用
- 一般リリース前のプライバシー、利用規約、データ削除導線

## 次にやるべきこと

1. スマホ幅で `/ai`, `/inbox`, `/today`, `/dashboard`, `/assignments/[id]` を追加確認
2. 本番Supabase適用手順に沿ってユーザーがSQLを適用
3. 一般リリース前の安全確認へ進む
