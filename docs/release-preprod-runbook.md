# Campus TaskFlow 本番化前 実行チェックシート

## 目的

本番リリース直前に、MVP中核フローを壊さずに公開できるかを同じ順序で確認する。  
このドキュメントは「手順提示」のみ。Codexは本番環境へ変更を直接適用しない。

実施記録は `docs/release-preprod-execution-template.md` を使う。

## 実施日・担当

- 実施日:
- 担当:
- 対象環境: production / staging

## 入力場所マップ（最初に確認）

1. 実施結果の記録先  
   `docs/release-preprod-execution-template.md`
2. migration SQLの入力先  
   Supabase Dashboard -> 対象Project -> SQL Editor -> New query
3. DB確認SQLの入力先  
   Supabase SQL Editor（`supabase/verification/release_preprod_checks.sql` を貼り付け）
4. OAuth設定の入力先  
   Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs
5. 環境変数の入力先  
   Vercel -> Project -> Settings -> Environment Variables

## 0. ローカル最終回帰（事前）

以下がすべて `OK` であること:

1. `npm run check`
2. `npm run qa:mvp`
3. `npm run qa:inbox`
4. `npm run qa:preprod`
5. `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint`

## 1. Supabase migration 手動適用（SQL Editor）

### 1-1. 適用対象の確認

本番で未適用のものだけを、以下順で実行する。

1. `supabase/migrations/20260430_sync_outbox.sql`
2. `supabase/migrations/20260430_work_sessions.sql`
3. `supabase/migrations/20260430_study_blocks.sql`
4. `supabase/migrations/20260430_assignment_steps.sql`
5. `supabase/migrations/20260501_inbox_items.sql`（未適用なら）
6. `supabase/migrations/20260501_ai_usage_logs.sql`（未適用なら）
7. `supabase/migrations/20260501_ai_credit_balances.sql`（未適用なら）

### 1-2. 実行ルール

1. 必ず1ファイルずつ実行
2. エラーが出たら次へ進まず停止
3. エラー内容と対象ファイル名を控える

### 1-3. SQL Editorでの具体手順（入力場所）

1. Supabase Dashboardで本番Projectを開く
2. 左メニュー `SQL Editor` を開く
3. `New query` を押す
4. ローカルの migration ファイルを開いて全文コピー
5. SQL Editorのクエリエリアへ貼り付け
6. `Run` 実行
7. 成功後、実施記録テンプレの「2. Supabase migration 手動適用」に結果を記入

## 2. migration適用後のDB確認SQL（SQL Editor）

SQLは `supabase/verification/release_preprod_checks.sql` にも保存済み。  
SQL Editorで直接貼り付けて実行してよい。

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'sync_outbox',
    'work_sessions',
    'study_blocks',
    'assignment_steps',
    'inbox_items',
    'ai_usage_logs',
    'ai_credit_balances'
  )
order by table_name;
```

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'sync_outbox',
    'work_sessions',
    'study_blocks',
    'assignment_steps',
    'inbox_items',
    'ai_usage_logs',
    'ai_credit_balances'
  )
order by tablename;
```

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'sync_outbox',
    'work_sessions',
    'study_blocks',
    'assignment_steps',
    'inbox_items',
    'ai_usage_logs',
    'ai_credit_balances'
  )
order by tablename, policyname;
```

## 3. RLS実効確認（手動）

前提:

1. `TASKFLOW_DEMO_MODE` は無効（demo modeでは全員 `demo-user` になり検証不可）
2. `/login` 画面に `Googleでログイン` が表示されること
3. ユーザーA/Bで異なるGoogleアカウントを使うこと

1. テストユーザーAでログインし、課題を1件作成
2. テストユーザーBでログインし、Aの課題が見えないことを確認
3. `/inbox`、`/today`、`/assignments`、課題詳細でも同様に他人データ非表示を確認
4. 失敗時は公開を止め、policyとAPI側`user_id`取り扱いを再点検

## 4. 中核フロー確認（本番相当）

必須フロー:

1. `/ai` に長文入力
2. 複数候補抽出
3. プレビュー編集
4. 選択保存
5. `/assignments` 反映
6. `/today` 反映
7. `/inbox` で候補別保存（部分保存・全保存）

判定条件:

- `raw_text` が残る
- 部分保存時は `parsed` のまま
- 全候補保存後は `saved`
- Calendar同期失敗時も課題保存は成功扱い

## 5. OAuth / Calendar 確認

確認項目:

1. `NEXT_PUBLIC_APP_URL` と Google OAuth redirect URI が一致
2. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が正しい
3. Calendar連携の初回接続・再接続が可能
4. 同期失敗時に日本語メッセージで「課題は保存済み」が表示される

### 5-1. Google Cloud Consoleでの入力場所

1. Google Cloud Consoleで対象Projectを開く
2. `APIs & Services` -> `Credentials`
3. 対象の `OAuth 2.0 Client IDs` を開く
4. `Authorized redirect URIs` に以下を設定/確認
   - `${NEXT_PUBLIC_APP_URL}/auth/callback`
   - `${NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
5. Save後、実施記録テンプレの「6. OAuth / Calendar / Vercel確認」に結果を記入

## 6. Vercel環境変数 確認

必須:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `WEB_PUSH_PUBLIC_KEY`
- `WEB_PUSH_PRIVATE_KEY`

任意:

- `GOOGLE_CALENDAR_ID`
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`

### 6-1. Vercelでの入力場所

1. Vercelの対象Projectを開く
2. `Settings` -> `Environment Variables`
3. 各Keyを追加し、Valueを入力
4. Environmentは少なくとも `Production` を選択
5. 保存後に再デプロイ
6. 実施記録テンプレの「6. OAuth / Calendar / Vercel確認」に反映

## 7. 公開可否（Go / No-Go）

Go条件:

1. DB確認SQLで対象テーブル・RLS・policyが揃う
2. 他ユーザーのデータが見えない
3. MVP中核フローが通る
4. 課題保存が最優先で、外部連携失敗でも保存成功

No-Go条件:

1. RLS不備
2. 他ユーザーデータ露出
3. 保存本体が失敗する不具合
4. `/ai` `/inbox` `/today` の白画面

記録場所:

- `docs/release-preprod-execution-template.md` の「8. Go / No-Go 判定」
