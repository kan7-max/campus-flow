import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve("config", "ai-ops-labels.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const labels = Array.isArray(config.labels) ? config.labels : [];

try {
  execFileSync("gh", ["--version"], { stdio: "ignore" });
} catch {
  console.error("GitHub CLI `gh` is required to create repository labels.");
  console.error("Install and authenticate `gh`, then run `npm run ai-ops:labels` again.");
  process.exit(1);
}

for (const label of labels) {
  const name = String(label.name || "").trim();
  if (!name) continue;
  const color = String(label.color || "ededed").replace(/^#/, "");
  const description = String(label.description || "").trim();
  const args = ["label", "create", name, "--color", color, "--force"];
  if (description) {
    args.push("--description", description);
  }
  console.log(`[label] ${name}`);
  execFileSync("gh", args, { stdio: "inherit" });
}

console.log(`Applied ${labels.length} labels.`);

