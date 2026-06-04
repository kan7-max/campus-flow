# Local Release Gate Report

- Timestamp: 2026-05-26T23:57:19.5977716+09:00
- Mode: quick
- Overall: PASS
- Workspace: Repository root
- DistDir: .next-qa

## Step Results

| Step | Command | Result | Exit Code | Duration(ms) |
|---|---|---|---:|---:|
| check | $(@{Step=check; Command=npm run check; Result=PASS; ExitCode=0; DurationMs=25356}.Command) | PASS | 0 | 25356 |
| qa:preprod | $(@{Step=qa:preprod; Command=npm run qa:preprod; Result=PASS; ExitCode=0; DurationMs=4192}.Command) | PASS | 0 | 4192 |

## Notes

- quick: 速い事前確認（lint/typecheck + preprod静的確認）。
- ull: MVP導線/Inbox導線/build/静的秘密値漏えいチェックまで実施。未変更時は重いステップを自動SKIP。
- QA実行中は distDir に $env:TASKFLOW_QA_DIST_DIR を使用します（デフォルト: .next-qa）。
- OneDrive環境ではビルド成果物がロックされる場合があります。失敗時は dev server停止後に再実行してください。
