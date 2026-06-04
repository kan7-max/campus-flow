import { differenceInHours, parseISO } from "date-fns";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants/domain";
import type { AssignmentType, PriorityLabel, UserSettings } from "@/lib/types/domain";

type PriorityInput = {
  dueAt: string;
  assignmentType: AssignmentType;
  isHeavy: boolean;
  estimatedHours: number;
  progress: number;
  courseName?: string | null;
  title?: string;
};

const typeBaseScore: Record<AssignmentType, number> = {
  report: 62,
  quiz: 55,
  homework: 48,
  presentation: 58,
  lab_report: 72,
  exam: 76,
  other: 45
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scoreToLabel(score: number): PriorityLabel {
  if (score >= 70) {
    return "high";
  }
  if (score >= 44) {
    return "medium";
  }
  return "low";
}

export function calculatePriorityScore(input: PriorityInput, settings: UserSettings) {
  const weights = settings.priorityWeights;

  const hoursLeft = differenceInHours(parseISO(input.dueAt), new Date());
  const dueScore = clamp(100 - hoursLeft / 1.6, 8, 100);

  const assignmentTypeScore = typeBaseScore[input.assignmentType];
  const heavyScore = input.isHeavy || input.assignmentType === "lab_report" ? 90 : 35;
  const estimatedHoursScore = clamp((input.estimatedHours / 8) * 100, 20, 100);
  const progressScore = clamp(100 - input.progress, 0, 100);

  const weakSubjectMatch = [input.courseName, input.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .match(/math|mathematics|線形代数|微分方程式|統計|解析/);

  const weakSubjectScore = weakSubjectMatch ? 85 : 40;

  const score =
    dueScore * weights.dueSoonWeight +
    assignmentTypeScore * weights.assignmentTypeWeight +
    heavyScore * weights.heavyWeight +
    estimatedHoursScore * weights.estimatedHoursWeight +
    progressScore * weights.progressWeight +
    weakSubjectScore * weights.weakSubjectWeight;

  const rounded = Math.round(clamp(score, 0, 100));

  return {
    score: rounded,
    label: scoreToLabel(rounded),
    reason: [
      `締切緊急度:${Math.round(dueScore)}`,
      `課題種別(${ASSIGNMENT_TYPE_LABELS[input.assignmentType]}):${assignmentTypeScore}`,
      `重さ:${Math.round(heavyScore)}`,
      `進捗残:${Math.round(progressScore)}`
    ].join(" / ")
  };
}

export function suggestEstimatedHours(assignmentType: AssignmentType, isHeavy: boolean) {
  const base = {
    report: 3,
    quiz: 2,
    homework: 1,
    presentation: 3,
    lab_report: 5,
    exam: 4,
    other: 2
  } as const;

  const hours = base[assignmentType] + (isHeavy ? 1 : 0);
  return clamp(hours, 1, 12);
}
