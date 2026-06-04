# Campus TaskFlow

大学生向け課題・スケジュール管理Webアプリです。  
AIチャット入力を最優先導線にし、課題抽出プレビューで確認してから保存できる設計です。

- ダークモード中心のUI
- PC: ダッシュボード重視
- スマホ: クイック入力と今日の課題確認を優先
- Googleカレンダー同期や通知が失敗しても、課題データ保存は成功させる

## Open Source / Public Repository Notes

- License: [MIT](LICENSE)
- Security policy: [SECURITY.md](SECURITY.md)
- Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Public repository safety checklist: [docs/public-repository-safety-checklist.md](docs/public-repository-safety-checklist.md)

This repository must not contain real student assignment text, production secrets, OAuth client secrets, Supabase service-role keys, private logs, or generated local app state. Use synthetic data in issues, screenshots, fixtures, and pull requests.

## 1. 技術選定理由

- **Next.js (App Router)**
  - 画面、API、Server Actionsを同一リポジトリで統合しやすく、開発継続コストが低い。
- **TypeScript**
  - 課題ドメインは項目数が多く、型で破綻を防ぎやすい。
- **Tailwind CSS + コンポーネント分割**
  - ダークUIを高速実装しつつ再利用性を確保。
- **Supabase (Auth / DB / Storage)**
  - Googleログイン、RLS、複数ユーザー対応を最短で実現。
- **OpenAI API（抽出レイヤ）**
  - `extract` と `save` を分離し、将来モデル変更しやすい。
- **Google Calendar API（抽象化）**
  - `CalendarProvider` 経由で将来の追加連携（TimeTree等）に対応しやすい。
- **PWA + Web Push骨組み**
  - スマホでの常用を想定。

## 2. ディレクトリ構成

```text
.
├─ src/
│  ├─ app/
│  │  ├─ (app)/
│  │  │  ├─ dashboard/
│  │  │  ├─ today/
│  │  │  ├─ deadlines/
│  │  │  ├─ calendar/
│  │  │  ├─ assignments/
│  │  │  ├─ courses/
│  │  │  ├─ ai/
│  │  │  ├─ incomplete/
│  │  │  └─ settings/
│  │  ├─ api/
│  │  │  ├─ ai/
│  │  │  ├─ export/
│  │  │  ├─ notifications/
│  │  │  └─ push/
│  │  ├─ auth/callback/
│  │  ├─ login/
│  │  └─ layout.tsx
│  ├─ components/
│  │  ├─ ai/
│  │  ├─ assignments/
│  │  ├─ calendar/
│  │  ├─ courses/
│  │  ├─ dashboard/
│  │  ├─ layout/
│  │  ├─ settings/
│  │  └─ ui/
│  └─ lib/
│     ├─ actions/
│     ├─ ai/
│     ├─ constants/
│     ├─ export/
│     ├─ mock/
│     ├─ notifications/
│     ├─ repositories/
│     ├─ services/
│     ├─ supabase/
│     └─ types/
├─ supabase/
│  ├─ migrations/
│  └─ seed/
├─ public/
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  └─ icon-*.svg
├─ middleware.ts
├─ .env.example
└─ README.md
```

## 3. データベース設計（Supabase）

`supabase/migrations/20260418_initial_schema.sql` に実装。

主要テーブル:

- `users` (auth.users連携)
- `courses`
- `assignments`
- `assignment_tags`
- `course_tags`
- `subtasks`
- `calendar_sync_records`
- `notifications`
- `attachments`
- `ai_extraction_logs`
- `user_settings`
- `push_subscriptions`

関係:

- user 1:N courses
- user 1:N assignments
- course 1:N assignments
- assignment 1:N subtasks
- assignment 1:N attachments
- assignment 1:N calendar_sync_records
- user 1:N notifications

補足:

- 課題削除は `deleted_at` を使うソフトデリート
- RLSを有効化し、`auth.uid()`ベースのポリシーを設定
- `handle_auth_user_created` でプロフィール/設定を自動初期化

## 4. 主要型定義

`src/lib/types/domain.ts`

- `Assignment`
- `Course`
- `Subtask`
- `CalendarSyncRecord`
- `NotificationRecord`
- `UserSettings`
- `AiExtractionResult` / `AiExtractionCandidate`
- `AssignmentFilter`

`src/lib/types/database.ts` はSupabaseテーブル型を定義。

## 5. 主要画面

- `/dashboard` ダッシュボード（未完了、今日、締切近い、授業別進捗）
- `/today` 今日やること
- `/deadlines` 締切が近い課題
- `/calendar` 月/週カレンダー
- `/assignments` 課題一覧（検索、ソート、フィルタ）
- `/assignments/new` 課題作成
- `/assignments/[id]` 課題詳細
- `/assignments/[id]/edit` 課題編集
- `/courses` 授業管理 + 簡易時間割
- `/incomplete` 未完了課題一覧
- `/ai` AIチャット入力 + 抽出プレビュー
- `/settings` 通知/重み/Google連携/エクスポート

## 6. 認証実装

- Supabase Auth + Googleログイン
- `middleware.ts` で保護ルート制御
- ログイン後は `/dashboard` へ
- 将来の認証追加を想定し `src/lib/auth.ts` で抽象化

デモモード:

- Supabase環境変数未設定時はデモユーザーで動作（開発継続しやすさ優先）

## 7. Googleカレンダー連携実装

実装ファイル:

- `src/lib/services/calendarProvider.ts`
- `src/lib/services/googleCalendarProvider.ts`
- `src/lib/services/calendarSyncService.ts`

仕様:

- 課題作成/編集時: `create_or_update` 同期
- 課題削除時: `delete` 同期
- `calendar_sync_records` に状態を記録
- 同期失敗時も課題保存/削除を成功させる（失敗分離）

## 8. AI入力実装

実装ファイル:

- 抽出: `src/lib/ai/*`
- 保存: `src/lib/services/assignmentService.ts`
- API: `/api/ai/extract`, `/api/ai/save`
- UI: `src/components/ai/ai-chat-panel.tsx`

要点:

- **抽出ロジック** (`extractAssignmentInfo`) と **保存ロジック** (`saveAssignmentsFromAiCandidates`) を分離
- OpenAIが使えない場合はヒューリスティック抽出にフォールバック
- 抽出後は即保存せず、プレビュー編集してから保存
- `ai_extraction_logs` へ記録

## 9. 通知実装の骨組み

実装ファイル:

- `src/lib/services/notificationService.ts`
- `src/lib/repositories/notificationRepository.ts`
- `src/app/api/notifications/dispatch/route.ts`

仕様:

- 1週間前 / 3日前 / 前日 / 当日朝 の通知キュー生成
- チャンネル: `email` / `web_push`
- 送信失敗時も課題保存を失敗させない
- 現在メールはスタブ（`src/lib/notifications/email.ts`）

## 10. ローカルセットアップ手順

1. 依存をインストール

```bash
npm install
```

2. 環境変数作成

```bash
cp .env.example .env
```

3. Supabase準備

- Supabaseプロジェクト作成
- `supabase/migrations/20260418_initial_schema.sql` 実行
- 必要なら `supabase/seed/seed.sql` 実行
- Auth ProviderでGoogleを有効化

4. 開発サーバー起動

```bash
npm run dev
```

5. ブラウザで開く

- [http://localhost:3000](http://localhost:3000)

## 11. `.env.example`

必須/推奨値は `.env.example` に記載済み。

特に重要:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY`

## 12. 実装フェーズの反映

### Phase 1（本実装で対応）

- 初期構築
- 認証導線
- DB設計
- 課題CRUD
- 授業CRUD
- ダッシュボード/一覧/検索/ソート/フィルタ
- カレンダー表示
- Googleカレンダー同期基礎

### Phase 2（本実装で対応）

- AIチャット入力
- 抽出プレビュー
- 優先度提案
- 小タスク分解
- 通知キュー骨組み

### Phase 3（今回の土台 + TODO）

- PDF/画像抽出精度向上（OCR/PDF parser差し替え）
- PWA最適化（オフラインキャッシュ戦略）
- エクスポート改善
- UI polish
- 外部連携拡張

## 13. 今後の拡張ポイント一覧

- Google Calendar OAuthトークン自動更新
- 通知の本番メールプロバイダ接続（Resend/SendGrid/SES）
- 画像OCR（Vision API/Tesseract）
- PDF構造抽出（pdfjs）
- Notion / LINE / TimeTree / OneDrive連携アダプタ
- 学期切替、試験範囲ビュー、週間学習計画自動生成
- 一括操作（一括完了・一括タグ）
- 作業予定ブロック自動生成（1課題Nイベント）

## 運用上の注意

- Google連携・通知に失敗しても課題保存を優先する設計です。
- AI抽出の曖昧項目（特に締切）は必ずプレビューで確認してください。
- デモモードは永続保存の保証が弱いため、本運用ではSupabase接続を推奨します。
