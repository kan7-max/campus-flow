# AI Development Operations Runbook

## 結論

貼り付けテキストの流れは概ね正しい。変更点は、本番反映・DB/RLS・課金・一斉送信を自動化対象から外し、人間承認ゲートとして固定すること。

このリポジトリでは、まず次の3つを標準化する。

1. AI Issue Generator
2. Codex Prompt Generator
3. Auto QA Gate
4. AI Issue Ingest

## 運用ライン

```text
問い合わせ / エラー / 利用データ / 改善メモ
↓
Issue化（Issue Form / repository_dispatch / local CLI）
↓
人間が codex-ready を付与
↓
Codex指示コメントを自動生成
↓
Codexが実装
↓
PRで自動検査
↓
Preview確認
↓
人間がMerge
```

## 自動化してよい領域

- Issue草案作成
- ラベル候補作成
- Codex指示文作成
- lint / typecheck / check / build
- Vercel Preview生成
- リリースノート、FAQ、LP文言の草案作成

## 人間承認を残す領域

- 本番反映
- Supabase migration適用
- RLS変更
- 課金設定変更
- 外部サービス設定変更
- 個人情報を含む一斉送信
- 法務・規約・プライバシー判断

## 導入済み

- GitHub Issue Form: `.github/ISSUE_TEMPLATE/ai-improvement.yml`
- AI Issue Ingest: `.github/workflows/ai-issue-ingest.yml`
- Codex Prompt Action: `.github/workflows/ai-issue-comment.yml`
- Auto QA Gate: `.github/workflows/check.yml`
- Issue draft CLI: `npm run ai-ops:issue`
- Codex prompt CLI: `npm run ai-ops:prompt`
- GitHub issue request CLI: `npm run ai-ops:create-issue`
- One-shot local pipeline: `npm run ai-ops:run`
- GitHub labels CLI: `npm run ai-ops:labels`

ラベル体系はGitHub上の既存ラベルを基準にする。Codex投入は `codex-ready`、人間確認は `needs-human-check`、運用系は `ops`、優先度は `priority:P0` / `priority:P1` / `priority:P2` を使う。

## ローカルでの使い方

```powershell
# メモをIssue草案にする
npm run ai-ops:issue -- --input "memo.txt" --source "manual" --title "スマホ表示の改善"

# OPENAI_API_KEYがある場合はAI要約・分類を使う
npm run ai-ops:issue -- --input "memo.txt" --source "manual" --title "スマホ表示の改善" --ai

# Issue本文からCodex指示文を作る
npm run ai-ops:prompt -- --input "data/ai-ops/issue-drafts/example.md" --issue 123 --title "スマホ表示の改善"

# 草案、Codex指示文、GitHub Issueリクエストをまとめて作る
npm run ai-ops:run -- --input "memo.txt" --source "manual" --title "スマホ表示の改善" --github --dry-run

# AI要約・分類つきでまとめて作る
npm run ai-ops:run -- --input "memo.txt" --source "manual" --title "スマホ表示の改善" --ai --github --dry-run

# GITHUB_TOKEN または GH_TOKEN がある場合はGitHub Issueを作る
npm run ai-ops:create-issue -- --input "data/ai-ops/issue-drafts/example.md" --repo "kan7-max/New-project"

# GitHub remoteがあるプロジェクトでラベルを作る
npm run ai-ops:labels

# 管理側のIssue Form / workflow更新を対象プロジェクトへ明示配布する
$env:AUTO_APPLY_FORCE_OVERWRITE="true"; npm run auto:apply
```

## GitHubでの使い方

1. Issue Formから改善タスクを作る
2. n8nなどの外部ツールは `repository_dispatch` の `ai_ops_signal` でIssueを作る
3. 人間が内容を確認する
4. 実装してよいものに `codex-ready` を付ける
5. ActionがCodex用コメントを自動生成または更新する
6. Codexにコメントを渡して実装する
7. PRのAuto QA GateとPreviewを確認する
8. 問題なければ人間がMergeする

## repository_dispatch payload

```json
{
  "event_type": "ai_ops_signal",
  "client_payload": {
    "title": "[AI Ops] スマホ表示の改善",
    "source": "user-feedback",
    "kind": "ui",
    "priority": "priority:P1",
    "summary": "スマホで次のタスクが見づらい",
    "evidence": "問い合わせ本文やログ",
    "proposed_work": "- /today のカード密度を調整する"
  }
}
```
