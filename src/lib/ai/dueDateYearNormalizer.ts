import type { AiExtractionCandidate, AiExtractionResult } from "@/lib/types/domain";

const explicitGregorianYearPattern = /(20\d{2})[\/\-.年]/;
const explicitJapaneseYearPattern = /(令和|平成)\s*\d+/;

function hasExplicitYearHint(sourceText: string) {
  return explicitGregorianYearPattern.test(sourceText) || explicitJapaneseYearPattern.test(sourceText);
}

export function normalizeDueAtYearForSource(dueAt: string | null, sourceText: string, now = new Date()) {
  if (!dueAt) {
    return null;
  }

  const parsed = new Date(dueAt);
  if (Number.isNaN(parsed.getTime())) {
    return dueAt;
  }

  if (hasExplicitYearHint(sourceText)) {
    return parsed.toISOString();
  }

  const currentYear = now.getFullYear();
  const parsedYear = parsed.getFullYear();

  // If text has no explicit year and AI returned a far past/future year, align to current year.
  if (parsedYear <= currentYear - 2 || parsedYear >= currentYear + 2) {
    const rebased = new Date(parsed);
    rebased.setFullYear(currentYear);
    return rebased.toISOString();
  }

  return parsed.toISOString();
}

function normalizeCandidate(candidate: AiExtractionCandidate, sourceText: string) {
  return {
    ...candidate,
    dueAt: normalizeDueAtYearForSource(candidate.dueAt, sourceText)
  };
}

export function normalizeExtractionResultDueYears(result: AiExtractionResult): AiExtractionResult {
  const sourceText = result.rawText ?? "";

  return {
    ...result,
    candidates: result.candidates.map((candidate) => normalizeCandidate(candidate, sourceText))
  };
}
