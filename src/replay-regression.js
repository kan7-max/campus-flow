import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnvFile, getEnv } from "./lib/env.js";
import { ensureDir, readJsonIfExists, writeJson } from "./lib/io.js";
import { PATHS } from "./lib/paths.js";

function parsePositiveInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function defaultCasesPath() {
  return path.join(PATHS.dataDir, "regression", "cases.json");
}

function templateCasesPath() {
  return path.join(PATHS.root, "templates", "replay-regression-cases.template.json");
}

function initCases() {
  const target = defaultCasesPath();
  ensureDir(path.dirname(target));
  if (fs.existsSync(target)) {
    console.log(`Cases exists: ${target}`);
    return;
  }
  const template = readJsonIfExists(templateCasesPath(), null);
  if (!template) {
    throw new Error(`Template missing: ${templateCasesPath()}`);
  }
  writeJson(target, template);
  console.log(`Cases initialized: ${target}`);
}

function evaluateAssertions(output, assertions = {}) {
  const text = String(output || "");
  const failures = [];

  for (const token of assertions.must_include || []) {
    if (!text.includes(String(token))) {
      failures.push(`missing_token:${token}`);
    }
  }
  for (const token of assertions.must_not_include || []) {
    if (text.includes(String(token))) {
      failures.push(`forbidden_token:${token}`);
    }
  }
  const minLength = Number(assertions.min_length);
  if (Number.isFinite(minLength) && text.length < minLength) {
    failures.push(`too_short:${text.length}<${minLength}`);
  }
  const maxLength = Number(assertions.max_length);
  if (Number.isFinite(maxLength) && text.length > maxLength) {
    failures.push(`too_long:${text.length}>${maxLength}`);
  }

  return {
    pass: failures.length === 0,
    failures
  };
}

function runCase(testCase, timeoutMs) {
  const startedAt = Date.now();
  let output = "";
  let errorMessage = "";
  try {
    output = execFileSync(process.execPath, ["src/ask.js", String(testCase.question || "")], {
      cwd: PATHS.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    output = String(error?.stdout || "");
    errorMessage = String(error?.stderr || error?.message || "unknown_error").trim();
  }
  const latencyMs = Date.now() - startedAt;
  const assertions = evaluateAssertions(output, testCase.assertions || {});
  const pass = assertions.pass && !errorMessage;
  return {
    id: String(testCase.id || "unknown"),
    question: String(testCase.question || ""),
    pass,
    latency_ms: latencyMs,
    output_chars: output.length,
    failures: assertions.failures,
    error: errorMessage || null
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Replay Regression Report (${report.generated_at})`);
  lines.push("");
  lines.push(`pass: ${report.summary.pass_count}/${report.summary.total}`);
  lines.push(`fail: ${report.summary.fail_count}/${report.summary.total}`);
  lines.push(`avg_latency_ms: ${report.summary.avg_latency_ms}`);
  lines.push("");
  lines.push("## Cases");
  for (const row of report.results) {
    lines.push(`- [${row.pass ? "PASS" : "FAIL"}] ${row.id} (${row.latency_ms}ms, chars=${row.output_chars})`);
    if (row.failures.length) {
      lines.push(`  failures: ${row.failures.join(", ")}`);
    }
    if (row.error) {
      lines.push(`  error: ${row.error}`);
    }
  }
  return lines.join("\n");
}

function runRegression(casesFileArg = "") {
  const filePath = casesFileArg
    ? path.resolve(casesFileArg)
    : path.resolve(getEnv("REPLAY_CASES_FILE", defaultCasesPath()));
  const loaded = readJsonIfExists(filePath, null);
  if (!loaded || !Array.isArray(loaded.cases) || loaded.cases.length === 0) {
    throw new Error(`No regression cases found: ${filePath}`);
  }
  const timeoutMs = parsePositiveInt(getEnv("REPLAY_CASE_TIMEOUT_MS", "180000"), 180000, 1000, 1800000);
  const maxCases = parsePositiveInt(getEnv("REPLAY_MAX_CASES", String(loaded.cases.length)), loaded.cases.length);
  const cases = loaded.cases.slice(0, maxCases);
  const results = cases.map((testCase) => runCase(testCase, timeoutMs));
  const passCount = results.filter((x) => x.pass).length;
  const failCount = results.length - passCount;
  const avgLatency = results.length
    ? Number((results.reduce((acc, x) => acc + x.latency_ms, 0) / results.length).toFixed(2))
    : null;

  const report = {
    generated_at: new Date().toISOString(),
    cases_file: filePath,
    summary: {
      total: results.length,
      pass_count: passCount,
      fail_count: failCount,
      avg_latency_ms: avgLatency
    },
    results
  };

  const outDir = path.join(PATHS.dataDir, "regression");
  ensureDir(outDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `report-${stamp}.json`);
  const mdPath = path.join(outDir, `report-${stamp}.md`);
  writeJson(jsonPath, report);
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf8");
  writeJson(path.join(outDir, "latest-report.json"), report);

  console.log(`Replay report JSON: ${jsonPath}`);
  console.log(`Replay report MD: ${mdPath}`);
  console.log(`Replay summary: pass=${passCount} fail=${failCount}`);
  if (failCount > 0) {
    process.exitCode = 1;
  }
}

function main() {
  loadEnvFile();
  const [command = "help", arg] = process.argv.slice(2);
  if (command === "init") {
    initCases();
    return;
  }
  if (command === "run") {
    runRegression(arg);
    return;
  }
  console.log("Usage:");
  console.log("  npm run replay:init");
  console.log("  npm run replay:run -- [cases_json_path]");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
