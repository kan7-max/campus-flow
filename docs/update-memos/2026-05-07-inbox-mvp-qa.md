# Campus TaskFlow 更新メモ 2026-05-07

## 今回の目的

Inbox の複数課題候補について、候補ごとの確認・個別保存・全保存後の状態更新がMVP導線として安定しているか確認する。

## 実施内容

- Codex横ブラウザを `http://localhost:3000/dashboard` に開き直した。
- dev server が落ちていたため、`TASKFLOW_DEMO_MODE=1` で `http://localhost:3000` を再起動した。
- `/inbox` に複数課題を含むメモを貼り付け、課題候補に整理した。
- 生成された3候補を候補ごとに保存した。
- 1件保存後は Inbox item が `parsed` のまま残り、未保存候補が残ることを確認した。
- 2件保存後も Inbox item が `parsed` のまま残り、未保存候補が1件残ることを確認した。
- 3件すべて保存後に Inbox item が `saved` になることを確認した。
- raw text が保持されていることを確認した。
- 保存した3課題が `/assignments` と課題詳細に反映されることを確認した。
- `/today` に保存結果が反映されることを確認した。

## 確認に使ったデータ

- Stamp: `IBX024775`
- Inbox item: `1899a191-7457-4071-aedf-0de29fc0baf5`
- 保存課題:
  - `8ebe1a53-8636-4816-9df7-89b884ca2a7b`
  - `c93dbc48-373b-4062-bfdc-c574a04e9653`
  - `62a57797-a727-4832-9d34-552a73cb109a`

## 実行したコマンド

- `npm run check`: OK
- HTTP確認:
  - `/inbox`: Runtime Errorなし
  - `/assignments`: 3件反映OK
  - `/today`: 保存結果の反映OK
  - `/assignments/[id]`: 3件とも200 OK

## 注意点

- Browser automation 側のURL表示が、Server Action のredirect直後に古いURLを示すことがあった。
- サーバーログと `.taskflow-demo-store.json` では保存成功を確認できた。
- アプリ本体の保存フローは成功している。

## 次に優先する作業

1. `/ai` の複数候補保存フローと Inbox 複数候補保存フローの差分をさらに減らす。
2. 候補保存後の通知と導線を、スマホ幅でもより見やすくする。
3. MVP QA スクリプトに Inbox 複数候補の部分保存・全保存確認を追加する。
4. build確認が必要な変更を入れた場合は、build後に `.next` 削除と dev server 再起動まで行う。
