import { addDays, addWeeks, nextDay, setHours, setMinutes } from "date-fns";
import { suggestEstimatedHours } from "@/lib/services/priorityService";
import type { AssignmentExtractor, ExtractorInput } from "@/lib/ai/types";
import type { AiExtractionCandidate, AiExtractionResult, AssignmentTag, AssignmentType, PriorityLabel } from "@/lib/types/domain";

const MAX_CANDIDATES = 24;

const dayMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  日: 0,
  月: 1,
  火: 2,
  水: 3,
  木: 4,
  金: 5,
  土: 6
};

const assignmentSignalPattern =
  /課題|宿題|レポート|実験|小テスト|テスト|試験|発表|プレゼン|プレゼンテーション|提出物|ワークシート|演習|問題|Unit|Chapter|assignment|homework|report|quiz|exam|presentation|worksheet/i;

const dueSignalPattern =
  /締切|締め切り|〆切|期限|提出期限|提出日|due|deadline|まで|(\d{4}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2})|(\d{1,2}[\/月]\d{1,2})|今日|本日|明日|明後日|来週|再来週|今週|週末|月末|[月火水木金土日]曜?/i;

const targetSignalPattern =
  /提出先|提出方法|提出場所|アップロード|LMS|WebClass|Classroom|Google Classroom|Moodle|manaba|Teams|メール|教室提出/i;

const continuationSignalPattern =
  /内容|範囲|形式|条件|要件|注意|備考|メモ|ページ|章|Unit|Chapter|グラフ|考察|添付|ファイル|PDF|Word|スライド|資料|問題|問\d+/i;

const noiseLinePattern =
  /^(ホーム|戻る|一覧|シラバス|お知らせ|通知|ログアウト|ログイン|メニュー|検索|前へ|次へ|保存|キャンセル|編集|削除|詳細|未読|既読|トップ|ページ上部)$/i;

function hasAssignmentSignal(text: string) {
  return assignmentSignalPattern.test(text);
}

function hasDueSignal(text: string) {
  return dueSignalPattern.test(text);
}

function hasTargetSignal(text: string) {
  return targetSignalPattern.test(text);
}

function toEndOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 0, 0);
  return normalized;
}

function rollForwardYearIfLikelyNextAcademicTerm(candidate: Date, now: Date) {
  const diffDays = (candidate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (diffDays < -150) {
    const shifted = new Date(candidate);
    shifted.setFullYear(shifted.getFullYear() + 1);
    return shifted;
  }
  return candidate;
}

function normalizeDate(text: string): string | null {
  const now = new Date();

  const absolute = text.match(/(20\d{2})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})(?:日)?(?:\D+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (absolute) {
    const [, y, m, d, hh, mm] = absolute;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 23), Number(mm ?? 59));
    return date.toISOString();
  }

  const monthDay = text.match(/(\d{1,2})月(\d{1,2})日?(?:\D+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (monthDay) {
    const [, m, d, hh, mm] = monthDay;
    const date = new Date(now.getFullYear(), Number(m) - 1, Number(d), Number(hh ?? 23), Number(mm ?? 59), 0, 0);
    const adjusted = rollForwardYearIfLikelyNextAcademicTerm(date, now);
    return adjusted.toISOString();
  }

  const short = text.match(/(\d{1,2})\/(\d{1,2})(?:\D+(\d{1,2})(?::(\d{1,2}))?)?/);
  if (short) {
    const [, m, d, hh, mm] = short;
    const date = new Date(now.getFullYear(), Number(m) - 1, Number(d), Number(hh ?? 23), Number(mm ?? 59), 0, 0);
    const adjusted = rollForwardYearIfLikelyNextAcademicTerm(date, now);
    return adjusted.toISOString();
  }

  const weekAfterNext = text.match(/再来週([月火水木金土日])(?:曜)?/);
  if (weekAfterNext) {
    const targetDay = dayMap[weekAfterNext[1]];
    const start = addWeeks(now, 2);
    const candidate = nextDay(start, targetDay);
    return setMinutes(setHours(candidate, 23), 59).toISOString();
  }

  const nextWeek = text.match(/来週([月火水木金土日])(?:曜)?/);
  if (nextWeek) {
    const targetDay = dayMap[nextWeek[1]];
    const start = addWeeks(now, 1);
    const candidate = nextDay(start, targetDay);
    return setMinutes(setHours(candidate, 23), 59).toISOString();
  }

  const thisWeekExplicit = text.match(/今週\s*([月火水木金土日])(?:曜)?/);
  if (thisWeekExplicit) {
    const targetDay = dayMap[thisWeekExplicit[1]];
    const candidate = nextDay(addDays(now, -1), targetDay);
    return toEndOfDay(candidate).toISOString();
  }

  const thisWeek = text.match(/([月火水木金土日])(?:曜)?まで/);
  if (thisWeek) {
    const targetDay = dayMap[thisWeek[1]];
    const candidate = nextDay(addDays(now, -1), targetDay);
    return toEndOfDay(candidate).toISOString();
  }

  if (text.includes("今週中") || text.includes("週末")) {
    const candidate = nextDay(addDays(now, -1), 0);
    return toEndOfDay(candidate).toISOString();
  }

  if (text.includes("今月末") || text.includes("月末")) {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return toEndOfDay(monthEnd).toISOString();
  }

  if (text.includes("本日") || text.includes("今日")) {
    return toEndOfDay(now).toISOString();
  }

  if (text.includes("明後日")) {
    return toEndOfDay(addDays(now, 2)).toISOString();
  }

  if (text.includes("明日")) {
    return toEndOfDay(addDays(now, 1)).toISOString();
  }

  if (text.includes("来週")) {
    return toEndOfDay(addDays(now, 7)).toISOString();
  }

  return null;
}

function inferType(text: string): AssignmentType {
  if (/実験レポート|lab/i.test(text)) return "lab_report";
  if (/レポート|report/i.test(text)) return "report";
  if (/小テスト|quiz|テスト/i.test(text)) return "quiz";
  if (/発表|presentation|プレゼン|スライド|資料/i.test(text)) return "presentation";
  if (/試験|exam/i.test(text)) return "exam";
  if (/宿題|homework|ワークシート|worksheet/i.test(text)) return "homework";
  return "other";
}

function normalizeLabelValue(value: string) {
  return value
    .replace(/[【】\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[：:\-\s]+/, "")
    .trim();
}

function inferCourse(text: string): string | null {
  const labeled = text.match(/(?:科目名|授業名|講義名|コース|授業|科目|Course|Class)[:：]\s*([^\n。]{2,40})/i);
  if (labeled?.[1]) {
    return normalizeLabelValue(labeled[1])
      .replace(/(?:課題|レポート|締切|期限|提出).*$/, "")
      .trim();
  }

  const knownCourse = text.match(/(英語コミュニケーション|英語プレゼン|物理実験|情報リテラシー|応用数学|電磁気|英語|物理|数学|情報|統計|化学|経済)/);
  return knownCourse?.[1] ?? null;
}

function inferTarget(text: string): string | null {
  const match = text.match(/(?:提出先|提出方法|提出場所)[は:：]?\s*([A-Za-z0-9\u3040-\u30ff\u4e00-\u9faf-_ ]{2,40})/);
  if (match?.[1]) {
    const label = normalizeLabelValue(match[1]).replace(/(?:締切|期限|まで).*$/, "").trim();
    if (/Google Classroom|Classroom/i.test(label)) return "Google Classroom";
    if (/WebClass/i.test(label)) return "WebClass";
    if (/Moodle/i.test(label)) return "Moodle";
    if (/manaba/i.test(label)) return "manaba";
    if (/Teams/i.test(label)) return "Teams";
    if (/LMS/i.test(label)) return "LMS";
    return label;
  }

  if (/Google Classroom|Classroom/i.test(text)) return "Google Classroom";
  if (/WebClass/i.test(text)) return "WebClass";
  if (/Moodle/i.test(text)) return "Moodle";
  if (/manaba/i.test(text)) return "manaba";
  if (/Teams/i.test(text)) return "Teams";
  if (/LMS/i.test(text)) return "LMS";
  return null;
}

function inferPriority(type: AssignmentType, dueAt: string | null): PriorityLabel {
  if (!dueAt) {
    return type === "lab_report" ? "high" : "medium";
  }

  const hoursLeft = (new Date(dueAt).getTime() - Date.now()) / 1000 / 3600;
  if (hoursLeft < 72) return "high";
  if (hoursLeft < 168) return "medium";
  return type === "lab_report" ? "high" : "low";
}

function cleanSegment(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/^[・*●■◆★\-\d.)）(（\s]+/, "")
    .trim();
}

function splitLongLine(line: string) {
  if (line.length <= 140) {
    return [line];
  }

  return line
    .split(/[。！？!?]/)
    .map(cleanSegment)
    .filter(Boolean);
}

function splitIntoSegments(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[•●■◆★]/g, "\n")
    .replace(/([。！？!?])\s*/g, "$1\n")
    .split("\n")
    .flatMap((line) => splitLongLine(cleanSegment(line)))
    .filter((line) => line.length > 0 && !noiseLinePattern.test(line));
}

function isCourseContextLine(line: string) {
  if (hasDueSignal(line) || /提出先|提出方法|提出場所|アップロード/.test(line)) {
    return false;
  }

  if (/^(?:科目名|授業名|講義名|コース|授業|科目|Course|Class)[:：]/i.test(line)) {
    return true;
  }

  if (!inferCourse(line) || line.length > 42) {
    return false;
  }

  return !/(課題|宿題|レポート|小テスト|テスト|試験|発表資料|プレゼン|提出物|締切|期限|提出|assignment|homework|report|quiz|exam|presentation)/i.test(
    line
  );
}

function isContinuationLine(line: string) {
  if (noiseLinePattern.test(line)) {
    return false;
  }

  return (
    hasDueSignal(line) ||
    hasTargetSignal(line) ||
    continuationSignalPattern.test(line) ||
    (/^[^\n]{4,90}$/.test(line) && !isCourseContextLine(line))
  );
}

function isEventDateFollowUpLine(line: string) {
  return (
    /^(?:発表|小テスト|テスト|試験)(?:は|が)/.test(line) &&
    hasDueSignal(line) &&
    !/(?:提出|課題|宿題|レポート|資料|スライド|原稿|作成|完成|アップロード)/.test(line)
  );
}

function looksLikeCourseAssignmentLine(line: string) {
  return Boolean(
    inferCourse(line) &&
      hasDueSignal(line) &&
      (hasTargetSignal(line) || /(?:Unit|Chapter|問題|課題|宿題|レポート|小テスト|発表資料)/i.test(line))
  );
}

function looksLikeNewAssignment(line: string, currentChunk: string) {
  if (isEventDateFollowUpLine(line)) {
    return false;
  }

  const chunkHasAssignment = hasAssignmentSignal(currentChunk) || looksLikeCourseAssignmentLine(currentChunk);
  const lineLooksLikeTitle =
    /^(?:課題名|タイトル|題目|テーマ|提出物|レポート名)[は:：]/i.test(line) ||
    (hasAssignmentSignal(line) && hasDueSignal(line)) ||
    looksLikeCourseAssignmentLine(line);

  return chunkHasAssignment && lineLooksLikeTitle;
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.replace(/\s+/g, "").toLowerCase().slice(0, 120);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return result;
}

function createExtractionChunks(rawText: string) {
  const segments = splitIntoSegments(rawText);
  const chunks: string[] = [];
  let context: string[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const line = segments[index];

    if (isCourseContextLine(line)) {
      context = [...context, line].slice(-2);
      continue;
    }

    if (!hasAssignmentSignal(line) && !hasDueSignal(line)) {
      if (
        line.length <= 48
        && /WebClass|Classroom|Moodle|LMS|manaba|授業|講義|科目|第\d+回|第?\d+章|Unit\s*\d+/i.test(line)
      ) {
        context = [...context, line].slice(-2);
      }
      continue;
    }

    const parts = [...context, line];
    context = [];

    for (let cursor = index + 1; cursor < segments.length && parts.length < 7; cursor += 1) {
      const nextLine = segments[cursor];
      const currentChunk = parts.join("\n");

      if (isCourseContextLine(nextLine) || looksLikeNewAssignment(nextLine, currentChunk)) {
        break;
      }

      if (!isContinuationLine(nextLine)) {
        break;
      }

      parts.push(nextLine);
      index = cursor;
    }

    chunks.push(parts.join("\n"));
  }

  if (chunks.length === 0) {
    const compact = rawText.trim();
    if (compact.length > 0 && compact.length <= 800 && (hasAssignmentSignal(compact) || hasDueSignal(compact))) {
      chunks.push(compact);
    }
  }

  return uniqueStrings(chunks);
}

function stripTitleNoise(text: string) {
  return normalizeLabelValue(text)
    .replace(/(?:^|\s)(?:締切|〆切|期限|提出期限|提出日|due)[は:：]?\s*[^、。\n]*/gi, " ")
    .replace(/(?:^|\s)(?:提出先|提出方法|提出場所)[は:：]?\s*[^、。\n]*/gi, " ")
    .replace(/20\d{2}[\/\-.年]\d{1,2}[\/\-.月]\d{1,2}日?(?:\D+\d{1,2}(?::\d{1,2})?)?/g, "")
    .replace(/\d{1,2}月\d{1,2}日?(?:\D+\d{1,2}(?::\d{1,2})?)?/g, "")
    .replace(/\d{1,2}\/\d{1,2}(?:\D+\d{1,2}(?::\d{1,2})?)?/g, "")
    .replace(/(?:再来週|来週|明後日|明日|今日)?[月火水木金土日](?:曜)?まで/g, "")
    .replace(/(?:再来週|来週|明後日|明日|今日)[^、。\n]*まで?/g, "")
    .replace(/(?:Google Classroom|Classroom|WebClass|Moodle|manaba|Teams|LMS|メール|教室)(?:へ|に)?/gi, "")
    .replace(/(?:までに?|提出してください|提出すること|提出|作成すること|解くこと)$/g, "")
    .replace(/^(?:課題名|課題|タイトル|題目|テーマ|提出物|内容)[は:：]\s*/i, "")
    .replace(/^(?:WebClass|LMS|Google Classroom|Classroom|Moodle|manaba)\s*/i, "")
    .replace(/(?:をに|をへ)/g, "を")
    .replace(/[をにへ、。\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenTitle(title: string) {
  return title.length > 56 ? `${title.slice(0, 56)}...` : title;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTitleCandidate(text: string, courseName: string | null) {
  const stripped = stripTitleNoise(text);
  if (!courseName) {
    return stripped;
  }

  return stripped.replace(new RegExp(`^${escapeRegExp(courseName)}[\\s:：-]*`), "").trim();
}

function titleFallback(courseName: string | null, assignmentType: AssignmentType) {
  const typeLabel =
    assignmentType === "lab_report"
      ? "実験レポート"
      : assignmentType === "report"
        ? "レポート"
        : assignmentType === "quiz"
          ? "小テスト"
          : assignmentType === "presentation"
            ? "発表資料"
            : assignmentType === "exam"
              ? "試験"
              : assignmentType === "homework"
                ? "宿題"
                : "課題";

  return [courseName, typeLabel].filter(Boolean).join(" ") || "新規課題";
}

function extractTitle(text: string, assignmentType: AssignmentType, courseName: string | null) {
  const labelMatch =
    text.match(
      /(?:課題名|タイトル|題目|テーマ|提出物|レポート名)[は:：]\s*([^\n。]{2,90}?)(?=\s+(?:締切|〆切|期限|提出期限|提出日|due|提出先|提出方法|提出場所)[は:：]|\n|。|$)/i
    ) ?? text.match(/(?:課題名|タイトル|題目|テーマ|提出物|レポート名)[は:：]\s*([^\n。]{2,90})/i);
  if (labelMatch?.[1]) {
    const title = cleanTitleCandidate(labelMatch[1], courseName);
    if (title.length >= 3) {
      return shortenTitle(title);
    }
  }

  const normalized = text.replace(/\n/g, " ");
  const typeMatch = normalized.match(/([^\n。]{2,70}(?:実験レポート|レポート|小テスト|宿題|発表資料|プレゼン|試験|課題|ワークシート))/i);
  if (typeMatch?.[1]) {
    const title = cleanTitleCandidate(typeMatch[1], courseName);
    if (title.length >= 3) {
      return shortenTitle(title);
    }
  }

  const submitMatch = normalized.match(/([^\n。]{4,90}?)(?:を)?(?:提出|作成|解く|完成)/);
  if (submitMatch?.[1]) {
    const title = cleanTitleCandidate(submitMatch[1], courseName);
    if (title.length >= 3 && !/^提出/.test(title)) {
      return shortenTitle(title);
    }
  }

  const firstMeaningfulLine = text
    .split("\n")
    .map((line) => cleanTitleCandidate(line, courseName))
    .find((line) => line.length >= 4 && !isCourseContextLine(line));

  if (firstMeaningfulLine) {
    return shortenTitle(firstMeaningfulLine);
  }

  return titleFallback(courseName, assignmentType);
}

function candidateKey(candidate: AiExtractionCandidate) {
  return [
    candidate.title.replace(/\s+/g, "").toLowerCase().slice(0, 40),
    (candidate.courseName ?? "").replace(/\s+/g, "").toLowerCase().slice(0, 32),
    candidate.dueAt ? candidate.dueAt.slice(0, 10) : "",
    candidate.assignmentType,
    (candidate.submissionTarget ?? "").replace(/\s+/g, "").toLowerCase().slice(0, 24)
  ].join("|");
}

function dedupeCandidates(candidates: AiExtractionCandidate[]) {
  const seen = new Set<string>();
  const result: AiExtractionCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function isLowInformationNoiseCandidate(text: string, courseName: string | null, dueAt: string | null, submissionTarget: string | null) {
  if (courseName || dueAt || submissionTarget) {
    return false;
  }

  const hasSpecificTaskSignal =
    /(?:課題名|レポート|宿題|小テスト|テスト|試験|発表資料|プレゼン|提出|Unit|Chapter|問\d+|ワークシート|演習)/i.test(text);
  const hasGenericTaskWordOnly = /課題/.test(text) && !hasSpecificTaskSignal;

  if (hasGenericTaskWordOnly) {
    return true;
  }

  return !hasSpecificTaskSignal;
}

function buildCandidate(rawText: string): AiExtractionCandidate | null {
  const text = rawText.trim();
  if (!text) return null;

  const dueAt = normalizeDate(text);
  const assignmentType = inferType(text);
  const isHeavy = assignmentType === "lab_report" || /重い|大変|長い|資料も必要|考察|グラフ/.test(text);
  const tags: AssignmentTag[] = [];
  if (isHeavy) tags.push("heavy");
  if (/すぐ|短い|quick|5分|10分|確認だけ/.test(text)) tags.push("quick");

  const courseName = inferCourse(text);
  const submissionTarget = inferTarget(text);
  if (isLowInformationNoiseCandidate(text, courseName, dueAt, submissionTarget)) {
    return null;
  }

  const title = extractTitle(text, assignmentType, courseName);
  const estimatedHours = suggestEstimatedHours(assignmentType, isHeavy);
  const priorityLabel = inferPriority(assignmentType, dueAt);

  const suggestedSubtasks =
    assignmentType === "lab_report"
      ? ["実験条件の整理", "データ整形", "考察作成", "体裁チェック"]
      : assignmentType === "presentation"
        ? ["構成を決める", "スライド作成", "発表練習"]
        : assignmentType === "quiz" || assignmentType === "exam"
          ? ["範囲確認", "重要ポイント整理", "問題演習", "提出前チェック"]
          : ["要件確認", "一次ドラフト作成", "提出前チェック"];

  const studyPlan = [
    "今日: 10-20分で要件確認とタスク分割",
    "締切2日前: 本文または資料を完成",
    "締切前日: 最終チェックして提出"
  ];

  if (courseName && /数学/.test(courseName)) {
    studyPlan.push("数学系は苦手補正: 予習15分 + 復習20分を追加");
  }

  const confidence =
    dueAt && courseName && hasAssignmentSignal(text)
      ? 0.84
      : dueAt && hasAssignmentSignal(text)
        ? 0.78
        : dueAt
          ? 0.68
          : 0.58;

  return {
    title,
    courseName,
    dueAt,
    submissionTarget,
    assignmentType,
    memo: text,
    priorityLabel,
    estimatedHours,
    isHeavy,
    tags,
    confidence,
    suggestedSubtasks,
    studyPlan
  };
}

export class HeuristicAssignmentExtractor implements AssignmentExtractor {
  async extract(input: ExtractorInput): Promise<AiExtractionResult> {
    const chunks = createExtractionChunks(input.text);
    const candidates = dedupeCandidates(
      chunks
        .map((chunk) => buildCandidate(chunk))
        .filter((value): value is AiExtractionCandidate => Boolean(value))
    ).slice(0, MAX_CANDIDATES);

    const isLongText = input.text.length >= 600 || chunks.length >= 3;

    return {
      summary:
        candidates.length > 0
          ? isLongText
            ? `長文から${candidates.length}件の課題候補を抽出しました。保存前に締切・授業名を確認してください。`
            : `${candidates.length}件の課題候補を抽出しました。保存前に締切・授業名を確認してください。`
          : "課題候補を抽出できませんでした。手動入力に切り替えて保存できます。",
      candidates,
      rawText: input.text
    };
  }
}
