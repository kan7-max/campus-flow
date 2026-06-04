import { execFileSync } from "node:child_process";
import path from "node:path";

function parseArgs(argv) {
  const flags = {};
  const passthrough = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (!arg.startsWith("--")) {
      passthrough.push(arg);
      continue;
    }
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
  return { flags, passthrough };
}

function runNode(args) {
  execFileSync(process.execPath, args, { stdio: "inherit" });
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const title = String(flags.title || "AI Ops task").trim();
  const source = String(flags.source || "manual").trim();
  const issuePath = String(flags.issueOut || path.join("data", "ai-ops", "issue-drafts", `${stamp}.md`));
  const promptPath = String(flags.promptOut || path.join("data", "ai-ops", "codex-prompts", `${stamp}.md`));

  const issueArgs = ["tools/ai-ops/ai-issue-generator.mjs", "--out", issuePath, "--title", title, "--source", source];
  if (flags.input) issueArgs.push("--input", String(flags.input));
  if (flags.text) issueArgs.push("--text", String(flags.text));
  if (flags.ai) issueArgs.push("--ai");
  runNode(issueArgs);

  runNode(["tools/ai-ops/codex-prompt-generator.mjs", "--input", issuePath, "--title", title, "--out", promptPath]);

  if (flags.github || flags["create-github"]) {
    const createArgs = ["tools/ai-ops/ai-ops-create-github-issue.mjs", "--input", issuePath, "--title", title];
    if (flags.repo) createArgs.push("--repo", String(flags.repo));
    if (flags["dry-run"] || flags.dryRun) createArgs.push("--dry-run");
    runNode(createArgs);
  }
}

main();

