import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "./lib/env.js";
import { ensureDir, readJsonIfExists, writeJson } from "./lib/io.js";
import { PATHS } from "./lib/paths.js";

const DEFAULT_WEIGHTS = {
  delivery_speed: 0.3,
  output_quality: 0.3,
  debuggability: 0.2,
  deploy_ease: 0.2
};

const TEMPLATE = {
  trial_name: "weekly-coding-tools",
  notes: "各指標は0-100で入力。delivery_speedは速いほど高得点。",
  weights: DEFAULT_WEIGHTS,
  tools: [
    {
      name: "Cursor",
      monthly_cost_usd: 20,
      metrics: {
        delivery_speed: 0,
        output_quality: 0,
        debuggability: 0,
        deploy_ease: 0
      },
      notes: ""
    },
    {
      name: "GitHub Copilot",
      monthly_cost_usd: 10,
      metrics: {
        delivery_speed: 0,
        output_quality: 0,
        debuggability: 0,
        deploy_ease: 0
      },
      notes: ""
    },
    {
      name: "Replit Agent",
      monthly_cost_usd: 25,
      metrics: {
        delivery_speed: 0,
        output_quality: 0,
        debuggability: 0,
        deploy_ease: 0
      },
      notes: ""
    }
  ]
};

function nowKey() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeWeights(weights = {}) {
  const keys = Object.keys(DEFAULT_WEIGHTS);
  const raw = {};
  for (const key of keys) {
    raw[key] = Number(weights[key]);
  }
  const sum = keys.reduce((acc, key) => acc + (Number.isFinite(raw[key]) ? Math.max(0, raw[key]) : 0), 0);
  if (sum <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }
  const normalized = {};
  for (const key of keys) {
    const v = Number.isFinite(raw[key]) ? Math.max(0, raw[key]) : 0;
    normalized[key] = v / sum;
  }
  return normalized;
}

function scoreTools(input) {
  const weights = normalizeWeights(input.weights || {});
  const rows = (input.tools || []).map((tool) => {
    const metrics = tool.metrics || {};
    let weighted = 0;
    for (const [key, weight] of Object.entries(weights)) {
      weighted += clampScore(metrics[key]) * weight;
    }
    const monthlyCost = Math.max(0, Number(tool.monthly_cost_usd) || 0);
    const costPenalty = Math.min(20, monthlyCost * 0.4);
    const roiScore = Math.max(0, Math.min(100, weighted - costPenalty));
    return {
      name: String(tool.name || "unknown"),
      monthly_cost_usd: monthlyCost,
      weighted_score: Number(weighted.toFixed(2)),
      cost_penalty: Number(costPenalty.toFixed(2)),
      roi_score: Number(roiScore.toFixed(2)),
      metrics: {
        delivery_speed: clampScore(metrics.delivery_speed),
        output_quality: clampScore(metrics.output_quality),
        debuggability: clampScore(metrics.debuggability),
        deploy_ease: clampScore(metrics.deploy_ease)
      },
      notes: String(tool.notes || "")
    };
  });
  rows.sort((a, b) => b.roi_score - a.roi_score);
  return { rows, weights };
}

function renderMarkdown(input, result) {
  const lines = [];
  lines.push(`# Coding Tools Comparison (${new Date().toISOString()})`);
  lines.push("");
  lines.push(`trial_name: ${input.trial_name || "n/a"}`);
  lines.push("");
  lines.push("## Ranking");
  result.rows.forEach((row, idx) => {
    lines.push(
      `${idx + 1}. ${row.name} | roi=${row.roi_score} weighted=${row.weighted_score} cost=$${row.monthly_cost_usd}/mo`
    );
  });
  lines.push("");
  lines.push("## Metrics");
  for (const row of result.rows) {
    lines.push(`### ${row.name}`);
    lines.push(`- delivery_speed: ${row.metrics.delivery_speed}`);
    lines.push(`- output_quality: ${row.metrics.output_quality}`);
    lines.push(`- debuggability: ${row.metrics.debuggability}`);
    lines.push(`- deploy_ease: ${row.metrics.deploy_ease}`);
    lines.push(`- monthly_cost_usd: ${row.monthly_cost_usd}`);
    lines.push(`- cost_penalty: ${row.cost_penalty}`);
    lines.push(`- roi_score: ${row.roi_score}`);
    if (row.notes) {
      lines.push(`- notes: ${row.notes}`);
    }
    lines.push("");
  }
  lines.push("## Next Action");
  if (result.rows.length >= 2) {
    lines.push(
      `- Top2 (${result.rows[0].name}, ${result.rows[1].name}) を次週の標準ツールとして採用し、同一タスクで再測定。`
    );
  } else {
    lines.push("- 比較対象を2つ以上入力して再実行。");
  }
  return lines.join("\n");
}

function commandInit() {
  const outDir = path.join(PATHS.dataDir, "evals", "coding-tools");
  ensureDir(outDir);
  const inputPath = path.join(outDir, "trial-input.json");
  if (!fs.existsSync(inputPath)) {
    writeJson(inputPath, TEMPLATE);
    console.log(`Template created: ${inputPath}`);
  } else {
    console.log(`Template exists: ${inputPath}`);
  }
}

function commandScore(inputPathArg = "") {
  const inPath =
    inputPathArg && String(inputPathArg).trim()
      ? path.resolve(String(inputPathArg).trim())
      : path.join(PATHS.dataDir, "evals", "coding-tools", "trial-input.json");
  const input = readJsonIfExists(inPath, null);
  if (!input) {
    throw new Error(`Input file not found: ${inPath}. Run tools:compare:init first.`);
  }
  const outDir = path.join(PATHS.dataDir, "evals", "coding-tools");
  ensureDir(outDir);
  const result = scoreTools(input);
  const stamp = nowKey();
  const jsonPath = path.join(outDir, `report-${stamp}.json`);
  const mdPath = path.join(outDir, `report-${stamp}.md`);
  writeJson(jsonPath, { generated_at: new Date().toISOString(), input_path: inPath, ...result });
  fs.writeFileSync(mdPath, renderMarkdown(input, result), "utf8");
  console.log(`Report JSON: ${jsonPath}`);
  console.log(`Report MD: ${mdPath}`);
}

function main() {
  loadEnvFile();
  const [command = "help", arg] = process.argv.slice(2);
  if (command === "init") {
    commandInit();
    return;
  }
  if (command === "score") {
    commandScore(arg);
    return;
  }
  console.log("Usage:");
  console.log("  npm run tools:compare:init");
  console.log("  npm run tools:compare:score -- [input_json_path]");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
