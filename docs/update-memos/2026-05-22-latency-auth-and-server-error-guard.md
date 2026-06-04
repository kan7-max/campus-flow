# 2026-05-22 Latency/Auth and Server Error Guard

## 目的
- モバイルでのボタン反映ラグを軽減する
- `Application error ... Digest` の再発を減らす

## 実施内容
1. `middleware.ts`
   - `/_next`, `/api`, `sw.js`, `manifest` などは認証チェックをスキップ
   - `getUser` 呼び出し対象を実質的に「保護ページ」と `/login` 判定時に限定

2. `src/lib/auth.ts`
   - `getCurrentUser` を `getSession` 優先に変更
   - セッションが有効な場合は `getUser` を呼ばずに返却
   - セッションが無効時のみ `getUser` にフォールバック

3. サーバー例外ガード（日付）
   - `src/lib/utils.ts` で日付パース失敗時に `"-"` / 安全な文言にフォールバック
   - `src/components/assignments/assignment-minimal-card.tsx` の締切表示を不正日時耐性ありに修正
   - `src/components/dashboard/today-command-center.tsx` のタイムライン締切表示を不正日時耐性ありに修正

4. 体感ラグ軽減
   - `src/lib/actions/assignmentActions.ts` の作業セッション系アクションから即時リダイレクトを削除
   - 同一画面更新を優先し、遷移コストを削減

## 実行コマンド
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run check` ✅

## 備考
- ローカル `npm run build` はユーザー中断で完走前に停止。
- Vercel反映後、モバイル実機で以下を再確認する:
  - 進捗/チェックリスト/作業ブロック操作の反映速度
  - `Application error (Digest)` の再発有無
