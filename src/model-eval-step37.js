import fs from "node:fs";
import path from "node:path";
import { loadEnvFile, getEnv } from "./lib/env.js";
import { ensureDir, readJsonIfExists, writeJson } from "./lib/io.js";
import { PATHS } from "./lib/paths.js";
import { rankItems } from "./lib/ranking.js";
import { callOpenAIText } from "./lib/openai.js";

function parsePositiveInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const v = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on", "y"].includes(v)) return true;
  if (["0", "false", "no", "off", "n"].includes(v)) return false;
  return fallback;
}

function loadQuestions() {
  const file = path.join(PATHS.root, "config", "model-eval-step37-questions.json");
  const loaded = readJsonIfExists(file, null);
  if (Array.isArray(loaded?.questions) && loaded.questions.length > 0) {
    return loaded.questions.map((q) => String(q).trim()).filter(Boolean);
  }
  return ["RAG導入判断で優先すべき実装を3つ、結論→根拠→次アクションで答えて。"];
}

function buildContext(scored, topN = 8) {
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
        `action_ja: ${item.analysis?.action_ja || ""}`,
        `url: ${item.url || "n/a"}`
      ].join("\n")
    )
    .join("\n\n");
}

function buildPrompt(question, context) {
  const system = `
You are a rigorous AI research assistant focused on decision quality.
Use only the provided context.
If evidence is weak, say so explicitly.
Output in Japanese and in this exact section order:
1) 結論
2) 根拠
3) 次アクション（導入方法など）
4) URL
`.trim();
  const user = `
質問:
${question}

コンテキスト:
${context}
`.trim();
  return { system, user };
}

function scoreStructure(answerText) {
  const text = String(answerText || "");
  const required = ["結論", "根拠", "次アクション", "URL"];
  let score = 0;
  for (const token of required) {
    if (text.includes(token)) score += 25;
  }
  return score;
}

async function callStep37(systemPrompt, userPrompt) {
  const apiKey = getEnv("OPENROUTER_API_KEY", "");
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }
  const endpoint = getEnv("STEP37_CHAT_COMPLETIONS_URL", "https://openrouter.ai/api/v1/chat/completions");
  const model = getEnv("STEP37_MODEL", "stepfun-ai/step-3.7-flash");
  const referer = getEnv("OPENROUTER_HTTP_REFERER", "");
  const title = getEnv("OPENROUTER_APP_TITLE", "ai-intel-rag-pipeline");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`
  };
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;

  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2
    })
  });
  const raw = await response.text();
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // keep raw
  }
  if (!response.ok) {
    const detail = json?.error?.message || raw || "unknown error";
    throw new Error(`Step3.7 API ${response.status}: ${detail}`);
  }
  const text = String(json?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    throw new Error("Step3.7 response had no text.");
  }
  return {
    text,
    latency_ms: Date.now() - started,
    usage: json?.usage || null
  };
}

async function judgePair(question, baselineAnswer, candidateAnswer) {
  const system = `
You are a strict evaluator.
Score each answer 0-100 by:
- decision_quality
- concreteness
- actionability
- source_grounding
Return STRICT JSON only:
{
  "baseline_score": 0,
  "candidate_score": 0,
  "winner": "baseline|candidate|tie",
  "reason_ja": "日本語1-2文"
}
`.trim();
  const user = `
Question:
${question}

Baseline answer:
${baselineAnswer}

Candidate answer:
${candidateAnswer}
`.trim();
  const out = await callOpenAIText(system, user, { model: getEnv("MODEL_EVAL_JUDGE_MODEL", "gpt-4.1-mini") });
  const trimmed = out.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Judge output parse failed");
  }
  return JSON.parse(jsonMatch[0]);
}

function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Step 3.7 Flash Evaluation (${report.generated_at})`);
  lines.push("");
  lines.push(`baseline_model: ${report.baseline.model}`);
  lines.push(`candidate_model: ${report.candidate.model}`);
  lines.push(`cases: ${report.cases.length}`);
  lines.push(`candidate_available: ${report.candidate.available}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- baseline_avg_structure_score: ${report.summary.baseline_avg_structure_score}`);
  lines.push(`- candidate_avg_structure_score: ${report.summary.candidate_avg_structure_score}`);
  lines.push(`- baseline_avg_latency_ms: ${report.summary.baseline_avg_latency_ms}`);
  lines.push(`- candidate_avg_latency_ms: ${report.summary.candidate_avg_latency_ms}`);
  if (report.summary.judge) {
    lines.push(`- judge_baseline_wins: ${report.summary.judge.baseline_wins}`);
    lines.push(`- judge_candidate_wins: ${report.summary.judge.candidate_wins}`);
    lines.push(`- judge_ties: ${report.summary.judge.ties}`);
  }
  lines.push("");
  lines.push("## Per Case");
  for (const row of report.cases) {
    lines.push(`- Q: ${row.question}`);
    lines.push(
      `  baseline(score=${row.baseline.structure_score}, latency=${row.baseline.latency_ms}ms), ` +
        `candidate(score=${row.candidate?.structure_score ?? "n/a"}, latency=${row.candidate?.latency_ms ?? "n/a"}ms)`
    );
    if (row.judge) {
      lines.push(`  judge: winner=${row.judge.winner} reason=${row.judge.reason_ja}`);
    }
  }
  return lines.join("\n");
}

async function main() {
  loadEnvFile();
  const items = readJsonIfExists(PATHS.processedItemsJson, []);
  if (!Array.isArray(items) || !items.length) {
    throw new Error("No processed items found. Run process first.");
  }

  const maxCases = parsePositiveInt(getEnv("MODEL_EVAL_MAX_CASES", "5"), 5, 1, 20);
  const useJudge = parseBool(getEnv("MODEL_EVAL_USE_JUDGE", "true"), true);
  const questions = loadQuestions().slice(0, maxCases);
  const minRelevance = parsePositiveInt(getEnv("MIN_AI_RELEVANCE", "65"), 65, 0, 100);
  const minPracticality = parsePositiveInt(getEnv("MIN_PRACTICALITY", "60"), 60, 0, 100);
  const askLookbackDays = parsePositiveInt(getEnv("ASK_LOOKBACK_DAYS", "7"), 7, 1, 365);
  const contextTopN = parsePositiveInt(getEnv("MODEL_EVAL_CONTEXT_TOP_N", "8"), 8, 1, 20);

  const candidateAvailable = Boolean(getEnv("OPENROUTER_API_KEY", ""));
  const cases = [];

  for (const question of questions) {
    const scored = rankItems(items, question, contextTopN, {
      minRelevance,
      minPracticality,
      lookbackDays: askLookbackDays
    });
    const context = buildContext(scored, contextTopN);
    const { system, user } = buildPrompt(question, context);

    const baselineStart = Date.now();
    const baselineText = await callOpenAIText(system, user, {
      model: getEnv("OPENAI_MODEL", "gpt-4.1-mini")
    });
    const baseline = {
      text: baselineText,
      latency_ms: Date.now() - baselineStart,
      structure_score: scoreStructure(baselineText)
    };

    let candidate = null;
    if (candidateAvailable) {
      try {
        const result = await callStep37(system, user);
        candidate = {
          text: result.text,
          latency_ms: result.latency_ms,
          structure_score: scoreStructure(result.text),
          usage: result.usage || null
        };
      } catch (error) {
        candidate = {
          error: error.message,
          text: "",
          latency_ms: null,
          structure_score: 0
        };
      }
    }

    let judge = null;
    if (useJudge && candidate && !candidate.error) {
      try {
        judge = await judgePair(question, baseline.text, candidate.text);
      } catch (error) {
        judge = { error: error.message };
      }
    }

    cases.push({ question, baseline, candidate, judge });
    console.log(`evaluated: ${question}`);
  }

  const baselineScores = cases.map((c) => c.baseline.structure_score);
  const baselineLatency = cases.map((c) => c.baseline.latency_ms).filter((v) => Number.isFinite(v));
  const candidateRows = cases.map((c) => c.candidate).filter(Boolean);
  const candidateScores = candidateRows.map((c) => c.structure_score || 0);
  const candidateLatency = candidateRows.map((c) => c.latency_ms).filter((v) => Number.isFinite(v));
  const judgeRows = cases.map((c) => c.judge).filter((j) => j && !j.error);

  const avg = (arr) =>
    arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;

  const summary = {
    baseline_avg_structure_score: avg(baselineScores),
    candidate_avg_structure_score: avg(candidateScores),
    baseline_avg_latency_ms: avg(baselineLatency),
    candidate_avg_latency_ms: avg(candidateLatency)
  };
  if (judgeRows.length) {
    summary.judge = {
      baseline_wins: judgeRows.filter((j) => j.winner === "baseline").length,
      candidate_wins: judgeRows.filter((j) => j.winner === "candidate").length,
      ties: judgeRows.filter((j) => j.winner === "tie").length
    };
  }

  const report = {
    generated_at: new Date().toISOString(),
    baseline: {
      provider: "openai",
      model: getEnv("OPENAI_MODEL", "gpt-4.1-mini")
    },
    candidate: {
      provider: "openrouter",
      model: getEnv("STEP37_MODEL", "stepfun-ai/step-3.7-flash"),
      available: candidateAvailable
    },
    summary,
    cases
  };

  const outDir = path.join(PATHS.dataDir, "evals", "models");
  ensureDir(outDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `step37-eval-${stamp}.json`);
  const mdPath = path.join(outDir, `step37-eval-${stamp}.md`);
  writeJson(jsonPath, report);
  fs.writeFileSync(mdPath, renderMarkdown(report), "utf8");
  writeJson(path.join(PATHS.dataDir, "state", "model-eval-step37-latest.json"), report);

  console.log(`Model eval JSON: ${jsonPath}`);
  console.log(`Model eval MD: ${mdPath}`);
  if (!candidateAvailable) {
    console.log("Candidate model not evaluated: set OPENROUTER_API_KEY to run Step 3.7 comparison.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
