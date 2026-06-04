import { HeuristicAssignmentExtractor } from "@/lib/ai/heuristicExtractor";
import { extractAssignmentInfoWithUsage } from "@/lib/ai/extractAssignmentInfo";
import { isOpenAiEnabled } from "@/lib/env";
import { createHash } from "crypto";
import type { AiExtractionCandidate, InboxAssignmentCandidate, InboxAssignmentCandidateOption } from "@/lib/types/domain";

const extractor = new HeuristicAssignmentExtractor();
const INBOX_PARSE_CACHE_TTL_MS = 10 * 60_000;
const INBOX_PARSE_CACHE_MAX_ENTRIES = 64;
const MAX_INBOX_ALTERNATIVE_CANDIDATES = 23;

type InboxParseCacheEntry = {
  expiresAt: number;
  value: {
    candidate: InboxAssignmentCandidate;
    usage: InboxParseUsage;
  };
};

const inboxParseCache = new Map<string, InboxParseCacheEntry>();

function averageConfidence(candidates: AiExtractionCandidate[]) {
  if (candidates.length === 0) {
    return 0;
  }

  return candidates.reduce((sum, candidate) => sum + candidate.confidence, 0) / candidates.length;
}

function warningsForCandidate(candidate: AiExtractionCandidate) {
  const warnings: string[] = [];

  if (!candidate.dueAt) {
    warnings.push("締切を読み取れませんでした。保存前に日時を入力してください。");
  }

  if (!candidate.courseName) {
    warnings.push("授業名は未設定です。必要なら保存前に選んでください。");
  }

  if (!candidate.submissionTarget) {
    warnings.push("提出先は未設定です。LMSや教室提出などを確認してください。");
  }

  return warnings;
}

function toInboxCandidateOption(candidate: AiExtractionCandidate, extraWarnings: string[] = []): InboxAssignmentCandidateOption {
  return {
    title: candidate.title,
    courseName: candidate.courseName,
    dueAt: candidate.dueAt,
    submissionTarget: candidate.submissionTarget,
    assignmentType: candidate.assignmentType,
    memo: candidate.memo,
    estimatedHours: candidate.estimatedHours,
    isHeavy: candidate.isHeavy,
    tags: candidate.tags,
    confidence: candidate.confidence,
    suggestedSubtasks: candidate.suggestedSubtasks,
    warnings: [...extraWarnings, ...warningsForCandidate(candidate)]
  };
}

function toInboxCandidate(
  candidate: AiExtractionCandidate,
  alternativeCandidates: AiExtractionCandidate[] = [],
  extraWarnings: string[] = []
): InboxAssignmentCandidate {
  return {
    ...toInboxCandidateOption(candidate, extraWarnings),
    alternativeCandidates: alternativeCandidates.map((item) => toInboxCandidateOption(item))
  };
}

export type InboxParseUsage = {
  model: string;
  usedAi: boolean;
};

function toInboxCacheKey(rawText: string) {
  const hash = createHash("sha1").update(rawText.trim()).digest("hex");
  return `inbox:${hash}`;
}

function readInboxParseCache(key: string) {
  const entry = inboxParseCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    inboxParseCache.delete(key);
    return null;
  }

  return entry.value;
}

function writeInboxParseCache(key: string, value: InboxParseCacheEntry["value"]) {
  if (inboxParseCache.size >= INBOX_PARSE_CACHE_MAX_ENTRIES) {
    const oldestKey = inboxParseCache.keys().next().value;
    if (oldestKey) {
      inboxParseCache.delete(oldestKey);
    }
  }

  inboxParseCache.set(key, {
    expiresAt: Date.now() + INBOX_PARSE_CACHE_TTL_MS,
    value
  });
}

function countAssignmentSignals(text: string) {
  return (
    text.match(
      /課題|宿題|レポート|実験|小テスト|確認テスト|テスト|試験|発表|プレゼン|提出物|ワークシート|演習|Unit|Chapter|assignment|homework|submission|report|quiz|exam|presentation/gi
    ) ?? []
  ).length;
}

function countDueSignals(text: string) {
  return (
    text.match(
      /締切|締め切り|〆切|期限|提出期限|提出日|due|deadline|明日|明後日|本日|今日|来週|再来週|今週|週末|月末|\d{1,2}[\/月]\d{1,2}/gi
    ) ?? []
  ).length;
}

async function parseWithBestExtractor(rawText: string) {
  const trimmed = rawText.trim();
  const hasLmsSignal = /WebClass|LMS|Classroom|Moodle|manaba/i.test(trimmed);
  const hasTableLikeText = /締切|提出期限|提出先|提出方法|課題名|科目名|授業名/.test(trimmed) && /\n/.test(trimmed);
  const assignmentSignalCount = countAssignmentSignals(trimmed);
  const dueSignalCount = countDueSignals(trimmed);
  const heuristicResult = await extractor.extract({
    text: rawText,
    sourceType: "chat",
    timezone: "Asia/Tokyo"
  });

  const primary = heuristicResult.candidates[0] ?? null;
  const hasMissingCoreField = primary ? !primary.dueAt || !primary.courseName : true;
  const candidateCount = heuristicResult.candidates.length;
  const avgConfidence = averageConfidence(heuristicResult.candidates);
  const hasEnoughCandidates = candidateCount >= 2;
  const hasNoMissingCoreFields = heuristicResult.candidates.every((candidate) => Boolean(candidate.dueAt && candidate.courseName));
  const heuristicLooksUsable = hasEnoughCandidates && hasNoMissingCoreFields && avgConfidence >= 0.8;
  const likelyUnderExtracted =
    Math.max(assignmentSignalCount, dueSignalCount) >= 3
    && candidateCount < Math.min(Math.max(assignmentSignalCount, dueSignalCount), 5);

  const shouldUseAi =
    isOpenAiEnabled &&
    (
      trimmed.length >= 700
      || hasTableLikeText
      || likelyUnderExtracted
      || (hasLmsSignal && trimmed.length >= 120 && (hasMissingCoreField || avgConfidence < 0.8 || candidateCount <= 1))
      || (candidateCount === 1 && hasMissingCoreField && trimmed.length >= 70)
      || (!heuristicLooksUsable && avgConfidence < 0.7 && trimmed.length >= 70)
      || candidateCount === 0
    );

  if (shouldUseAi) {
    const { result, usage } = await extractAssignmentInfoWithUsage({
      text: rawText,
      sourceType: "chat",
      timezone: "Asia/Tokyo"
    }, {
      heuristicResult
    });
    return {
      result,
      usage: {
        model: usage.model,
        usedAi: usage.usedAi
      } satisfies InboxParseUsage
    };
  }

  return {
    result: heuristicResult,
    usage: {
      model: "heuristic-rule-based",
      usedAi: false
    } satisfies InboxParseUsage
  };
}

export async function parseInboxTextWithUsage(rawText: string): Promise<{
  candidate: InboxAssignmentCandidate;
  usage: InboxParseUsage;
}> {
  const cacheKey = toInboxCacheKey(rawText);
  const cached = readInboxParseCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { result, usage } = await parseWithBestExtractor(rawText);

  const candidate = result.candidates[0];
  if (!candidate) {
    throw new Error("課題候補を作れませんでした。入力内容はInboxに残っています。");
  }

  const alternativeCandidates = result.candidates.slice(1, 1 + MAX_INBOX_ALTERNATIVE_CANDIDATES);
  const extraWarnings =
    result.candidates.length > 1
      ? [`長文から${result.candidates.length}件の候補を見つけました。候補ごとに確認して課題化できます。`]
      : [];

  const parsed = {
    candidate: toInboxCandidate(candidate, alternativeCandidates, extraWarnings),
    usage
  };

  writeInboxParseCache(cacheKey, parsed);
  return parsed;
}

export async function parseInboxText(rawText: string): Promise<InboxAssignmentCandidate> {
  const parsed = await parseInboxTextWithUsage(rawText);
  return parsed.candidate;
}
