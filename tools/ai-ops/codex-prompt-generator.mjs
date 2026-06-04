import fs from "node:fs";
import path from "node:path";
import { ensureDirForFile } from "./lib/io.mjs";

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.trim();
    if (!key) continue;
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !String(next).startsWith("--")) {
      flags[key] = next;
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function readBody(flags) {
  if (flags.body) return String(flags.body);
  if (flags.input) return fs.readFileSync(path.resolve(String(flags.input)), "utf8");
  if (!process.stdin.isTTY) return fs.readFileSync(0, "utf8");
  return "";
}

function renderPrompt({ issueNumber, title, body }) {
  const issueLabel = issueNumber ? `#${issueNumber} ${title}` : title;
  return [
    "Codex作業をお願いします。",
    "",
    `対象Issue: ${issueLabel}`,
    "",
    "Issue内容:",
    body.trim() || "(empty)",
    "",
    "共通制約:",
    "- 大規模リファクタ禁止",
    "- 既存UIと既存機能を壊さない",
    "- `.env` は触らない",
    "- Supabase migrationは勝手に適用しない",
    "- 本番DB、RLS、課金設定、外部サービス設定は変更しない",
    "- 課題保存を最優先",
    "- Google Calendarや外部連携の失敗を課題保存失敗扱いにしない",
    "- 変更は最小限にする",
    "",
    "完了条件:",
    "- 変更ファイル、変更内容、検証結果、残リスクを報告",
    "- 利用可能な場合は `npm run lint` / `npm run typecheck` / `npm run check` / `npm run build` を実行",
    "- UI変更時はVercel Previewまたはローカル表示を確認",
    "",
    "PR方針:",
    issueNumber ? `- PR本文に \`Fixes #${issueNumber}\` を入れる` : "- 関連IssueがあればPR本文に `Fixes #...` を入れる",
    "- 本番反映、DB変更、課金変更、一斉送信は人間承認まで止める"
  ].join("\n");
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const title = String(flags.title || "AI Ops task").trim();
  const issueNumber = flags.issue ? String(flags.issue).trim() : "";
  const body = readBody(flags);
  const prompt = renderPrompt({ issueNumber, title, body });
  const outPath =
    flags.out ||
    path.join("data", "ai-ops", "codex-prompts", `${new Date().toISOString().replace(/[:.]/g, "-")}.md`);

  ensureDirForFile(outPath);
  fs.writeFileSync(outPath, `${prompt}\n`, "utf8");
  console.log(`Codex prompt written: ${outPath}`);
}

main();

