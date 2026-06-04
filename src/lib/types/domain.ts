import type {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_TAGS,
  ASSIGNMENT_TYPES,
  PRIORITY_LABELS,
  PROGRESS_VALUES,
  WEEKDAYS
} from "@/lib/constants/domain";

export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];
export type AssignmentTag = (typeof ASSIGNMENT_TAGS)[number];
export type PriorityLabel = (typeof PRIORITY_LABELS)[number];
export type ProgressValue = (typeof PROGRESS_VALUES)[number];
export type Weekday = (typeof WEEKDAYS)[number];
export type StudyBlockStatus = "planned" | "started" | "completed" | "skipped" | "rescheduled";
export type StudyBlockSource = "rule_based" | "ai_generated" | "manual";
export type AssignmentStepStatus = "todo" | "done";
export type InboxSourceType = "manual_text" | "webclass_text" | "screenshot" | "pdf" | "file" | "ai_input";
export type InboxStatus = "unprocessed" | "parsed" | "saved" | "ignored" | "failed";
export type AiUsageFeature =
  | "assignment_extract"
  | "daily_strategy_generate"
  | "file_text_extract"
  | "inbox_parse"
  | "step_generate"
  | "study_plan_generate";
export type AiUsageStatus = "failed" | "fallback" | "success";
export type AiCreditPlan = "free" | "plus" | "pro";

export type UserSettings = {
  userId: string;
  displayName: string | null;
  onboardingCompleted: boolean;
  timezone: string;
  theme: "dark" | "light" | "system";
  preferredAvailableMinutes: 15 | 30 | 60 | 120 | 180;
  preferredTodayMode: "busy" | "exam" | "low_energy" | "normal";
  aiEnabled: boolean;
  googleCalendarEnabled: boolean;
  setupCourseNames: string[];
  priorityWeights: {
    dueSoonWeight: number;
    assignmentTypeWeight: number;
    heavyWeight: number;
    estimatedHoursWeight: number;
    progressWeight: number;
    weakSubjectWeight: number;
  };
  notificationConfig: {
    email: boolean;
    webPush: boolean;
    oneWeek: boolean;
    threeDays: boolean;
    oneDay: boolean;
    sameDayMorning: boolean;
    todayFreeTimeEnd?: string;
    todayFreeTimeNote?: string;
    todayFreeTimeStart?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type Course = {
  id: string;
  userId: string;
  name: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  room: string | null;
  instructor: string | null;
  color: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Subtask = {
  id: string;
  assignmentId: string;
  title: string;
  done: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentStep = {
  id: string;
  userId: string;
  assignmentId: string;
  title: string;
  description: string | null;
  status: AssignmentStepStatus;
  estimatedMinutes: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentStepInsertInput = {
  userId: string;
  assignmentId: string;
  title: string;
  description?: string | null;
  status?: AssignmentStepStatus;
  estimatedMinutes?: number;
  sortOrder?: number;
};

export type Attachment = {
  id: string;
  assignmentId: string;
  userId: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
};

export type CalendarSyncRecord = {
  id: string;
  assignmentId: string;
  userId: string;
  provider: "google";
  externalEventId: string | null;
  syncStatus: "pending" | "synced" | "failed";
  errorMessage: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InboxAssignmentCandidateOption = {
  title: string;
  courseName: string | null;
  dueAt: string | null;
  submissionTarget: string | null;
  assignmentType: AssignmentType;
  memo: string | null;
  estimatedHours: number;
  isHeavy: boolean;
  tags: AssignmentTag[];
  confidence: number;
  suggestedSubtasks: string[];
  warnings: string[];
};

export type InboxAssignmentCandidate = InboxAssignmentCandidateOption & {
  alternativeCandidates?: InboxAssignmentCandidateOption[];
  savedCandidateAssignmentIds?: Record<number, string>;
};

export type InboxItem = {
  id: string;
  userId: string;
  rawText: string;
  sourceType: InboxSourceType;
  status: InboxStatus;
  parsedPayload: InboxAssignmentCandidate | null;
  createdAssignmentId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InboxItemInsertInput = {
  userId: string;
  rawText: string;
  sourceType?: InboxSourceType;
  status?: InboxStatus;
  parsedPayload?: InboxAssignmentCandidate | null;
  errorMessage?: string | null;
};

export type AiUsageLog = {
  id: string;
  userId: string;
  feature: AiUsageFeature;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  creditsUsed: number;
  status: AiUsageStatus;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AiUsageLogInput = {
  userId: string;
  feature: AiUsageFeature;
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  creditsUsed?: number;
  status: AiUsageStatus;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type AiCreditBalance = {
  id: string;
  userId: string;
  monthKey: string;
  plan: AiCreditPlan;
  monthlyLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
  createdAt: string;
  updatedAt: string;
};

export type Assignment = {
  id: string;
  userId: string;
  courseId: string | null;
  title: string;
  dueAt: string;
  submissionTarget: string | null;
  assignmentType: AssignmentType;
  memo: string | null;
  priorityLabel: PriorityLabel;
  priorityScore: number;
  progress: ProgressValue;
  status: AssignmentStatus;
  url: string | null;
  estimatedHours: number;
  aiSourceText: string | null;
  aiConfidence: number | null;
  isHeavy: boolean;
  tags: AssignmentTag[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  course?: Course | null;
  subtasks?: Subtask[];
  attachments?: Attachment[];
  calendarSync?: CalendarSyncRecord | null;
};

export type StudyBlock = {
  id: string;
  userId: string;
  assignmentId: string | null;
  courseId: string | null;
  title: string;
  description: string | null;
  plannedDate: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  status: StudyBlockStatus;
  source: StudyBlockSource;
  priority: number;
  createdAt: string;
  updatedAt: string;
  assignment?: Assignment | null;
  course?: Course | null;
};

export type StudyBlockInsertInput = {
  userId: string;
  assignmentId?: string | null;
  courseId?: string | null;
  title: string;
  description?: string | null;
  plannedDate: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number;
  status?: StudyBlockStatus;
  source?: StudyBlockSource;
  priority?: number;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  assignmentId: string;
  channel: "email" | "web_push";
  notifyAt: string;
  deliveredAt: string | null;
  status: "queued" | "sent" | "failed";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssignmentFilter = {
  q?: string;
  courseId?: string;
  onlyIncomplete?: boolean;
  assignmentType?: AssignmentType | "all";
  tag?: AssignmentTag | "all";
  dueDate?: string;
  sortBy?: "due" | "priority" | "updated";
};

export type DashboardSummary = {
  totalIncomplete: number;
  dueTodayCount: number;
  overdueCount: number;
  highPriorityCount: number;
  heavyCount: number;
  todayItems: Assignment[];
  upcoming: Assignment[];
  courses: Array<{
    course: Course;
    incompleteCount: number;
    doneCount: number;
  }>;
};

export type AiExtractionCandidate = {
  title: string;
  courseName: string | null;
  dueAt: string | null;
  submissionTarget: string | null;
  assignmentType: AssignmentType;
  memo: string | null;
  priorityLabel: PriorityLabel;
  estimatedHours: number;
  isHeavy: boolean;
  tags: AssignmentTag[];
  confidence: number;
  suggestedSubtasks: string[];
  studyPlan: string[];
};

export type AiExtractionResult = {
  summary: string;
  candidates: AiExtractionCandidate[];
  rawText: string;
};

export type AssignmentUpsertInput = {
  id?: string;
  userId: string;
  courseId: string | null;
  title: string;
  dueAt: string;
  submissionTarget?: string | null;
  assignmentType: AssignmentType;
  memo?: string | null;
  priorityLabel?: PriorityLabel;
  priorityScore?: number;
  progress?: ProgressValue;
  status?: AssignmentStatus;
  url?: string | null;
  estimatedHours?: number;
  aiSourceText?: string | null;
  aiConfidence?: number | null;
  isHeavy?: boolean;
  tags?: AssignmentTag[];
  suggestedSubtasks?: string[];
};

export type CourseUpsertInput = {
  id?: string;
  userId: string;
  name: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  room?: string | null;
  instructor?: string | null;
  color?: string;
  memo?: string | null;
};
