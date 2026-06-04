# 2026-05-23 Admin Credits / Admin Access / Beta Guide Pass

## 対応内容

1. **クレジット管理の更新日時表示を改善**
- `/admin/credits` の更新時刻を秒まで表示するよう変更
- 表示関数を `formatDateTimeWithSeconds` に統一
- 更新直後の表示取りこぼしを避けるため、Server Action redirect に `ts` を付与

2. **本番の ADMIN_EMAILS 判定を強化**
- `ADMIN_EMAILS` / `OPERATIONS_ADMIN_EMAILS` のパースを強化
  - 改行、空白、`,`、`;`、全角区切り文字に対応
  - 値の引用符 (`'` / `"`) を除去
  - `*@example.com` 形式のドメイン指定に対応
- 権限なし画面に判定情報（ログインメール / 設定件数）を追加

3. **βテスター資料の導線を追加**
- 初回アクセス時にガイドモーダルを表示（v2キー）
- 2回目以降は左下の `β資料` ボタンから再表示可能
- PC向け / スマホ向け資料へのリンクをモーダル内に配置

## 変更ファイル
- `src/lib/adminAccess.ts`
- `src/lib/utils.ts`
- `src/lib/actions/adminActions.ts`
- `src/app/(app)/admin/page.tsx`
- `src/app/(app)/admin/credits/page.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/beta-tester-guides-gate.tsx`

## 検証
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run check` ✅
