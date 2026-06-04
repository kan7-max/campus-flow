import { isOpenAiEnabled } from "@/lib/env";
import { env } from "@/lib/env";
import { normalizeExtractionResultDueYears } from "@/lib/ai/dueDateYearNormalizer";
import { HeuristicAssignmentExtractor } from "@/lib/ai/heuristicExtractor";
import { OpenAiAssignmentExtractor } from "@/lib/ai/providers/openaiAssignmentExtractor";
import type { ExtractorInput } from "@/lib/ai/types";
import type { AiExtractionCandidate, AiExtractionResult } from "@/lib/types/domain";

const heuristic = new HeuristicAssignmentExtractor();
const AI_EXTRACT_TIMEOUT_MS = 14_000;
const MAX_CANDIDATES = 24;

function clampConfidence(value: number) {
  if (Number.isNaN(value)) {
    return 0.5;
  }
  return Math.max(0.35, Math.min(0.98, value));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function toLooseKey(value: string) {
  return normalizeText(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function isActionLikeTitle(title: string) {
  return /(?:する|作成|確認|見直し|解く|提出|読む|書く|進める|整理|実施|復習|準備)$/u.test(
    normalizeText(title)
  );
}

function normalizeStringList(list: string[], maxLength: number) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of list) {
    const normalized = normalizeText(item);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);

    if (result.length >= maxLength) {
      break;
    }
  }

  return result;
}

function normalizeCandidate(candidate: AiExtractionCandidate): AiExtractionCandidate {
  const title = normalizeText(candidate.title) || "新規課題";
  const courseName = normalizeText(candidate.courseName) || null;
  const submissionTarget = normalizeText(candidate.submissionTarget) || null;
  const memo = normalizeText(candidate.memo) || null;

  const tags = new Set(candidate.tags);
  if (candidate.isHeavy) {
    tags.add("heavy");
  }

  return {
    ...candidate,
    title,
    courseName,
    submissionTarget,
    memo,
    estimatedHours: Math.max(1, Math.min(24, Math.round(candidate.estimatedHours || 1))),
    confidence: clampConfidence(candidate.confidence),
    tags: Array.from(tags),
    suggestedSubtasks: normalizeStringList(candidate.suggestedSubtasks, 5),
    studyPlan: normalizeStringList(candidate.studyPlan, 5)
  };
}

function candidateMissingCount(candidate: AiExtractionCandidate) {
  let missing = 0;
  if (!candidate.courseName) missing += 1;
  if (!candidate.dueAt) missing += 1;
  if (!candidate.submissionTarget) missing += 1;
  return missing;
}

function candidateSimilarityScore(left: AiExtractionCandidate, right: AiExtractionCandidate) {
  let score = 0;

  const leftTitle = toLooseKey(left.title);
  const rightTitle = toLooseKey(right.title);

  if (leftTitle && rightTitle) {
    if (leftTitle === rightTitle) {
      score += 0.52;
    } else if (leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle)) {
      score += 0.36;
    }
  }

  if (left.courseName && right.courseName) {
    const leftCourse = toLooseKey(left.courseName);
    const rightCourse = toLooseKey(right.courseName);
    if (leftCourse === rightCourse) {
      score += 0.28;
    }
  }

  if (left.assignmentType === right.assignmentType) {
    score += 0.16;
  }

  if (left.dueAt && right.dueAt && left.dueAt.slice(0, 10) === right.dueAt.slice(0, 10)) {
    score += 0.22;
  }

  return score;
}

function shouldUseHeuristicTitle(ai: AiExtractionCandidate, heuristicCandidate: AiExtractionCandidate) {
  if (!heuristicCandidate.title) {
    return false;
  }

  if (!ai.title) {
    return true;
  }

  if (isActionLikeTitle(ai.title) && !isActionLikeTitle(heuristicCandidate.title)) {
    return true;
  }

  return false;
}

function mergeCandidate(ai: AiExtractionCandidate, heuristicCandidate: AiExtractionCandidate): AiExtractionCandidate {
  const beforeMissing = candidateMissingCount(ai);

  const merged: AiExtractionCandidate = {
    ...ai,
    title: shouldUseHeuristicTitle(ai, heuristicCandidate) ? heuristicCandidate.title : ai.title,
    courseName: ai.courseName || heuristicCandidate.courseName,
    dueAt: ai.dueAt || heuristicCandidate.dueAt,
    submissionTarget: ai.submissionTarget || heuristicCandidate.submissionTarget,
    memo: ai.memo && ai.memo.length >= 20 ? ai.memo : heuristicCandidate.memo || ai.memo,
    estimatedHours:
      ai.estimatedHours <= 1 && heuristicCandidate.estimatedHours > 1
        ? heuristicCandidate.estimatedHours
        : ai.estimatedHours,
    isHeavy: ai.isHeavy || heuristicCandidate.isHeavy,
    tags: Array.from(new Set([...(ai.tags ?? []), ...(heuristicCandidate.tags ?? [])])),
    suggestedSubtasks: normalizeStringList(
      [...(ai.suggestedSubtasks ?? []), ...(heuristicCandidate.suggestedSubtasks ?? [])],
      5
    ),
    studyPlan: normalizeStringList([...(ai.studyPlan ?? []), ...(heuristicCandidate.studyPlan ?? [])], 5)
  };

  const afterMissing = candidateMissingCount(merged);
  const improvedFields = beforeMissing - afterMissing;
  const actionTitleUpgraded = ai.title !== merged.title ? 0.05 : 0;
  const confidenceBoost = improvedFields > 0 ? improvedFields * 0.08 : 0;

  merged.confidence = clampConfidence(ai.confidence + confidenceBoost + actionTitleUpgraded);
  return normalizeCandidate(merged);
}

function candidateRankScore(candidate: AiExtractionCandidate) {
  const dueBoost = candidate.dueAt ? 12 : 0;
  const courseBoost = candidate.courseName ? 7 : 0;
  const targetBoost = candidate.submissionTarget ? 5 : 0;
  const titleBoost = isActionLikeTitle(candidate.title) ? -4 : 4;
  return candidate.confidence * 100 + dueBoost + courseBoost + targetBoost + titleBoost;
}

function candidateKey(candidate: AiExtractionCandidate) {
  return [
    toLooseKey(candidate.title).slice(0, 60),
    toLooseKey(candidate.courseName ?? "").slice(0, 40),
    candidate.dueAt ? candidate.dueAt.slice(0, 10) : "",
    candidate.assignmentType,
    toLooseKey(candidate.submissionTarget ?? "").slice(0, 28)
  ].join("|");
}

function dedupeAndRankCandidates(candidates: AiExtractionCandidate[]) {
  const deduped: AiExtractionCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate);
    const key = candidateKey(normalized);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(normalized);
  }

  return deduped.sort((left, right) => candidateRankScore(right) - candidateRankScore(left)).slice(0, MAX_CANDIDATES);
}

function averageConfidence(candidates: AiExtractionCandidate[]) {
  if (candidates.length === 0) {
    return 0;
  }

  return candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / candidates.length;
}

function shouldUseHeuristicFastPath(input: ExtractorInput, heuristicResult: AiExtractionResult) {
  if (input.sourceType !== "chat") {
    return false;
  }

  if (input.text.length > 320) {
    return false;
  }

  const candidates = heuristicResult.candidates;
  if (candidates.length === 0 || candidates.length > 2) {
    return false;
  }

  const hasMissingCoreField = candidates.some((candidate) => !candidate.dueAt || !candidate.courseName);
  if (hasMissingCoreField) {
    return false;
  }

  if (averageConfidence(candidates) < 0.86) {
    return false;
  }

  const nonEmptyLineCount = input.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  return nonEmptyLineCount <= 6;
}

function mergeAiAndHeuristicResults(aiResult: AiExtractionResult, heuristicResult: AiExtractionResult) {
  const aiCandidates = aiResult.candidates.map(normalizeCandidate);
  const heuristicCandidates = heuristicResult.candidates.map(normalizeCandidate);
  const usedHeuristicIndexes = new Set<number>();

  const merged = aiCandidates.map((aiCandidate) => {
    let bestIndex = -1;
    let bestScore = 0;

    for (let index = 0; index < heuristicCandidates.length; index += 1) {
      if (usedHeuristicIndexes.has(index)) {
        continue;
      }

      const score = candidateSimilarityScore(aiCandidate, heuristicCandidates[index]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.34) {
      usedHeuristicIndexes.add(bestIndex);
      return mergeCandidate(aiCandidate, heuristicCandidates[bestIndex]);
    }

    return aiCandidate;
  });

  const supplements: AiExtractionCandidate[] = [];
  for (let index = 0; index < heuristicCandidates.length; index += 1) {
    if (usedHeuristicIndexes.has(index)) {
      continue;
    }

    const candidate = heuristicCandidates[index];
    const hasStrongSignal = Boolean(candidate.dueAt || candidate.courseName || candidate.submissionTarget);
    const hasAssignmentTextSignal = /課題|レポート|宿題|小テスト|試験|発表|提出|Unit|Chapter|assignment|report|quiz|exam|presentation/i.test(
      `${candidate.title} ${candidate.memo ?? ""}`
    );

    if (hasStrongSignal || hasAssignmentTextSignal || candidate.confidence >= 0.72) {
      supplements.push(candidate);
    }
  }

  const mergedCandidates = dedupeAndRankCandidates([...merged, ...supplements]);

  return {
    summary:
      mergedCandidates.length > 0
        ? `候補を${mergedCandidates.length}件抽出しました。保存前に締切・授業名を確認してください。`
        : "課題候補を抽出できませんでした。手動入力に切り替えて保存できます。",
    candidates: mergedCandidates,
    rawText: aiResult.rawText
  } satisfies AiExtractionResult;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}

export type AssignmentExtractionUsage = {
  fallbackError?: string;
  model: string;
  usedAi: boolean;
};

function normalizeHeuristicResult(result: AiExtractionResult) {
  return normalizeExtractionResultDueYears({
    ...result,
    candidates: dedupeAndRankCandidates(result.candidates)
  });
}

export async function extractAssignmentInfoWithUsage(
  input: ExtractorInput,
  options?: {
    heuristicResult?: AiExtractionResult;
  }
) {
  const resolveHeuristic = () => options?.heuristicResult ?? heuristic.extract(input);

  if (!isOpenAiEnabled) {
    const heuristicResult = await resolveHeuristic();
    return {
      result: normalizeHeuristicResult(heuristicResult),
      usage: {
        model: "heuristic-rule-based",
        usedAi: false
      } satisfies AssignmentExtractionUsage
    };
  }

  const ai = new OpenAiAssignmentExtractor(env.OPENAI_API_KEY!);
  const canUseHeuristicFastPath = input.sourceType === "chat" && input.text.length <= 320;
  const heuristicPromise = resolveHeuristic();
  let aiPromise: Promise<AiExtractionResult> | null = null;

  if (!canUseHeuristicFastPath) {
    aiPromise = withTimeout(
      ai.extract(input),
      AI_EXTRACT_TIMEOUT_MS,
      `Assignment extraction (${env.OPENAI_MODEL})`
    );
  }

  const heuristicResult = await heuristicPromise;
  const normalizedHeuristicResult = normalizeHeuristicResult(heuristicResult);

  if (shouldUseHeuristicFastPath(input, normalizedHeuristicResult)) {
    return {
      result: normalizedHeuristicResult,
      usage: {
        model: "heuristic-fast-path",
        usedAi: false
      } satisfies AssignmentExtractionUsage
    };
  }

  try {
    if (!aiPromise) {
      aiPromise = withTimeout(
        ai.extract(input),
        AI_EXTRACT_TIMEOUT_MS,
        `Assignment extraction (${env.OPENAI_MODEL})`
      );
    }
    const aiResult = await aiPromise;
    const merged = mergeAiAndHeuristicResults(aiResult, heuristicResult);

    return {
      result: normalizeExtractionResultDueYears(merged),
      usage: {
        model: env.OPENAI_MODEL,
        usedAi: true
      } satisfies AssignmentExtractionUsage
    };
  } catch (error) {
    console.error("OpenAI extraction failed, fallback to heuristic", error);
    return {
      result: normalizedHeuristicResult,
      usage: {
        fallbackError: error instanceof Error ? error.message : "OpenAI extraction failed",
        model: `${env.OPENAI_MODEL} -> heuristic-rule-based`,
        usedAi: false
      } satisfies AssignmentExtractionUsage
    };
  }
}

export async function extractAssignmentInfo(input: ExtractorInput) {
  return (await extractAssignmentInfoWithUsage(input)).result;
}
