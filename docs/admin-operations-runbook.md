# Campus TaskFlow Admin Operations Runbook

## 対象
- `/admin`
- `/admin/credits`

## 目的
- β運営で必要な指標と設定状態をまとめて確認する。
- AIクレジット変更を監査可能な形で実施する。

## 0. 事前条件
- `ADMIN_EMAILS`（または `OPERATIONS_ADMIN_EMAILS`）を設定する。
- 本番では管理者メール一致アカウントのみ `/admin` 系へアクセス可能。
- 開発環境のみ、管理者メール未設定時にフォールバック許可が有効になることがある。

## 1. `/admin` で見る内容
- 要確認アラート（失敗件数・必須サービス未設定）
- 登録ユーザー数
- 課題保存数
- AI抽出回数
- AI抽出 成功/失敗 概算
- Google Calendar同期 成功/失敗 概算
- 外部サービス設定有無（値は表示しない）
- β運営ドキュメント導線

## 2. `/admin/credits` の運用ルール
- 変更理由は必須。
- 変更前後（before/after）を監査ログへ記録。
- 監査ログテーブルがない場合、更新を拒否する。
- 運営者権限のあるアカウントのみ操作可。
- 非管理者で `/admin` 系にアクセスした場合はサーバー側で遮断し `/dashboard?admin=forbidden` へ遷移。

## 2.1 アクセス制御・秘密値 非表示チェック（運用開始時 / 変更後）
1. 管理者アカウントで `/admin` を開き、指標カードと要確認アラートが表示されることを確認。
2. 管理者アカウントで `/admin/credits` を開き、検索・更新フォームが表示されることを確認。
3. 非管理者アカウントで `/admin` と `/admin/credits` にアクセスし、`/dashboard?admin=forbidden` へ遷移することを確認。
4. `/admin` と `/admin/credits` 上に APIキー実値・トークン実値・課題本文・`raw_text`・授業メモが表示されないことを確認。

## 3. AI Credit Admin Log SQL 案（未適用なら必要）
本番Supabaseへは自動適用しない。SQL Editorで手動適用する。

```sql
create table if not exists public.ai_credit_admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  admin_email text null,
  target_user_id uuid not null,
  month_key text not null,
  reason text not null,
  action text not null,
  before_plan text not null,
  after_plan text not null,
  before_monthly_limit integer not null,
  after_monthly_limit integer not null,
  before_credits_used integer not null,
  after_credits_used integer not null,
  before_credits_remaining integer not null,
  after_credits_remaining integer not null,
  created_at timestamptz not null default now()
);

alter table public.ai_credit_admin_logs enable row level security;

-- 管理者専用テーブルのため anon 権限は付与しない
revoke all on table public.ai_credit_admin_logs from anon;

-- authenticated は原則アクセス不要（admin APIは service_role 経由）
revoke all on table public.ai_credit_admin_logs from authenticated;

-- service_role のみ必要権限を付与
grant select, insert on table public.ai_credit_admin_logs to service_role;

-- admin_user_id = auth.uid() を基本とする（必要なら運営ロールで強化）
create policy if not exists ai_credit_admin_logs_select_self
on public.ai_credit_admin_logs
for select
to authenticated
using (auth.uid() = admin_user_id);
```

> 追記: 将来の migration では、`public` 新規テーブル作成時に **GRANT + RLS policy を同一migration内に必ず追加** する。

## 4. 日次/週次運用

### 日次
- `/admin` の要確認アラート有無
- エラー件数（Vercel logs / Sentry候補）
- AI抽出失敗数
- Calendar同期失敗数
- 問い合わせ件数

### 週次
- ユーザー増加、AI利用量、保存率の推移
- コスト推移（OpenAI / Supabase / Vercel）
- 多発不具合の原因分析と優先修正

## 5. 問い合わせ・削除依頼
- 本文データをむやみに複製しない。
- 本人確認後に対応。
- 実施ログ（日時、担当、結果）を残す。

## 6. 禁止事項
- 管理画面で APIキー実値を表示しない。
- 課題本文、`raw_text`、PDF抽出本文を運営画面へ表示しない。
- `service_role` をクライアントへ渡さない。
- 権限なしユーザーに `/admin` を開放しない。

## 7. 外部サービス（方針）
- Sentry: 本番エラー監視候補。本文/秘密情報の送信禁止。
- PostHog: 最小イベントのみ。本文送信禁止、入力欄マスク前提。
- Resend: サーバー側のみで利用。
- Stripe: βでは未導入（実装しない）。
