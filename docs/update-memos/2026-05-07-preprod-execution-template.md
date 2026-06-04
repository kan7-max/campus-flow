# 2026-05-07 追加作業メモ（本番化前 実施記録テンプレ）

## 目的

- 本番前チェックを「実施したかどうか」だけでなく、証跡付きで残せるようにする
- 手順書（runbook）と実施記録を分離し、当日運用の迷いを減らす

## 変更ファイル

- `docs/release-preprod-execution-template.md`（新規）
- `docs/release-preprod-runbook.md`（テンプレ参照を追記）
- `docs/mvp-completion-checklist.md`（テンプレ導線を追記）

## 追加内容

`release-preprod-execution-template.md` に以下を整理:

1. ローカル回帰コマンドチェック欄
2. migration適用チェック欄
3. DB確認SQL結果記録欄
4. RLS実効確認（A/Bユーザー）欄
5. MVP中核フロー確認欄
6. OAuth / Calendar / Vercel確認欄
7. スマホ幅最終確認欄
8. Go / No-Go判定欄
9. ブロッカーと次アクション欄

