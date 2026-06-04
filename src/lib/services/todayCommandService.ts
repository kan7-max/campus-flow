import { compareAsc, differenceInCalendarDays, isBefore, parseISO, startOfDay } from "date-fns";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { listAssignmentSteps } from "@/lib/repositories/assignmentStepRepository";
import { listCourses } from "@/lib/repositories/courseRepository";
import { countOpenInboxItems } from "@/lib/repositories/inboxItemRepository";
import { getOrCreateTodayStudyPlan, type StudyPlanData } from "@/lib/services/studyBlockPlanningService";
import { buildTodayTimelineItems, type TimelineItem } from "@/lib/services/timelineService";
import type { Assignment, Course, Weekday } from "@/lib/types/domain";

export type TodayCommandRisk = "critical" | "high" | "medium" | "low";
export type TodayAvailableMinutes = 15 | 30 | 60 | 120 | 180;
export type TodayMode = "busy" | "exam" | "low_energy" | "normal";

export type TodayCommandPreferences = {
  availableMinutes: TodayAvailableMinutes;
  mode: TodayMode;
};

export type TodayCommandItem = {
  assignment: Assignment;
  dueInDays: number;
  nextAction: string;
  rank: number;
  reason: string;
  remainingHours: number;
  risk: TodayCommandRisk;
  suggestedAction: string;
  urgencyScore: number;
};

export type TodayConfirmationItem = {
  assignment: Assignment;
  reason: string;
  severity: "high" | "medium" | "low";
};

export type TodayPlanSlot = {
  label: string;
  detail: string;
  item: TodayCommandItem | null;
};

export type TodayCommandCenterData = {
  briefing: string;
  confirmationItems: TodayConfirmationItem[];
  focusQueue: TodayCommandItem[];
  heavyLifts: TodayCommandItem[];
  planSlots: TodayPlanSlot[];
  preferences: TodayCommandPreferences;
  quickWins: TodayCommandItem[];
  recentCaptures: TodayCommandItem[];
  studyPlan: StudyPlanData;
  stats: {
    classesToday: number;
    confirmationNeeded: number;
    dueToday: number;
    highRisk: number;
    incomplete: number;
    inboxOpen: number;
    overdue: number;
    quickWins: number;
  };
  timelineItems: TimelineItem[];
  todaysCourses: Course[];
};

const weekdays: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultPreferences: TodayCommandPreferences = {
  availableMinutes: 60,
  mode: "normal"
};

function getTodayWeekday(date: Date): Weekday {
  return weekdays[date.getDay()];
}

function roundHalf(value: number) {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function getRemainingHours(assignment: Assignment) {
  const remainingRatio = Math.max(0, 100 - assignment.progress) / 100;
  return roundHalf((assignment.estimatedHours || 1) * remainingRatio);
}

function getRecentlyCapturedBoost(assignment: Assignment, now: Date, hoursUntilDue: number) {
  const ageHours = getAssignmentAgeHours(assignment, now);

  if (ageHours === null || ageHours < 0 || ageHours > 24) {
    return 0;
  }

  let boost = 0;

  if (hoursUntilDue <= 24) {
    boost += 120;
  } else if (hoursUntilDue <= 72) {
    boost += 80;
  } else if (hoursUntilDue <= 168) {
    boost += 35;
  }

  if (assignment.aiSourceText) {
    boost += 20;
  }

  return boost;
}

function getAssignmentAgeHours(assignment: Assignment, now: Date) {
  const createdAt = parseISO(assignment.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return ageHours;
}

function isRecentCapture(item: TodayCommandItem, now: Date) {
  const ageHours = getAssignmentAgeHours(item.assignment, now);

  return ageHours !== null && ageHours >= 0 && ageHours <= 24 && item.dueInDays <= 3;
}

function getUrgencyScore(assignment: Assignment, now: Date, mode: TodayMode) {
  const due = parseISO(assignment.dueAt);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  const remainingHours = getRemainingHours(assignment);

  let score = assignment.priorityScore + remainingHours * 10 + (100 - assignment.progress) * 0.35;
  score += getRecentlyCapturedBoost(assignment, now, hoursUntilDue);

  if (hoursUntilDue < 0) {
    score += 420;
  } else if (hoursUntilDue <= 8) {
    score += 330;
  } else if (hoursUntilDue <= 24) {
    score += 260;
  } else if (hoursUntilDue <= 72) {
    score += 155;
  } else if (hoursUntilDue <= 168) {
    score += 80;
  }

  if (assignment.isHeavy) {
    score += 35;
  }

  if (assignment.status === "todo") {
    score += 18;
  }

  if (mode === "exam" && (assignment.assignmentType === "exam" || assignment.assignmentType === "quiz")) {
    score += 95;
  }

  if (mode === "busy") {
    if (hoursUntilDue <= 24) score += 80;
    if (remainingHours <= 1.5 || assignment.tags.includes("quick")) score += 35;
    if (remainingHours >= 4 && hoursUntilDue > 72) score -= 25;
  }

  if (mode === "low_energy") {
    if (remainingHours <= 1.5 || assignment.tags.includes("quick") || assignment.progress >= 50) score += 55;
    if (remainingHours >= 4 && hoursUntilDue > 24) score -= 35;
  }

  return Math.round(score);
}

function getRisk(score: number, dueInDays: number): TodayCommandRisk {
  if (dueInDays < 0 || score >= 420) {
    return "critical";
  }

  if (dueInDays === 0 || score >= 300) {
    return "high";
  }

  if (dueInDays <= 3 || score >= 220) {
    return "medium";
  }

  return "low";
}

function getReason(assignment: Assignment, dueInDays: number, remainingHours: number) {
  if (dueInDays < 0) {
    return `期限超過 ${Math.abs(dueInDays)}日`;
  }

  if (dueInDays === 0) {
    return "今日締切";
  }

  if (dueInDays === 1) {
    return "明日締切";
  }

  if (remainingHours >= 4) {
    return `残り約${remainingHours}h`;
  }

  if (assignment.tags.includes("quick") || remainingHours <= 1.5) {
    return "すぐ進められる";
  }

  return `${dueInDays}日後締切`;
}

function getSuggestedAction(
  assignment: Assignment,
  dueInDays: number,
  remainingHours: number,
  preferences: TodayCommandPreferences
) {
  if (preferences.mode === "low_energy") {
    if (dueInDays <= 0) {
      return "5分だけ開いて、提出までに必要な残り作業を1つ書き出す";
    }
    return "完了を狙わず、5分で次にやる1つだけ確認する";
  }

  if (preferences.mode === "busy" || preferences.availableMinutes <= 30) {
    if (dueInDays <= 0) {
      return "提出条件を確認して、今すぐ必要な1手だけ進める";
    }
    return "15分で着手状態にして、残りは後で戻れる形にする";
  }

  if (preferences.mode === "exam" && (assignment.assignmentType === "exam" || assignment.assignmentType === "quiz")) {
    return "出題範囲を確認して、例題を1セットだけ解く";
  }

  if (assignment.progress >= 75) {
    return "提出条件を確認して完了まで進める";
  }

  if (dueInDays <= 0) {
    return "25分だけ着手して提出までの残りを確定";
  }

  if (assignment.status === "todo") {
    return "最初の25分で着手状態にする";
  }

  if (assignment.isHeavy || remainingHours >= 4) {
    return "資料集め・下書き・清書に分けて進める";
  }

  return "次のすき間時間で25%進める";
}

function getFallbackNextAction(assignment: Assignment) {
  switch (assignment.assignmentType) {
    case "lab_report":
      return "データ・グラフを確認する";
    case "report":
      return "課題内容を確認する";
    case "quiz":
    case "exam":
      return "範囲を確認する";
    case "presentation":
      return "原稿・資料を確認する";
    case "homework":
      return "問題を確認する";
    default:
      return "内容を確認する";
  }
}

async function getNextAction(userId: string, assignment: Assignment) {
  const fallback = getFallbackNextAction(assignment);

  try {
    const steps = await listAssignmentSteps(userId, assignment.id);
    const nextStep = steps.find((step) => step.status !== "done");
    return nextStep?.title ?? fallback;
  } catch (error) {
    console.error("Failed to load next assignment step", error);
    return fallback;
  }
}

function getConfirmationReason(assignment: Assignment): TodayConfirmationItem | null {
  if (assignment.status === "done") {
    return null;
  }

  if (assignment.aiConfidence !== null && assignment.aiConfidence < 0.6) {
    return {
      assignment,
      reason: "AI抽出の信頼度が低めです。課題名・締切・提出先を確認してください。",
      severity: "high"
    };
  }

  const source = [assignment.memo, assignment.aiSourceText].filter(Boolean).join(" ");
  if (/次回授業|授業前|未定|要確認|確認|かも|提出不要|不要の可能性|締切不明/.test(source)) {
    return {
      assignment,
      reason: "入力文に確認が必要そうな表現があります。締切や提出要否を見直してください。",
      severity: "medium"
    };
  }

  if (!assignment.submissionTarget) {
    return {
      assignment,
      reason: "提出先が未設定です。LMS・教室提出・メール提出などを確認してください。",
      severity: "low"
    };
  }

  return null;
}

function toCommandItem(
  assignment: Assignment,
  now: Date,
  todayStart: Date,
  rank: number,
  preferences: TodayCommandPreferences
): TodayCommandItem {
  const due = parseISO(assignment.dueAt);
  const dueInDays = differenceInCalendarDays(startOfDay(due), todayStart);
  const remainingHours = getRemainingHours(assignment);
  const urgencyScore = getUrgencyScore(assignment, now, preferences.mode);

  return {
    assignment,
    dueInDays,
    nextAction: getFallbackNextAction(assignment),
    rank,
    reason: getReason(assignment, dueInDays, remainingHours),
    remainingHours,
    risk: getRisk(urgencyScore, dueInDays),
    suggestedAction: getSuggestedAction(assignment, dueInDays, remainingHours, preferences),
    urgencyScore
  };
}

function sortCommandItems(a: TodayCommandItem, b: TodayCommandItem) {
  if (b.urgencyScore !== a.urgencyScore) {
    return b.urgencyScore - a.urgencyScore;
  }

  return compareAsc(parseISO(a.assignment.dueAt), parseISO(b.assignment.dueAt));
}

function rankItems(items: TodayCommandItem[]) {
  return items.map((item, index) => ({ ...item, rank: index + 1 }));
}

function getBriefing(
  stats: TodayCommandCenterData["stats"],
  focusQueue: TodayCommandItem[],
  studyPlan: StudyPlanData,
  preferences: TodayCommandPreferences
) {
  if (preferences.mode === "low_energy" && focusQueue[0]) {
    return `今日は最低限でOKです。「${focusQueue[0].assignment.title}」を5分だけ開いて、次にやる1つを確認しましょう。`;
  }

  if (preferences.mode === "busy" && focusQueue[0]) {
    return `今日は${preferences.availableMinutes}分想定です。「${focusQueue[0].assignment.title}」の最初の1手だけ進めて、残りは後で戻れる形にしましょう。`;
  }

  if (preferences.mode === "exam" && focusQueue[0]) {
    return `試験前モードです。まず「${focusQueue[0].assignment.title}」で、範囲確認か例題1セットに集中しましょう。`;
  }

  if (studyPlan.nextBlock) {
    return `今日は「${studyPlan.nextBlock.title}」から始めるのが良さそうです。${studyPlan.nextBlock.description ?? "25分だけ進めましょう。"}`;
  }

  if (stats.overdue > 0) {
    return `期限超過が${stats.overdue}件あります。まず最上位の課題を25分進めて、提出までの残り作業を確定しましょう。`;
  }

  if (stats.dueToday > 0) {
    return `今日締切が${stats.dueToday}件あります。新しい課題を増やす前に、提出可能な状態まで持っていきましょう。`;
  }

  if (focusQueue[0]) {
    return `今日は「${focusQueue[0].assignment.title}」から始めるのが良さそうです。${focusQueue[0].suggestedAction}`;
  }

  return "今日の必須タスクは落ち着いています。軽い復習や次の締切の前倒しに使えます。";
}

function makePlanSlots(
  focusQueue: TodayCommandItem[],
  quickWins: TodayCommandItem[],
  heavyLifts: TodayCommandItem[],
  preferences: TodayCommandPreferences
) {
  if (preferences.mode === "low_energy") {
    return [
      {
        label: "最初の5分",
        detail: focusQueue[0]?.suggestedAction ?? "Inboxや授業メモを1つだけ確認する",
        item: focusQueue[0] ?? null
      },
      {
        label: "できたら追加",
        detail: quickWins[0] ? "短く終わるものだけ触る" : "明日の自分が迷わないメモを残す",
        item: quickWins[0] ?? focusQueue[1] ?? null
      },
      {
        label: "今日はここまで",
        detail: "重い課題は分解だけで十分。完了まで狙わない",
        item: heavyLifts[0] ?? null
      }
    ];
  }

  if (preferences.mode === "busy" || preferences.availableMinutes <= 30) {
    return [
      {
        label: "最低限",
        detail: focusQueue[0]?.suggestedAction ?? "未整理メモを1つInboxに残す",
        item: focusQueue[0] ?? null
      },
      {
        label: "余った時間",
        detail: quickWins[0] ? "短時間で進む課題だけ処理" : "次の締切を確認",
        item: quickWins[0] ?? focusQueue[1] ?? null
      },
      {
        label: "明日に回す",
        detail: "まとまった作業は無理に詰め込まず、次の作業ブロックへ",
        item: heavyLifts[0] ?? null
      }
    ];
  }

  return [
    {
      label: "最初の25分",
      detail: focusQueue[0]?.suggestedAction ?? "未完了課題がないので、授業メモの整理に使えます。",
      item: focusQueue[0] ?? null
    },
    {
      label: "すき間時間",
      detail: quickWins[0] ? "短時間で進捗を作れる課題を片付ける" : "小さな確認作業を先に終える",
      item: quickWins[0] ?? focusQueue[1] ?? null
    },
    {
      label: "まとまった時間",
      detail: heavyLifts[0] ? "重い課題を分割して、次に進める状態まで持っていく" : "次の締切を前倒しで進める",
      item: heavyLifts[0] ?? focusQueue[2] ?? null
    }
  ];
}

function limitFocusQueue(items: TodayCommandItem[], preferences: TodayCommandPreferences) {
  if (preferences.mode === "low_energy" || preferences.availableMinutes <= 15) {
    return items.slice(0, 1);
  }

  if (preferences.mode === "busy" || preferences.availableMinutes <= 30) {
    return items.slice(0, 2);
  }

  return items.slice(0, 3);
}

export async function getTodayCommandCenter(
  userId: string,
  preferences: Partial<TodayCommandPreferences> = {}
): Promise<TodayCommandCenterData> {
  const resolvedPreferences: TodayCommandPreferences = {
    availableMinutes: preferences.availableMinutes ?? defaultPreferences.availableMinutes,
    mode: preferences.mode ?? defaultPreferences.mode
  };

  const [assignments, courses, inboxOpen] = await Promise.all([
    listAssignments(userId, { sortBy: "due" }),
    listCourses(userId),
    countOpenInboxItems(userId)
  ]);

  const now = new Date();
  const todayStart = startOfDay(now);
  const incomplete = assignments.filter((assignment) => assignment.status !== "done");

  const commandItems = rankItems(
    await Promise.all(
      incomplete
        .map((assignment) => toCommandItem(assignment, now, todayStart, 0, resolvedPreferences))
        .sort(sortCommandItems)
        .map(async (item) => ({
          ...item,
          nextAction: await getNextAction(userId, item.assignment)
        }))
    )
  );

  const focusQueue = limitFocusQueue(commandItems, resolvedPreferences);
  const recentCaptures = commandItems.filter((item) => isRecentCapture(item, now)).slice(0, 3);
  const quickWins = commandItems
    .filter((item) => {
      const assignment = item.assignment;
      return (
        item.remainingHours <= 2 ||
        assignment.tags.includes("quick") ||
        assignment.progress >= 50 ||
        assignment.assignmentType === "quiz" ||
        assignment.assignmentType === "homework"
      );
    })
    .slice(0, 4);
  const heavyLifts = commandItems
    .filter((item) => item.assignment.isHeavy || item.remainingHours >= 3 || item.assignment.priorityLabel === "high")
    .slice(0, 4);

  const todaysCourses = courses
    .filter((course) => course.dayOfWeek === getTodayWeekday(now))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const confirmationItems = incomplete
    .map(getConfirmationReason)
    .filter((item): item is TodayConfirmationItem => Boolean(item))
    .sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[b.severity] !== severityOrder[a.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return compareAsc(parseISO(a.assignment.dueAt), parseISO(b.assignment.dueAt));
    })
    .slice(0, 5);

  const stats = {
    classesToday: todaysCourses.length,
    confirmationNeeded: confirmationItems.length,
    dueToday: commandItems.filter((item) => item.dueInDays === 0).length,
    highRisk: commandItems.filter((item) => item.risk === "critical" || item.risk === "high").length,
    incomplete: incomplete.length,
    inboxOpen,
    overdue: commandItems.filter((item) => isBefore(parseISO(item.assignment.dueAt), now)).length,
    quickWins: quickWins.length
  };

  const studyPlan = await getOrCreateTodayStudyPlan({
    userId,
    assignments,
    courses,
    date: now
  });

  const timelineItems = buildTodayTimelineItems({
    assignments,
    courses: todaysCourses,
    date: now,
    studyBlocks: studyPlan.blocks
  });

  return {
    briefing: getBriefing(stats, focusQueue, studyPlan, resolvedPreferences),
    confirmationItems,
    focusQueue,
    heavyLifts,
    planSlots: makePlanSlots(focusQueue, quickWins, heavyLifts, resolvedPreferences),
    preferences: resolvedPreferences,
    quickWins,
    recentCaptures,
    studyPlan,
    stats,
    timelineItems,
    todaysCourses
  };
}
