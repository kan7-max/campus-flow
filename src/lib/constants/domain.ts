export const ASSIGNMENT_TYPES = [
  "report",
  "quiz",
  "homework",
  "presentation",
  "lab_report",
  "exam",
  "other"
] as const;

export const ASSIGNMENT_TYPE_LABELS: Record<(typeof ASSIGNMENT_TYPES)[number], string> = {
  report: "レポート",
  quiz: "小テスト",
  homework: "宿題",
  presentation: "発表準備",
  lab_report: "実験レポート",
  exam: "試験",
  other: "その他"
};

export const ASSIGNMENT_STATUS = ["todo", "in_progress", "done"] as const;

export const ASSIGNMENT_STATUS_LABELS: Record<(typeof ASSIGNMENT_STATUS)[number], string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了"
};

export const PRIORITY_LABELS = ["high", "medium", "low"] as const;

export const PRIORITY_TEXT: Record<(typeof PRIORITY_LABELS)[number], string> = {
  high: "高",
  medium: "中",
  low: "低"
};

export const ASSIGNMENT_TAGS = ["heavy", "quick"] as const;

export const ASSIGNMENT_TAG_TEXT: Record<(typeof ASSIGNMENT_TAGS)[number], string> = {
  heavy: "重い課題",
  quick: "すぐ終わる"
};

export const PROGRESS_VALUES = [0, 25, 50, 75, 100] as const;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEFAULT_PRIORITY_WEIGHTS = {
  dueSoonWeight: 0.35,
  assignmentTypeWeight: 0.2,
  heavyWeight: 0.16,
  estimatedHoursWeight: 0.12,
  progressWeight: 0.12,
  weakSubjectWeight: 0.05
};

export const SUBJECT_HINTS = {
  weakSubjects: ["math", "mathematics", "線形代数", "微分方程式", "統計", "解析"]
};

export const DEFAULT_NOTIFICATION_TIMING = {
  oneWeek: true,
  threeDays: true,
  oneDay: true,
  sameDayMorning: true
};
