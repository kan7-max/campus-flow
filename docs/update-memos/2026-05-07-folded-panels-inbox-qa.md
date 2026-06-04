# Campus TaskFlow 更新メモ 2026-05-07

## 今回の目的

ホームと今日画面の情報量を抑えつつ、Inbox複数候補保存フローの自動QAを追加する。

## 変更内容

- Dashboard / Today の必要度が低いパネルを折り畳み式にした。
  - `状況サマリー`
  - `今日の判断`
  - Dashboard: `詳しい作戦と補助パネル`
  - Today: `作業プラン詳細`
- 主要導線は通常表示のまま維持した。
  - `今日やること`
  - `今日のタイムライン`
  - `今はこれだけ`
  - `AI入力` 導線
- Inbox複数候補フローの自動QAを追加した。
  - `npm run qa:inbox`
  - Server ActionのIDをHTMLから動的に取得してフォーム送信する方式。
  - 候補1件保存時は `parsed` のまま残ることを確認。
  - 全候補保存後に `saved` になることを確認。
- `qa:mvp` のToday反映チェックを、デモ課題が増えて表示枠から押し出されても失敗しないよう調整した。

## 変更ファイル

- `src/components/dashboard/today-command-center.tsx`
- `scripts/qa-inbox-multi-candidate.mjs`
- `scripts/qa-mvp-flow.mjs`
- `package.json`
- `docs/update-memos/2026-05-07-folded-panels-inbox-qa.md`

## 確認結果

- `npm run check`: OK
- `npm run qa:mvp`: OK
  - Todayの表示枠に新規QA課題が入らない場合はWARNにする。
- `npm run qa:inbox`: OK
- `TASKFLOW_DEMO_MODE=1 npm run build -- --no-lint`: OK
- build後に `.next` を削除し、dev serverを `TASKFLOW_DEMO_MODE=1` で再起動済み。
- `/dashboard`: 折り畳み項目表示OK、Runtime Errorなし。
- `/today`: 折り畳み項目表示OK、Runtime Errorなし。
- Codex横ブラウザは `http://localhost:3000/dashboard` に戻した。

## 注意点

- build後のdev初回compileで `/dashboard` が約654秒かかった。
- その後のHTTP確認は正常に戻った。
- OneDrive配下の `.next` 生成物が重くなることがあるため、長時間止まった場合は今回同様に別確認へ切り替える。

## 次に優先する作業

1. 折り畳み後のスマホ表示を目視で確認し、summary文言が長すぎる場合はさらに短くする。
2. QAで増えたデモ課題がTodayの見通しを悪くしているため、QA用データの掃除導線または専用stampの表示除外を検討する。
3. `/ai` と `/inbox` の複数候補プレビューの文言差分を小さくする。
