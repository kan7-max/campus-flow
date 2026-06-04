import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadEnvFile, getEnv } from "./lib/env.mjs";
import { ensureDirForFile, writeJson } from "./lib/io.mjs";

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

function titleFromBody(body, fallback) {
  const firstHeading = body.split(/\r?\n/).find((line) => /^#\s+/.test(line));
  if (firstHeading) return firstHeading.replace(/^#\s+/, "").trim();
  return fallback;
}

function parseRemoteUrl(remoteUrl) {
  const text = String(remoteUrl || "").trim().replace(/\.git$/, "");
  const httpsMatch = text.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`;
  const sshMatch = text.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`;
  return "";
}

function repoFromGitRemote() {
  try {
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return parseRemoteUrl(remote);
  } catch {
    return "";
  }
}

function labelsFromBody(body) {
  const lines = body.split(/\r?\n/);
  const labels = [];
  let inLabels = false;
  for (const line of lines) {
    if (/^##\s+推奨ラベル\s*$/.test(line.trim())) {
      inLabels = true;
      continue;
    }
    if (inLabels && /^##\s+/.test(line.trim())) break;
    if (inLabels) {
      const match = line.match(/^\s*-\s+(.+?)\s*$/);
      if (match) labels.push(match[1].trim());
    }
  }
  return labels;
}

function allowedLabels() {
  const configPath = path.resolve("config", "ai-ops-labels.json");
  if (!fs.existsSync(configPath)) return new Set();
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return new Set((config.labels || []).map((label) => String(label.name || "").trim()).filter(Boolean));
}

function normalizeLabels(flags, body) {
  const explicit = String(flags.labels || flags.label || "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);
  const inferred = labelsFromBody(body);
  const labels = explicit.length ? explicit : inferred;
  labels.push("needs-human-check");
  if (flags["codex-ready"] === true || flags.codexReady === true) {
    labels.push("codex-ready");
  }
  const allowed = allowedLabels();
  return Array.from(new Set(labels)).filter((label) => !allowed.size || allowed.has(label));
}

function pendingPath() {
  return path.join("data", "ai-ops", "github-issue-requests", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
}

async function createIssue({ repo, token, title, body, labels }) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({ title, body, labels })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GitHub issue create failed: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  loadEnvFile();
  const flags = parseArgs(process.argv.slice(2));
  const body = readBody(flags).trim();
  if (!body) {
    throw new Error("Issue body is required. Use --input, --body, or stdin.");
  }

  const repo = String(flags.repo || getEnv("GITHUB_REPOSITORY") || repoFromGitRemote()).trim();
  const title = String(flags.title || titleFromBody(body, "AI Ops issue")).trim();
  const labels = normalizeLabels(flags, body);
  const request = { repo, title, labels, body };
  const outPath = flags.out || pendingPath();

  if (!repo) {
    writeJson(outPath, { ...request, status: "pending", reason: "missing GitHub repository" });
    console.log(`GitHub repo not found. Pending request written: ${outPath}`);
    return;
  }

  const token = String(flags.token || getEnv("GITHUB_TOKEN") || getEnv("GH_TOKEN")).trim();
  if (flags["dry-run"] || flags.dryRun || !token) {
    const reason = token ? "dry-run" : "missing GitHub token";
    writeJson(outPath, { ...request, status: "pending", reason });
    console.log(`GitHub issue request written: ${outPath}`);
    if (!token) console.log("Set GITHUB_TOKEN or GH_TOKEN to submit it automatically.");
    return;
  }

  const issue = await createIssue({ repo, token, title, body, labels });
  ensureDirForFile(outPath);
  fs.writeFileSync(outPath, JSON.stringify({ ...request, status: "created", issue }, null, 2), "utf8");
  console.log(`Created GitHub issue #${issue.number}: ${issue.html_url}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

