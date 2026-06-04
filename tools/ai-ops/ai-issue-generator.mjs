import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "./lib/env.mjs";
import { ensureDirForFile } from "./lib/io.mjs";
import { callOpenAIText } from "./lib/openai.mjs";

const CATEGORY_RULES = [
  { label: "priority:P0", pattern: /緊急|至急|urgent|critical|重大障害|本番障害|サービス停止|停止中|落ちる|cannot|can't/i },
  { label: "ops", pattern: /自動運用|自動化|運用ライン|issue化|Codex用タスク|AI開発システム|github actions|n8n|calendar|カレンダー|予定|google calendar/i },
  { label: "bug", pattern: /bug|error|エラーが出る|失敗する|壊れている|例外|crash|sentry issue/i },
  { label: "ui", pattern: /ui|表示|画面|カード|button|layout|デザイン/i },
  { label: "mobile", pattern: /mobile|スマホ|sp|responsive|タップ|幅/i },
  { label: "feature", pattern: /feature|機能追加|新機能|改善案|要望|request/i },
  { label: "docs", pattern: /docs|document|ドキュメント|README|runbook|手順/i },
  { label: "release-blocker", pattern: /release-blocker|リリース前に必須|リリースできない|本番反映が止まる|本番障害|課金が壊れている|決済が失敗する|RLSが壊れている|権限漏れ|個人情報漏洩/i }
];

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

function readStdin() {
  if (process.stdin.isTTY) return "";
  return fs.readFileSync(0, "utf8");
}

function readInput(flags) {
  if (flags.input) {
    return fs.readFileSync(path.resolve(String(flags.input)), "utf8");
  }
  const stdin = readStdin();
  if (stdin.trim()) return stdin;
  return String(flags.text || "");
}

function classify(text) {
  const labels = [];
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) labels.push(rule.label);
  }
  if (labels.includes("ops") && labels.includes("bug") && !/再現|発生中|発生している|壊れている|例外|crash/i.test(text)) {
    labels.splice(labels.indexOf("bug"), 1);
  }
  if (labels.includes("ops") && labels.includes("priority:P0") && !/今すぐ|至急対応|緊急対応|発生中|発生している|本番障害|サービス停止中|落ちている/i.test(text)) {
    labels.splice(labels.indexOf("priority:P0"), 1);
  }
  if (!labels.length) labels.push("needs-human-check");
  if (!labels.includes("needs-human-check")) labels.push("needs-human-check");
  return Array.from(new Set(labels));
}

function priorityFromLabels(labels) {
  if (labels.includes("priority:P0")) return "priority:P0";
  if (labels.includes("ops") || labels.includes("feature")) return "priority:P1";
  if (labels.includes("bug")) return "priority:P1";
  return "priority:P2";
}

function parseMaybeJson(text) {
  const trimmed = String(text || "").trim();
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(fenceStripped);
  } catch {
    const match = fenceStripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse JSON from AI output");
    return JSON.parse(match[0]);
  }
}

function normalizeAiLabels(labels) {
  const allowed = new Set([
    "bug",
    "docs",
    "documentation",
    "enhancement",
    "feature",
    "mobile",
    "needs-human-check",
    "ops",
    "priority:P0",
    "priority:P1",
    "priority:P2",
    "question",
    "release-blocker",
    "ui"
  ]);
  const out = Array.isArray(labels)
    ? labels.map((label) => String(label || "").trim()).filter((label) => allowed.has(label))
    : [];
  out.push("needs-human-check");
  return Array.from(new Set(out));
}

async function buildAiDraft(text) {
  const systemPrompt = `
You create GitHub Issues for a human-gated AI development operations workflow.
Return STRICT JSON only. No markdown.

Allowed labels:
bug, docs, documentation, enhancement, feature, mobile, needs-human-check, ops,
priority:P0, priority:P1, priority:P2, question, release-blocker, ui

Rules:
- Always include needs-human-check.
- Never include codex-ready.
- Use ops for automation, workflow, GitHub Actions, n8n, or operational tasks.
- Use priority:P0 only for active production outage, urgent breakage, data leak, or release blocker.
- Use release-blocker only when a release is actually blocked.
- For normal automation setup, use ops and priority:P1.
- Keep output concise and implementation-oriented.

Schema:
{
  "summary": "Japanese summary, 1-2 sentences",
  "kind": "one allowed non-priority label",
  "priority": "priority:P0|priority:P1|priority:P2",
  "labels": ["allowed labels"],
  "todo": ["short Japanese task"],
  "done": ["short Japanese acceptance criterion"],
  "non_goals": ["short Japanese non-goal"]
}
`.trim();
  const userPrompt = `Input text:\n${text}`;
  const result = parseMaybeJson(await callOpenAIText(systemPrompt, userPrompt, { maxOutputTokens: 900 }));
  const labels = normalizeAiLabels([...(result.labels || []), result.kind, result.priority]);
  return {
    summary: String(result.summary || "").trim(),
    kind: labels.find((label) => !label.startsWith("priority:") && label !== "needs-human-check") || "ops",
    priority: labels.find((label) => label.startsWith("priority:")) || "priority:P1",
    labels,
    todo: Array.isArray(result.todo) ? result.todo.map(String).filter(Boolean) : [],
    done: Array.isArray(result.done) ? result.done.map(String).filter(Boolean) : [],
    nonGoals: Array.isArray(result.non_goals) ? result.non_goals.map(String).filter(Boolean) : []
  };
}

function compact(text, max = 220) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

function renderIssue({ source, text, labels, draft = null }) {
  const priority = draft?.priority || priorityFromLabels(labels);
  const kind = draft?.kind || labels.find((label) => !label.startsWith("priority:") && label !== "needs-human-check") || "other";
  const todo = draft?.todo?.length ? draft.todo : [
    "問題の再現条件または改善対象を確認する",
    "既存仕様への影響を確認する",
    "最小変更で修正または改善する"
  ];
  const nonGoals = draft?.nonGoals?.length ? draft.nonGoals : [
    "大規模リファクタ",
    "本番DB migration",
    "RLS変更",
    "課金設定変更",
    "外部サービス設定変更"
  ];
  const done = draft?.done?.length ? draft.done : [
    "利用可能な検証コマンドが通る",
    "変更内容と残リスクがPRに書かれている",
    "UI変更時はPreviewまたはローカル表示を確認済み"
  ];
  return [
    "## 概要",
    draft?.summary || compact(text) || "要確認",
    "",
    "## 種別",
    kind,
    "",
    "## 重要度",
    priority,
    "",
    "## 入力ソース",
    source,
    "",
    "## 背景",
    text.trim() || "入力内容が空です。",
    "",
    "## やること",
    todo.map((item) => `- ${item}`).join("\n"),
    "",
    "## やらないこと",
    nonGoals.map((item) => `- ${item}`).join("\n"),
    "",
    "## 完了条件",
    done.map((item) => `- ${item}`).join("\n"),
    "",
    "## 推奨ラベル",
    labels.map((label) => `- ${label}`).join("\n"),
    "",
    "## Codex投入判定",
    labels.includes("priority:P0") || labels.includes("release-blocker") || labels.includes("needs-human-check")
      ? "人間確認後に `codex-ready` を付ける"
      : "`codex-ready` 付与候補"
  ].join("\n");
}

async function main() {
  loadEnvFile();
  const flags = parseArgs(process.argv.slice(2));
  const text = readInput(flags);
  let draft = null;
  let labels = classify(text);
  if (flags.ai) {
    try {
      draft = await buildAiDraft(text);
      labels = draft.labels;
    } catch (error) {
      console.warn(`AI issue generation failed, using local classifier: ${error.message}`);
    }
  }
  const title = String(flags.title || compact(text, 80) || "AI Ops issue draft").trim();
  const source = String(flags.source || "manual").trim();
  const body = renderIssue({ source, text, labels, draft });
  const outPath =
    flags.out ||
    path.join("data", "ai-ops", "issue-drafts", `${new Date().toISOString().replace(/[:.]/g, "-")}.md`);

  ensureDirForFile(outPath);
  fs.writeFileSync(outPath, `# ${title}\n\n${body}\n`, "utf8");
  console.log(`Issue draft written: ${outPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

