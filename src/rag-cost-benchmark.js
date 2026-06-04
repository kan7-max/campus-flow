import fs from "node:fs";
import path from "node:path";
import { loadEnvFile, getEnv } from "./lib/env.js";
import { ensureDir, readJsonIfExists, writeJson } from "./lib/io.js";
import { PATHS } from "./lib/paths.js";
import { rankItems } from "./lib/ranking.js";

function parsePositiveInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function parseNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function estimateTokens(text) {
  // 英語・日本語混在でのざっくり見積もり
  return Math.ceil(String(text || "").length / 4);
}

function buildBaselineContext(scored, topN = 10) {
  return scored
    .slice(0, topN)
    .map(({ item, score }, i) =>
      [
        `[#${i + 1}] rank_score=${score.toFixed(3)}`,
        `date: ${item.created_at || "unknown"}`,
        `author: @${item.author_username || "unknown"} verified=${Boolean(item.author_verified)}`,
        `category: ${item.analysis?.category || "unknown"}`,
        `relevance: ${item.analysis?.relevance_score ?? "n/a"}`,
        `practicality: ${item.analysis?.practicality_score ?? "n/a"}`,
        `impact: ${item.analysis?.impact_score ?? "n/a"}`,
        `readiness: ${item.analysis?.implementation_readiness || "unknown"}`,
        `summary_ja: ${item.analysis?.summary_ja || ""}`,
        `why_matters_ja: ${item.analysis?.why_matters_ja || ""}`,
        `action_ja: ${item.analysis?.action_ja || ""}`,
        `text: ${item.text || ""}`,
        `url: ${item.url || "n/a"}`
      ].join("\n")
    )
    .join("\n\n");
}

function buildCompactContext(scored, topN = 6) {
  return scored
    .slice(0, topN)
    .map(({ item, score }, i) =>
      [
        `[#${i + 1}] rank_score=${score.toFixed(3)}`,
        `date: ${item.created_at || "unknown"}`,
        `verified: ${Boolean(item.author_verified)}`,
        `category: ${item.analysis?.category || "unknown"}`,
        `readiness: ${item.analysis?.implementation_readiness || "unknown"}`,
        `summary_ja: ${item.analysis?.summary_ja || ""}`,
        `action_ja: ${item.analysis?.action_ja || ""}`,
        `url: ${item.url || "n/a"}`
      ].join("\n")
    )
    .join("\n\n");
}

function loadQueries() {
  const loaded = readJsonIfExists(path.join(PATHS.root, "config", "rag-benchmark-queries.json"), null);
  if (Array.isArray(loaded?.queries) && loaded.queries.length > 0) {
    return loaded.queries.map((q) => String(q).trim()).filter(Boolean);
  }
  return [
    "今週のAIトレンドで、業務自動化にすぐ効くものは？",
    "RAG導入判断で優先すべき実装は？"
  ];
}

function estimateUsd(inputTokens, outputTokens, inputPer1M, outputPer1M) {
  const inCost = (inputTokens / 1_000_000) * inputPer1M;
  const outCost = (outputTokens / 1_000_000) * outputPer1M;
  return inCost + outCost;
}

function renderMarkdown(result) {
  const lines = [];
  lines.push(`# RAG Cost Benchmark (${new Date().toISOString()})`);
  lines.push("");
  lines.push(`cases: ${result.cases.length}`);
  lines.push(`baseline_total_input_tokens_est: ${result.summary.baseline_total_input_tokens_est}`);
  lines.push(`compact_total_input_tokens_est: ${result.summary.compact_total_input_tokens_est}`);
  lines.push(`reduction_ratio_pct: ${result.summary.reduction_ratio_pct}%`);
  lines.push("");
  lines.push("## Recommendation");
  lines.push(`- ASK_CONTEXT_MODE=${result.recommendation.ASK_CONTEXT_MODE}`);
  lines.push(`- ASK_CONTEXT_TOP_N=${result.recommendation.ASK_CONTEXT_TOP_N}`);
  lines.push(`- ASK_CONTEXT_INCLUDE_TEXT=${result.recommendation.ASK_CONTEXT_INCLUDE_TEXT}`);
  lines.push("");
  lines.push("## Per Query");
  for (const row of result.cases) {
    lines.push(`- ${row.query}`);
    lines.push(
      `  baseline_in=${row.baseline_input_tokens_est}, compact_in=${row.compact_input_tokens_est}, reduction=${row.reduction_pct}%`
    );
  }
  return lines.join("\n");
}

function main() {
  loadEnvFile();
  const items = readJsonIfExists(PATHS.processedItemsJson, []);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No processed items found. Run process first.");
  }

  const queries = loadQueries();
  const minRelevance = parsePositiveInt(getEnv("MIN_AI_RELEVANCE", "65"), 65, 0, 100);
  const minPracticality = parsePositiveInt(getEnv("MIN_PRACTICALITY", "60"), 60, 0, 100);
  const lookbackDays = parsePositiveInt(getEnv("ASK_LOOKBACK_DAYS", "7"), 7, 1, 365);
  const baselineTopN = parsePositiveInt(getEnv("RAG_BENCH_BASELINE_TOP_N", "10"), 10, 1, 30);
  const compactTopN = parsePositiveInt(getEnv("RAG_BENCH_COMPACT_TOP_N", "6"), 6, 1, 30);
  const outputTokensEstimate = parsePositiveInt(getEnv("RAG_BENCH_OUTPUT_TOKENS_EST", "700"), 700, 1, 8000);
  const inputCostPer1M = parseNumber(getEnv("RAG_BENCH_INPUT_COST_PER_1M", "0.4"), 0.4);
  const outputCostPer1M = parseNumber(getEnv("RAG_BENCH_OUTPUT_COST_PER_1M", "1.6"), 1.6);

  const cases = [];
  let baselineInputTotal = 0;
  let compactInputTotal = 0;
  let baselineUsd = 0;
  let compactUsd = 0;

  for (const query of queries) {
    const scored = rankItems(items, query, Math.max(baselineTopN, compactTopN), {
      minRelevance,
      minPracticality,
      lookbackDays
    });
    const baselineContext = buildBaselineContext(scored, baselineTopN);
    const compactContext = buildCompactContext(scored, compactTopN);
    const baselineInputTokens = estimateTokens(query + "\n" + baselineContext);
    const compactInputTokens = estimateTokens(query + "\n" + compactContext);
    const reductionPct = baselineInputTokens > 0
      ? Number((((baselineInputTokens - compactInputTokens) / baselineInputTokens) * 100).toFixed(1))
      : 0;
    baselineInputTotal += baselineInputTokens;
    compactInputTotal += compactInputTokens;
    baselineUsd += estimateUsd(baselineInputTokens, outputTokensEstimate, inputCostPer1M, outputCostPer1M);
    compactUsd += estimateUsd(compactInputTokens, outputTokensEstimate, inputCostPer1M, outputCostPer1M);
    cases.push({
      query,
      baseline_input_tokens_est: baselineInputTokens,
      compact_input_tokens_est: compactInputTokens,
      reduction_pct: reductionPct
    });
  }

  const reductionRatioPct = baselineInputTotal > 0
    ? Number((((baselineInputTotal - compactInputTotal) / baselineInputTotal) * 100).toFixed(1))
    : 0;

  const result = {
    generated_at: new Date().toISOString(),
    assumptions: {
      lookback_days: lookbackDays,
      baseline_top_n: baselineTopN,
      compact_top_n: compactTopN,
      output_tokens_est_per_answer: outputTokensEstimate,
      input_cost_per_1m: inputCostPer1M,
      output_cost_per_1m: outputCostPer1M
    },
    summary: {
      baseline_total_input_tokens_est: baselineInputTotal,
      compact_total_input_tokens_est: compactInputTotal,
      reduction_ratio_pct: reductionRatioPct,
      baseline_total_cost_usd_est: Number(baselineUsd.toFixed(6)),
      compact_total_cost_usd_est: Number(compactUsd.toFixed(6)),
      cost_delta_usd_est: Number((baselineUsd - compactUsd).toFixed(6))
    },
    recommendation: {
      ASK_CONTEXT_MODE: "compact",
      ASK_CONTEXT_TOP_N: compactTopN,
      ASK_CONTEXT_INCLUDE_TEXT: false
    },
    cases
  };

  const outDir = path.join(PATHS.dataDir, "evals", "rag");
  ensureDir(outDir);
  const key = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `benchmark-${key}.json`);
  const mdPath = path.join(outDir, `benchmark-${key}.md`);
  writeJson(jsonPath, result);
  fs.writeFileSync(mdPath, renderMarkdown(result), "utf8");

  console.log(`RAG benchmark JSON: ${jsonPath}`);
  console.log(`RAG benchmark MD: ${mdPath}`);
  console.log(
    `Input token reduction estimate: ${reductionRatioPct}% ` +
      `(baseline=${baselineInputTotal}, compact=${compactInputTotal})`
  );
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
