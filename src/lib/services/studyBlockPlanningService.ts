import { differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import { listAssignmentSteps } from "@/lib/repositories/assignmentStepRepository";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { listCourses } from "@/lib/repositories/courseRepository";
import {
  listStudyBlocksForDate,
  replaceRuleBasedStudyBlocksForDate
} from "@/lib/repositories/studyBlockRepository";
import type { Assignment, AssignmentStep, Course, StudyBlock, StudyBlockInsertInput, Weekday } from "@/lib/types/domain";

export type StudyBlockWithAssignment = StudyBlock & {
  assignment: Assignment | null;
  course: Course | null;
};

export type StudyPlanData = {
  blocks: StudyBlockWithAssignment[];
  generatedInMemory: boolean;
  generationError: string | null;
  nextBlock: StudyBlockWithAssignment | null;
  plannedDate: string;
  totalMinutes: number;
};

const weekdays: Weekday[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_DAILY_BLOCK_LIMIT = 5;
const DEFAULT_BLOCK_MINUTES = 25;
const STUDY_DAY_END_MINUTES = 22 * 60 + 30;

function getDateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getTodayWeekday(date: Date): Weekday {
  return weekdays[date.getDay()];
}

function parseTimeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number.parseInt(part, 10));
  return hour * 60 + minute;
}

function formatMinutesAsTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function roundUpToNextQuarter(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return Math.ceil(minutes / 15) * 15;
}

function getRemainingMinutes(assignment: Assignment) {
  const remainingRatio = Math.max(0, 100 - assignment.progress) / 100;
  const estimatedMinutes = Math.max(DEFAULT_BLOCK_MINUTES, Math.round((assignment.estimatedHours || 1) * 60));
  return Math.max(DEFAULT_BLOCK_MINUTES, Math.ceil((estimatedMinutes * remainingRatio) / DEFAULT_BLOCK_MINUTES) * DEFAULT_BLOCK_MINUTES);
}

function scoreAssignmentForPlanning(assignment: Assignment, now: Date) {
  const due = parseISO(assignment.dueAt);
  const hoursUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  const dueInDays = differenceInCalendarDays(startOfDay(due), startOfDay(now));
  const remainingMinutes = getRemainingMinutes(assignment);

  let score = assignment.priorityScore + remainingMinutes / 4 + (100 - assignment.progress) * 0.4;

  if (hoursUntilDue < 0) {
    score += 420;
  } else if (hoursUntilDue <= 8) {
    score += 330;
  } else if (hoursUntilDue <= 24) {
    score += 260;
  } else if (hoursUntilDue <= 72) {
    score += 165;
  } else if (hoursUntilDue <= 168) {
    score += 85;
  } else if (dueInDays <= 14) {
    score += 35;
  }

  if (assignment.isHeavy) {
    score += 45;
  }

  if (assignment.status === "todo") {
    score += 20;
  }

  return Math.round(score);
}

function makeBlockTitle(assignment: Assignment, blockIndex: number, step?: AssignmentStep) {
  if (step) {
    return `${step.title}: ${assignment.title}`;
  }

  if (assignment.progress >= 75) {
    return `提出前確認: ${assignment.title}`;
  }

  if (assignment.status === "todo" && blockIndex === 0) {
    return `着手: ${assignment.title}`;
  }

  if (assignment.assignmentType === "lab_report") {
    return blockIndex === 0 ? `データとグラフ: ${assignment.title}` : `考察を進める: ${assignment.title}`;
  }

  if (assignment.assignmentType === "report") {
    return blockIndex === 0 ? `構成づくり: ${assignment.title}` : `本文を進める: ${assignment.title}`;
  }

  if (assignment.assignmentType === "presentation") {
    return blockIndex === 0 ? `スライド骨子: ${assignment.title}` : `発表資料を整える: ${assignment.title}`;
  }

  if (assignment.assignmentType === "quiz" || assignment.assignmentType === "exam") {
    return `演習25分: ${assignment.title}`;
  }

  return `25分進める: ${assignment.title}`;
}

function makeBlockDescription(assignment: Assignment, blockIndex: number, step?: AssignmentStep) {
  if (step) {
    return step.description ?? `目安${step.estimatedMinutes}分。ここだけ進めれば次の作業に入りやすくなります。`;
  }

  if (assignment.progress >= 75) {
    return "提出形式、ファイル名、未記入部分だけ確認して完了に近づける";
  }

  if (assignment.status === "todo" && blockIndex === 0) {
    return "まず課題内容を開いて、提出までの残り作業を見える形にする";
  }

  if (assignment.assignmentType === "lab_report") {
    return blockIndex === 0
      ? "測定データ、グラフ、必要な計算をまとめる"
      : "結果と考察の骨子を書き、次の清書に進める状態にする";
  }

  if (assignment.assignmentType === "quiz" || assignment.assignmentType === "exam") {
    return "範囲を1つに絞って、例題か小問を実際に解く";
  }

  return "25分で進める範囲を決め、途中でも進捗が残るところまで進める";
}

function createTimeAllocator(date: Date, courses: Course[]) {
  const todayStart = isSameDay(date, new Date()) ? roundUpToNextQuarter(new Date()) : 18 * 60;
  let cursor = Math.max(todayStart, 9 * 60);
  const classWindows = courses
    .filter((course) => course.dayOfWeek === getTodayWeekday(date))
    .map((course) => ({
      start: parseTimeToMinutes(course.startTime),
      end: parseTimeToMinutes(course.endTime)
    }))
    .sort((a, b) => a.start - b.start);

  return (durationMinutes: number) => {
    for (const classWindow of classWindows) {
      const endsBeforeClass = cursor + durationMinutes <= classWindow.start;
      const startsAfterClass = cursor >= classWindow.end;

      if (!endsBeforeClass && !startsAfterClass) {
        cursor = classWindow.end + 10;
      }
    }

    if (cursor + durationMinutes > STUDY_DAY_END_MINUTES) {
      return {
        endTime: null,
        startTime: null
      };
    }

    const startTime = formatMinutesAsTime(cursor);
    const endTime = formatMinutesAsTime(cursor + durationMinutes);
    cursor += durationMinutes + 10;

    return { endTime, startTime };
  };
}

function buildRuleBasedBlocks(params: {
  assignments: Assignment[];
  courses: Course[];
  date: Date;
  plannedDate: string;
  stepsByAssignment: Map<string, AssignmentStep[]>;
  userId: string;
}) {
  const candidates = params.assignments
    .filter((assignment) => assignment.status !== "done" && assignment.progress < 100 && !assignment.deletedAt)
    .map((assignment) => ({
      assignment,
      blocksNeeded: Math.ceil(getRemainingMinutes(assignment) / DEFAULT_BLOCK_MINUTES),
      score: scoreAssignmentForPlanning(assignment, params.date)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return parseISO(a.assignment.dueAt).getTime() - parseISO(b.assignment.dueAt).getTime();
    });

  const selected: Array<{ assignment: Assignment; blockIndex: number; score: number }> = [];

  for (const candidate of candidates) {
    if (selected.length >= Math.min(3, DEFAULT_DAILY_BLOCK_LIMIT)) {
      break;
    }
    selected.push({ assignment: candidate.assignment, blockIndex: 0, score: candidate.score });
  }

  for (const candidate of candidates) {
    if (selected.length >= DEFAULT_DAILY_BLOCK_LIMIT) {
      break;
    }

    const extraBlocks = Math.min(candidate.blocksNeeded - 1, candidate.assignment.isHeavy ? 2 : 1);
    for (let blockIndex = 1; blockIndex <= extraBlocks && selected.length < DEFAULT_DAILY_BLOCK_LIMIT; blockIndex += 1) {
      selected.push({ assignment: candidate.assignment, blockIndex, score: candidate.score - blockIndex * 8 });
    }
  }

  const allocateTime = createTimeAllocator(params.date, params.courses);

  return selected.map(({ assignment, blockIndex, score }) => {
    const { endTime, startTime } = allocateTime(DEFAULT_BLOCK_MINUTES);
    const nextStep = params.stepsByAssignment.get(assignment.id)?.[blockIndex];

    return {
      userId: params.userId,
      assignmentId: assignment.id,
      courseId: assignment.courseId,
      title: makeBlockTitle(assignment, blockIndex, nextStep),
      description: makeBlockDescription(assignment, blockIndex, nextStep),
      plannedDate: params.plannedDate,
      startTime,
      endTime,
      durationMinutes: DEFAULT_BLOCK_MINUTES,
      status: "planned",
      source: "rule_based",
      priority: score
    } satisfies StudyBlockInsertInput;
  });
}

async function loadOpenStepsByAssignment(userId: string, assignments: Assignment[]) {
  const incomplete = assignments.filter(
    (assignment) => assignment.status !== "done" && assignment.progress < 100 && !assignment.deletedAt
  );

  const entries = await Promise.all(
    incomplete.map(async (assignment) => {
      const steps = await listAssignmentSteps(userId, assignment.id);
      return [assignment.id, steps.filter((step) => step.status !== "done")] as const;
    })
  );

  return new Map(entries.filter(([, steps]) => steps.length > 0));
}

function attachAssignmentsToBlocks(
  blocks: StudyBlock[],
  assignments: Assignment[],
  courses: Course[]
): StudyBlockWithAssignment[] {
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const coursesById = new Map(courses.map((course) => [course.id, course]));

  return blocks.map((block) => {
    const assignment = block.assignmentId ? assignmentsById.get(block.assignmentId) ?? null : null;
    return {
      ...block,
      assignment,
      course: assignment?.course ?? (block.courseId ? coursesById.get(block.courseId) ?? null : null)
    };
  });
}

function getNextBlock(blocks: StudyBlockWithAssignment[]) {
  return (
    blocks.find((block) => block.status === "started") ??
    blocks.find((block) => block.status === "planned" && block.assignment?.status !== "done") ??
    null
  );
}

function toVolatileBlocks(inputs: StudyBlockInsertInput[]) {
  const now = new Date().toISOString();

  return inputs.map((input) => ({
    id: `volatile-${input.assignmentId ?? crypto.randomUUID()}-${input.startTime ?? input.priority ?? 0}`,
    userId: input.userId,
    assignmentId: input.assignmentId ?? null,
    courseId: input.courseId ?? null,
    title: input.title,
    description: input.description ?? null,
    plannedDate: input.plannedDate,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    durationMinutes: input.durationMinutes ?? DEFAULT_BLOCK_MINUTES,
    status: input.status ?? "planned",
    source: input.source ?? "rule_based",
    priority: input.priority ?? 0,
    createdAt: now,
    updatedAt: now
  })) satisfies StudyBlock[];
}

function makePlanResult(params: {
  assignments: Assignment[];
  blocks: StudyBlock[];
  courses: Course[];
  generatedInMemory: boolean;
  generationError?: string | null;
  plannedDate: string;
}): StudyPlanData {
  const blocks = attachAssignmentsToBlocks(params.blocks, params.assignments, params.courses);

  return {
    blocks,
    generatedInMemory: params.generatedInMemory,
    generationError: params.generationError ?? null,
    nextBlock: getNextBlock(blocks),
    plannedDate: params.plannedDate,
    totalMinutes: blocks
      .filter((block) => block.status === "planned" || block.status === "started")
      .reduce((sum, block) => sum + block.durationMinutes, 0)
  };
}

export async function getOrCreateTodayStudyPlan(params: {
  assignments: Assignment[];
  courses: Course[];
  date?: Date;
  force?: boolean;
  userId: string;
}): Promise<StudyPlanData> {
  const date = params.date ?? new Date();
  const plannedDate = getDateKey(date);

  try {
    if (!params.force) {
      const existing = await listStudyBlocksForDate(params.userId, plannedDate);
      if (existing.length > 0) {
        return makePlanResult({
          assignments: params.assignments,
          blocks: existing,
          courses: params.courses,
          generatedInMemory: false,
          plannedDate
        });
      }
    }

    const stepsByAssignment = await loadOpenStepsByAssignment(params.userId, params.assignments);
    const inputs = buildRuleBasedBlocks({
      assignments: params.assignments,
      courses: params.courses,
      date,
      plannedDate,
      stepsByAssignment,
      userId: params.userId
    });
    const saved = await replaceRuleBasedStudyBlocksForDate(params.userId, plannedDate, inputs);

    if (saved.length > 0 || inputs.length === 0) {
      return makePlanResult({
        assignments: params.assignments,
        blocks: saved,
        courses: params.courses,
        generatedInMemory: false,
        plannedDate
      });
    }

    return makePlanResult({
      assignments: params.assignments,
      blocks: toVolatileBlocks(inputs),
      courses: params.courses,
      generatedInMemory: true,
      generationError: "study_blocks table is not migrated yet",
      plannedDate
    });
  } catch (error) {
    return makePlanResult({
      assignments: params.assignments,
      blocks: [],
      courses: params.courses,
      generatedInMemory: true,
      generationError: error instanceof Error ? error.message : "Unknown study plan error",
      plannedDate
    });
  }
}

export async function regenerateTodayStudyPlan(userId: string, date = new Date()) {
  const [assignments, courses] = await Promise.all([
    listAssignments(userId, { sortBy: "due" }),
    listCourses(userId)
  ]);

  return getOrCreateTodayStudyPlan({
    assignments,
    courses,
    date,
    force: true,
    userId
  });
}
