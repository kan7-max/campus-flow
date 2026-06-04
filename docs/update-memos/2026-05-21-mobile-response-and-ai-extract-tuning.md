# 2026-05-21 Mobile Response and AI Extract Tuning

## 目的
- スマホ実機での操作反応を改善
- AI抽出の件数不足を減らす
- AI抽出とファイル抽出の待ち時間を短縮

## 実施内容（最小変更）
- ボタンのタップ反応改善
  - `src/components/ui/button.tsx`
    - `touch-manipulation` を標準付与
    - `size="sm"` のモバイル時最小高さを拡大
  - `src/components/assignments/assignment-minimal-card.tsx`
    - 締切/ステータス/メニュー/閉じるボタンのタップ領域を拡大
  - `src/components/assignments/assignment-quick-actions.tsx`
    - クイック操作ボタンのモバイル高さを拡大

- 進捗ボタンの体感反応改善
  - `src/components/assignments/assignment-progress-buttons.tsx`
    - optimistic表示（押下直後に表示更新）
    - 失敗時は元の値へ戻す

- ファイル抽出UIの無反応修正
  - `src/components/ai/file-extract-panel.tsx`
    - ファイル選択と抽出実行を分離
    - 「ファイルを読み取り」ボタン押下で抽出実行
    - ファイル未選択時のエラー案内を追加

- AI抽出の件数不足・遅延の調整
  - `src/lib/services/inboxParsingService.ts`
    - 2件以上候補が出ている場合のAI強制利用を抑制
    - `alternativeCandidates` の表示上限を拡大
  - `src/lib/ai/heuristicExtractor.ts`
    - 候補上限を 10 -> 16
  - `src/lib/ai/extractAssignmentInfo.ts`
    - 候補上限を 10 -> 16
    - AIタイムアウトを 18s -> 14s に短縮
    - heuristic fast-path 条件を緩和（短文はAI呼び出しを減らす）
    - AI候補に不足がある場合、heuristic補完を増やす
  - `src/lib/ai/providers/openaiAssignmentExtractor.ts`
    - 多課題文での出力トークン上限を増加
    - プロンプトに「候補の過少抽出を避ける」指示を追加

- PDF / 画像抽出の待ち時間短縮（fastモード）
  - `src/app/api/ai/extract-from-file/route.ts`
    - fastモードの `maxOutputTokens` を削減
    - fastモードのタイムアウト短縮
    - fastモードのモデル候補を絞って初動を高速化

## 実行結果
- `npm run lint` : PASS
- `npm run typecheck` : PASS
- `npm run check` : PASS

## 次の確認
- スマホ実機で以下を再確認
  - `+25%` / ステータス変更 / 締切編集 の押下感
  - `/ai` 長文で 3件以上課題がある入力時の抽出件数
  - PDF/画像の fast モードでの抽出時間
