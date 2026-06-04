# Third-Party Services Policy (MVP Phase)

## Scope
- 対象: `Sentry / PostHog / Resend / Stripe`
- 目的: **実装ではなく方針整理**
- 前提: Campus TaskFlow は「大学生向けAI課題整理」のMVP安定化と本番化前チェックを優先する

## Priority (Now vs Later)
1. **Sentry**: 優先度 High（本番前監視の候補）
2. **PostHog**: 優先度 Medium（最小イベント分析の候補）
3. **Resend**: 優先度 Low-Medium（MVP後の通知/運営メール候補）
4. **Stripe**: 優先度 Low（MVPでは実装しない）

---

## 1) Sentry
### 目的
- 本番・Previewでのエラー検知、再現支援、優先度判断

### Campus TaskFlowで使う可能性
- OAuthループ、API失敗、画面白化、Server Action失敗の早期検知

### 今入れるべきか
- **候補としては入れる価値が高い**（ただし今回は方針のみ、実装はしない）

### 後回しにする理由
- MVP本体の安定化（保存導線、抽出導線）を先に固定したい

### 必要な環境変数名
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

### 注意点
- 課題本文、`raw_text`、PDF抽出テキスト、授業メモ、APIキーを送信しない
- `SENTRY_AUTH_TOKEN` は秘密値としてサーバー側のみで扱う
- Source map upload を使う場合も秘密値をクライアントへ出さない

### 禁止事項
- 生テキスト（課題本文・AI入力本文）を breadcrumb/extra に載せない
- `service_role` や OAuth secret をログに載せない

---

## 2) PostHog
### 目的
- 画面導線の把握（どこで離脱するか、どの導線が使われるか）

### Campus TaskFlowで使う可能性
- `/ai -> preview -> save`、`/inbox -> candidate save`、`/today` 利用率の最小分析

### 今入れるべきか
- **方針のみ先行**。実装するならMVP安定化後に最小イベントで開始

### 後回しにする理由
- プライバシー設計が未確定のまま導入するとリスクが高い

### 必要な環境変数名
- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

### 注意点
- 個人情報をイベントに入れない
- 課題本文、`raw_text`、授業メモ、PDF抽出テキストを送らない
- Session Recording を使う場合は入力欄マスク前提
- MVP期間はイベントを最小限（例: ページ表示・保存成功/失敗カウント）に限定

### 禁止事項
- 入力フォーム値をそのまま送信
- ユーザー識別子としてメール本文/課題本文を送る

---

## 3) Resend
### 目的
- 運営連絡、問い合わせ返信、将来の通知メール送信

### Campus TaskFlowで使う可能性
- 期限通知メール、運営からのお知らせ、問い合わせ対応

### 今入れるべきか
- **MVP後でよい**（今回は方針のみ）

### 後回しにする理由
- 現在はアプリ内導線の安定化を優先

### 必要な環境変数名
- `RESEND_API_KEY`

### 注意点
- `RESEND_API_KEY` はサーバー側のみで使用
- クライアントバンドル・ログにAPIキーを出さない

### 禁止事項
- クライアントから直接Resend APIを叩かない
- メール本文に機微情報（課題本文全文など）を自動挿入しない

---

## 4) Stripe
### 目的
- 将来のAI credits課金導線（Free/Plus/Pro）

### Campus TaskFlowで使う可能性
- 将来のサブスク管理・請求

### 今入れるべきか
- **入れない（MVPでは実装しない）**

### 後回しにする理由
- 課題保存・抽出・today反映の安定化が先
- 決済は法務・運用・サポート要件を伴う

### 必要な環境変数名
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### 明示的に今回やらないこと
- 決済画面を作らない
- Checkoutを作らない
- Webhookを実装しない
- `price_id` / `product_id` をコードへ追加しない
- 課金フローをアプリに組み込まない

### 禁止事項
- テスト課金導線を本番導線に混在させない
- サーバー秘密鍵をクライアントへ露出しない

---

## Common Safety Rules
- 外部連携失敗で課題保存本体を失敗扱いにしない（best effort）
- `service_role` はサーバー専用。クライアントに露出させない
- `.env` 実値はGitにコミットしない
- 追加導入時は最初に「送信禁止データ一覧」を定義してから実装する
