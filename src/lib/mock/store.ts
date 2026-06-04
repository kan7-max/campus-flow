import { addDays, setHours, setMinutes } from "date-fns";
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_NOTIFICATION_TIMING, DEFAULT_PRIORITY_WEIGHTS } from "@/lib/constants/domain";
import type {
  Assignment,
  AssignmentStep,
  AiCreditBalance,
  AiUsageLog,
  CalendarSyncRecord,
  Course,
  InboxItem,
  NotificationRecord,
  StudyBlock,
  Subtask,
  UserSettings
} from "@/lib/types/domain";
import type { SyncOutboxJob } from "@/lib/repositories/syncOutboxRepository";
import type { WorkSession } from "@/lib/repositories/workSessionRepository";

type MockStore = {
  assignments: Assignment[];
  courses: Course[];
  subtasks: Subtask[];
  assignmentSteps: AssignmentStep[];
  notifications: NotificationRecord[];
  syncOutbox: SyncOutboxJob[];
  studyBlocks: StudyBlock[];
  workSessions: WorkSession[];
  inboxItems: InboxItem[];
  calendarRecords: CalendarSyncRecord[];
  settings: Record<string, UserSettings>;
  pushSubscriptions: Array<{
    id: string;
    userId: string;
    subscription: unknown;
    createdAt: string;
    updatedAt: string;
  }>;
  googleTokens: Record<
    string,
    {
      accessToken: string | null;
      refreshToken: string | null;
      expiry: string | null;
    }
  >;
  aiLogs: Array<{
    id: string;
    userId: string;
    sourceType: string;
    sourceText: string;
    extractedJson: unknown;
    confidenceAvg: number | null;
    createdAt: string;
  }>;
  aiUsageLogs: AiUsageLog[];
  aiCreditBalances: AiCreditBalance[];
};

const globalStoreKey = "__campus_taskflow_store";
const persistedStorePath = path.join(process.cwd(), ".taskflow-demo-store.json");
const persistedLatestStorePath = path.join(process.cwd(), ".taskflow-demo-store.latest.json");
const DEMO_PERSIST_DEBOUNCE_MS = 300;

let persistTimer: NodeJS.Timeout | null = null;
let queuedPersistStore: MockStore | null = null;
let persistHookRegistered = false;

function makeIso(dayOffset: number, hour: number, minute: number) {
  const base = addDays(new Date(), dayOffset);
  return setMinutes(setHours(base, hour), minute).toISOString();
}

function seedStore(): MockStore {
  const userId = "demo-user";

  const courses: Course[] = [
    {
      id: crypto.randomUUID(),
      userId,
      name: "電磁気学",
      dayOfWeek: "Tue",
      startTime: "10:40",
      endTime: "12:10",
      room: "A201",
      instructor: "田中教授",
      color: "#38bdf8",
      memo: "毎週ミニ課題あり",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      userId,
      name: "応用数学",
      dayOfWeek: "Mon",
      startTime: "13:00",
      endTime: "14:30",
      room: "B102",
      instructor: "佐藤教授",
      color: "#60a5fa",
      memo: "苦手科目",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      userId,
      name: "英語プレゼン",
      dayOfWeek: "Thu",
      startTime: "09:00",
      endTime: "10:30",
      room: "Online",
      instructor: "Ms. Clark",
      color: "#14b8a6",
      memo: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const assignments: Assignment[] = [
    {
      id: crypto.randomUUID(),
      userId,
      courseId: courses[0].id,
      title: "オームの法則 実験レポート",
      dueAt: makeIso(2, 23, 59),
      submissionTarget: "LMS",
      assignmentType: "lab_report",
      memo: "測定値と考察を必ず含める",
      priorityLabel: "high",
      priorityScore: 88,
      progress: 25,
      status: "in_progress",
      url: null,
      estimatedHours: 5,
      aiSourceText: "金曜に実験レポート提出",
      aiConfidence: 0.91,
      isHeavy: true,
      tags: ["heavy"],
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      course: courses[0]
    },
    {
      id: crypto.randomUUID(),
      userId,
      courseId: courses[1].id,
      title: "微分方程式 小テスト対策",
      dueAt: makeIso(4, 9, 0),
      submissionTarget: "教室",
      assignmentType: "quiz",
      memo: "範囲: 1階線形微分方程式",
      priorityLabel: "high",
      priorityScore: 82,
      progress: 0,
      status: "todo",
      url: null,
      estimatedHours: 3,
      aiSourceText: null,
      aiConfidence: null,
      isHeavy: false,
      tags: [],
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      course: courses[1]
    },
    {
      id: crypto.randomUUID(),
      userId,
      courseId: courses[2].id,
      title: "英語発表資料作成",
      dueAt: makeIso(6, 17, 0),
      submissionTarget: "Google Classroom",
      assignmentType: "presentation",
      memo: "5分発表、スライド10枚以内",
      priorityLabel: "medium",
      priorityScore: 63,
      progress: 50,
      status: "in_progress",
      url: null,
      estimatedHours: 2,
      aiSourceText: null,
      aiConfidence: null,
      isHeavy: false,
      tags: ["quick"],
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      course: courses[2]
    }
  ];

  const settings: Record<string, UserSettings> = {
    [userId]: {
      userId,
      displayName: "デモ学生",
      onboardingCompleted: false,
      timezone: "Asia/Tokyo",
      theme: "dark",
      preferredAvailableMinutes: 60,
      preferredTodayMode: "normal",
      aiEnabled: true,
      googleCalendarEnabled: false,
      setupCourseNames: courses.map((course) => course.name),
      priorityWeights: DEFAULT_PRIORITY_WEIGHTS,
      notificationConfig: {
        ...DEFAULT_NOTIFICATION_TIMING,
        email: true,
        webPush: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  return {
    assignments,
    courses,
    subtasks: [],
    assignmentSteps: [],
    notifications: [],
    syncOutbox: [],
    studyBlocks: [],
    workSessions: [],
    inboxItems: [],
    calendarRecords: [],
    settings,
    pushSubscriptions: [],
    googleTokens: {},
    aiLogs: [],
    aiUsageLogs: [],
    aiCreditBalances: []
  };
}

function normalizeStore(store: MockStore): MockStore {
  store.subtasks ??= [];
  store.assignmentSteps ??= [];
  store.notifications ??= [];
  store.syncOutbox ??= [];
  store.studyBlocks ??= [];
  store.workSessions ??= [];
  store.inboxItems ??= [];
  store.calendarRecords ??= [];
  store.pushSubscriptions ??= [];
  store.googleTokens ??= {};
  store.aiLogs ??= [];
  store.aiUsageLogs ??= [];
  store.aiCreditBalances ??= [];

  return store;
}

function readStoreFile(filePath: string): MockStore | null {
  try {
    return normalizeStore(JSON.parse(readFileSync(filePath, "utf8")) as MockStore);
  } catch (error) {
    console.warn(`Failed to read demo store file: ${filePath}`, error);
    return null;
  }
}

function readPersistedStore(): MockStore | null {
  const candidates = [persistedStorePath, persistedLatestStorePath]
    .filter((filePath) => existsSync(filePath))
    .sort((left, right) => {
      try {
        return statSync(right).mtimeMs - statSync(left).mtimeMs;
      } catch {
        return 0;
      }
    });

  for (const filePath of candidates) {
    const parsed = readStoreFile(filePath);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export function getMockStore(): MockStore {
  const unknownGlobal = globalThis as typeof globalThis & Record<string, unknown>;

  if (unknownGlobal[globalStoreKey]) {
    return normalizeStore(unknownGlobal[globalStoreKey] as MockStore);
  }

  const persisted = readPersistedStore();
  if (persisted) {
    unknownGlobal[globalStoreKey] = persisted;
    return persisted;
  }

  unknownGlobal[globalStoreKey] = seedStore();
  return normalizeStore(unknownGlobal[globalStoreKey] as MockStore);
}

function writePersistedSnapshot(target: MockStore) {
  const payload = JSON.stringify(normalizeStore(target), null, 2);
  const tempPath = `${persistedStorePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, payload, "utf8");
  try {
    renameSync(tempPath, persistedStorePath);
  } catch (error) {
    // OneDrive can briefly lock the JSON file and reject atomic rename. Demo mode should still keep working.
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Atomic demo store write failed. Writing latest snapshot file instead. ${reason}`);
    try {
      writeFileSync(persistedLatestStorePath, payload, "utf8");
    } catch {
      console.warn("Failed to write latest demo snapshot file.");
    }
    try {
      unlinkSync(tempPath);
    } catch {
      // Leaving a temp file is less harmful than failing the user-facing save.
    }
  }
}

function flushPersistQueue() {
  const target = queuedPersistStore;
  if (!target) {
    return;
  }

  queuedPersistStore = null;
  writePersistedSnapshot(target);
}

export function persistMockStore(store?: MockStore) {
  const unknownGlobal = globalThis as typeof globalThis & Record<string, unknown>;
  const target = store ?? (unknownGlobal[globalStoreKey] as MockStore | undefined);

  if (!target) {
    return;
  }

  queuedPersistStore = normalizeStore(target);

  if (!persistHookRegistered) {
    persistHookRegistered = true;
    process.once("beforeExit", () => {
      try {
        flushPersistQueue();
      } catch {
        // noop
      }
    });
  }

  if (persistTimer) {
    return;
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    flushPersistQueue();
  }, DEMO_PERSIST_DEBOUNCE_MS);
}
