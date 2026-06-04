import { isSameDay, parseISO } from "date-fns";
import type { Assignment, Course } from "@/lib/types/domain";
import type { StudyBlockWithAssignment } from "@/lib/services/studyBlockPlanningService";
import { getLegacyTodayFreeTimeWindow, type TodayFreeTimeWindow } from "@/lib/services/todayFreeTimeService";

export type TimelineItemKind =
  | "class"
  | "assignment_due"
  | "exam"
  | "presentation"
  | "preparation"
  | "study_block"
  | "event"
  | "routine"
  | "work"
  | "club"
  | "commute"
  | "break"
  | "meal"
  | "sleep"
  | "free_time";

export type TimelineItemSource =
  | "manual"
  | "ai"
  | "google_calendar"
  | "assignment"
  | "course"
  | "routine"
  | "demo";

export type TimelineItemStatus =
  | "scheduled"
  | "in_progress"
  | "done"
  | "skipped"
  | "needs_confirmation"
  | "failed";

export type TimelineItem = {
  id: string;
  kind: TimelineItemKind;
  title: string;
  startAt: string | null;
  endAt: string | null;
  relatedAssignmentId?: string | null;
  relatedCourseId?: string | null;
  status?: TimelineItemStatus;
  source: TimelineItemSource;
  confidence?: number | null;
  notes?: string | null;
};

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function combineDateAndTime(date: Date, time: string | null | undefined) {
  if (!time) {
    return null;
  }

  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

function parseDate(value: string) {
  try {
    const date = parseISO(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function statusFromAssignment(assignment: Assignment): TimelineItemStatus {
  if (assignment.status === "done") {
    return "done";
  }

  if (assignment.status === "in_progress") {
    return "in_progress";
  }

  if (assignment.aiConfidence !== null && assignment.aiConfidence < 0.6) {
    return "needs_confirmation";
  }

  return "scheduled";
}

export function buildTodayTimelineItems(params: {
  assignments: Assignment[];
  courses: Course[];
  date: Date;
  freeTimeNote?: string | null;
  freeTimeWindow?: TodayFreeTimeWindow | null;
  studyBlocks: StudyBlockWithAssignment[];
}): TimelineItem[] {
  const todayKey = dateKey(params.date);
  const items: TimelineItem[] = [];
  const selectedFreeTime = params.freeTimeWindow ?? getLegacyTodayFreeTimeWindow(params.freeTimeNote);

  for (const course of params.courses) {
    items.push({
      id: `course-${course.id}`,
      kind: "class",
      title: course.name,
      startAt: combineDateAndTime(params.date, course.startTime),
      endAt: combineDateAndTime(params.date, course.endTime),
      relatedCourseId: course.id,
      status: "scheduled",
      source: "course",
      notes: course.room
    });
  }

  if (selectedFreeTime) {
    items.push({
      id: `free-time-${selectedFreeTime.start}-${selectedFreeTime.end}`,
      kind: "free_time",
      title: "今日の空き時間",
      startAt: combineDateAndTime(params.date, selectedFreeTime.start),
      endAt: combineDateAndTime(params.date, selectedFreeTime.end),
      status: "scheduled",
      source: "manual",
      notes: "時刻で設定した空いてる時間"
    });
  }

  for (const block of params.studyBlocks) {
    if (block.plannedDate !== todayKey) {
      continue;
    }

    items.push({
      id: `study-block-${block.id}`,
      kind: "study_block",
      title: block.assignment ? `${block.assignment.title}: ${block.title}` : block.title,
      startAt: combineDateAndTime(params.date, block.startTime),
      endAt: combineDateAndTime(params.date, block.endTime),
      relatedAssignmentId: block.assignment?.id ?? block.assignmentId,
      relatedCourseId: block.course?.id ?? block.courseId,
      status:
        block.status === "completed"
          ? "done"
          : block.status === "started"
            ? "in_progress"
            : block.status === "skipped" || block.status === "rescheduled"
              ? "skipped"
              : "scheduled",
      source: block.source === "ai_generated" ? "ai" : block.source === "manual" ? "manual" : "assignment",
      notes: block.description
    });
  }

  for (const assignment of params.assignments) {
    if (assignment.status === "done") {
      continue;
    }

    const due = parseDate(assignment.dueAt);
    if (!due || !isSameDay(due, params.date)) {
      continue;
    }

    items.push({
      id: `assignment-due-${assignment.id}`,
      kind: "assignment_due",
      title: `${assignment.title} 締切`,
      startAt: due.toISOString(),
      endAt: null,
      relatedAssignmentId: assignment.id,
      relatedCourseId: assignment.courseId,
      status: statusFromAssignment(assignment),
      source: "assignment",
      confidence: assignment.aiConfidence,
      notes: assignment.submissionTarget ? `${assignment.submissionTarget}に提出` : null
    });
  }

  return items.sort((a, b) => {
    if (!a.startAt && !b.startAt) {
      return a.title.localeCompare(b.title);
    }
    if (!a.startAt) return 1;
    if (!b.startAt) return -1;
    return a.startAt.localeCompare(b.startAt);
  });
}
