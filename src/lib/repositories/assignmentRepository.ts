import { compareAsc, compareDesc, isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type {
  Assignment,
  AssignmentFilter,
  AssignmentUpsertInput,
  CalendarSyncRecord,
  ProgressValue,
  Subtask,
  Weekday
} from "@/lib/types/domain";
import type { Database } from "@/lib/types/database";
import { toInt } from "@/lib/utils";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentInsert = Database["public"]["Tables"]["assignments"]["Insert"];
type AssignmentUpdate = Database["public"]["Tables"]["assignments"]["Update"];
type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type SubtaskRow = Database["public"]["Tables"]["subtasks"]["Row"];
type CalendarSyncRow = Database["public"]["Tables"]["calendar_sync_records"]["Row"];

type AssignmentJoinedRow = AssignmentRow & {
  course: CourseRow | null;
};

function mapCourse(row: CourseRow | null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    dayOfWeek: row.day_of_week as Weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    instructor: row.instructor,
    color: row.color,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    title: row.title,
    done: row.done,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAssignment(row: AssignmentJoinedRow): Assignment {
  return {
    id: row.id,
    userId: row.user_id,
    courseId: row.course_id,
    title: row.title,
    dueAt: row.due_at,
    submissionTarget: row.submission_target,
    assignmentType: row.assignment_type as Assignment["assignmentType"],
    memo: row.memo,
    priorityLabel: row.priority_label as Assignment["priorityLabel"],
    priorityScore: row.priority_score,
    progress: row.progress as ProgressValue,
    status: row.status as Assignment["status"],
    url: row.url,
    estimatedHours: row.estimated_hours,
    aiSourceText: row.ai_source_text,
    aiConfidence: row.ai_confidence,
    isHeavy: row.is_heavy,
    tags: (row.tags ?? []) as Assignment["tags"],
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    course: mapCourse(row.course)
  };
}

function hydrateLocalAssignment(assignment: Assignment, courses: ReturnType<typeof getMockStore>["courses"]): Assignment {
  return {
    ...assignment,
    course: assignment.courseId ? courses.find((course) => course.id === assignment.courseId) ?? null : null
  };
}

function attachCalendarSyncRecords(assignments: Assignment[], records: CalendarSyncRecord[]): Assignment[] {
  const latestByAssignmentId = new Map<string, CalendarSyncRecord>();

  for (const record of records) {
    const current = latestByAssignmentId.get(record.assignmentId);
    if (!current || record.updatedAt > current.updatedAt) {
      latestByAssignmentId.set(record.assignmentId, record);
    }
  }

  return assignments.map((assignment) => ({
    ...assignment,
    calendarSync: latestByAssignmentId.get(assignment.id) ?? null
  }));
}

async function resolveSupabaseClient(useAdmin: boolean) {
  if (!useAdmin) {
    return createSupabaseServerClient();
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    return admin;
  }

  const server = await createSupabaseServerClient();
  if (server) {
    throw new Error("Supabase admin client is required for system assignment lookup");
  }

  return null;
}

function toInsertPayload(input: AssignmentUpsertInput): AssignmentInsert {
  return {
    user_id: input.userId,
    course_id: input.courseId,
    title: input.title,
    due_at: input.dueAt,
    submission_target: input.submissionTarget ?? null,
    assignment_type: input.assignmentType,
    memo: input.memo ?? null,
    priority_label: input.priorityLabel ?? "medium",
    priority_score: input.priorityScore ?? 0,
    progress: input.progress ?? 0,
    status: input.status ?? "todo",
    url: input.url ?? null,
    estimated_hours: input.estimatedHours ?? 1,
    ai_source_text: input.aiSourceText ?? null,
    ai_confidence: input.aiConfidence ?? null,
    is_heavy: input.isHeavy ?? false,
    tags: input.tags ?? []
  };
}

function toUpdatePayload(input: AssignmentUpsertInput): AssignmentUpdate {
  return {
    course_id: input.courseId,
    title: input.title,
    due_at: input.dueAt,
    submission_target: input.submissionTarget ?? null,
    assignment_type: input.assignmentType,
    memo: input.memo ?? null,
    priority_label: input.priorityLabel,
    priority_score: input.priorityScore,
    progress: input.progress,
    status: input.status,
    url: input.url ?? null,
    estimated_hours: input.estimatedHours,
    ai_source_text: input.aiSourceText ?? null,
    ai_confidence: input.aiConfidence ?? null,
    is_heavy: input.isHeavy,
    tags: input.tags,
    updated_at: new Date().toISOString()
  };
}

function filterLocal(items: Assignment[], filter?: AssignmentFilter) {
  if (!filter) {
    return items;
  }

  return items
    .filter((item) => {
      if (item.deletedAt) {
        return false;
      }
      if (filter.onlyIncomplete && item.status === "done") {
        return false;
      }
      if (filter.courseId && filter.courseId !== "all" && item.courseId !== filter.courseId) {
        return false;
      }
      if (filter.assignmentType && filter.assignmentType !== "all" && item.assignmentType !== filter.assignmentType) {
        return false;
      }
      if (filter.tag && filter.tag !== "all" && !item.tags.includes(filter.tag)) {
        return false;
      }
      if (filter.q) {
        const q = filter.q.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.course?.name?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filter.dueDate) {
        const due = item.dueAt.slice(0, 10);
        if (due !== filter.dueDate) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      switch (filter.sortBy) {
        case "priority":
          return b.priorityScore - a.priorityScore;
        case "updated":
          return compareDesc(parseISO(a.updatedAt), parseISO(b.updatedAt));
        case "due":
        default:
          return compareAsc(parseISO(a.dueAt), parseISO(b.dueAt));
      }
    });
}

export async function listAssignments(userId: string, filter?: AssignmentFilter): Promise<Assignment[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const hydrated = store.assignments
      .filter((item) => item.userId === userId)
      .map((item) => hydrateLocalAssignment(item, store.courses));
    return attachCalendarSyncRecords(
      filterLocal(hydrated, filter),
      store.calendarRecords.filter((record) => record.userId === userId)
    );
  }

  let query = supabase
    .from("assignments")
    .select("*, course:courses(*)")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (filter?.onlyIncomplete) {
    query = query.neq("status", "done");
  }

  if (filter?.courseId && filter.courseId !== "all") {
    query = query.eq("course_id", filter.courseId);
  }

  if (filter?.assignmentType && filter.assignmentType !== "all") {
    query = query.eq("assignment_type", filter.assignmentType);
  }

  if (filter?.tag && filter.tag !== "all") {
    query = query.contains("tags", [filter.tag]);
  }

  if (filter?.dueDate) {
    const from = `${filter.dueDate}T00:00:00+09:00`;
    const to = `${filter.dueDate}T23:59:59+09:00`;
    query = query.gte("due_at", from).lte("due_at", to);
  }

  switch (filter?.sortBy) {
    case "priority":
      query = query.order("priority_score", { ascending: false });
      break;
    case "updated":
      query = query.order("updated_at", { ascending: false });
      break;
    case "due":
    default:
      query = query.order("due_at", { ascending: true });
      break;
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list assignments: ${error.message}`);
  }

  let mapped = (data as AssignmentJoinedRow[]).map(mapAssignment);

  if (filter?.q) {
    const q = filter.q.toLowerCase();
    mapped = mapped.filter((item) => {
      const haystack = [item.title, item.memo ?? "", item.course?.name ?? ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }

  const calendarRecords = await listCalendarRecords(userId);
  return attachCalendarSyncRecords(mapped, calendarRecords);
}

export async function getAssignmentById(
  userId: string,
  id: string,
  options?: { useAdmin?: boolean }
): Promise<Assignment | null> {
  const supabase = await resolveSupabaseClient(Boolean(options?.useAdmin));

  if (!supabase) {
    const store = getMockStore();
    const assignment = store.assignments.find((item) => item.userId === userId && item.id === id && !item.deletedAt);
    return assignment ? hydrateLocalAssignment(assignment, store.courses) : null;
  }

  const { data, error } = await supabase
    .from("assignments")
    .select("*, course:courses(*)")
    .eq("user_id", userId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch assignment: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapAssignment(data as AssignmentJoinedRow);
}

export async function upsertAssignment(input: AssignmentUpsertInput): Promise<Assignment> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();

    if (input.id) {
      const current = store.assignments.find((item) => item.id === input.id && item.userId === input.userId);
      if (!current) {
        throw new Error("Assignment not found");
      }
      current.courseId = input.courseId;
      current.title = input.title;
      current.dueAt = input.dueAt;
      current.submissionTarget = input.submissionTarget ?? null;
      current.assignmentType = input.assignmentType;
      current.memo = input.memo ?? null;
      current.priorityLabel = input.priorityLabel ?? "medium";
      current.priorityScore = input.priorityScore ?? current.priorityScore;
      current.progress = (input.progress ?? current.progress) as ProgressValue;
      current.status = input.status ?? current.status;
      current.url = input.url ?? null;
      current.estimatedHours = input.estimatedHours ?? 1;
      current.aiSourceText = input.aiSourceText ?? current.aiSourceText;
      current.aiConfidence = input.aiConfidence ?? current.aiConfidence;
      current.isHeavy = input.isHeavy ?? current.isHeavy;
      current.tags = input.tags ?? current.tags;
      current.updatedAt = new Date().toISOString();
      persistMockStore(store);
      return hydrateLocalAssignment(current, store.courses);
    }

    const now = new Date().toISOString();
    const created: Assignment = {
      id: crypto.randomUUID(),
      userId: input.userId,
      courseId: input.courseId,
      title: input.title,
      dueAt: input.dueAt,
      submissionTarget: input.submissionTarget ?? null,
      assignmentType: input.assignmentType,
      memo: input.memo ?? null,
      priorityLabel: input.priorityLabel ?? "medium",
      priorityScore: input.priorityScore ?? 0,
      progress: (input.progress ?? 0) as ProgressValue,
      status: input.status ?? "todo",
      url: input.url ?? null,
      estimatedHours: input.estimatedHours ?? 1,
      aiSourceText: input.aiSourceText ?? null,
      aiConfidence: input.aiConfidence ?? null,
      isHeavy: input.isHeavy ?? false,
      tags: input.tags ?? [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    };

    store.assignments.push(created);
    persistMockStore(store);
    return hydrateLocalAssignment(created, store.courses);
  }

  if (input.id) {
    const payload = toUpdatePayload(input);

    const { data, error } = await supabase
      .from("assignments")
      .update(payload)
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*, course:courses(*)")
      .single();

    if (error) {
      throw new Error(`Failed to update assignment: ${error.message}`);
    }

    return mapAssignment(data as AssignmentJoinedRow);
  }

  const payload = toInsertPayload(input);
  const { data, error } = await supabase
    .from("assignments")
    .insert(payload)
    .select("*, course:courses(*)")
    .single();

  if (error) {
    throw new Error(`Failed to create assignment: ${error.message}`);
  }

  return mapAssignment(data as AssignmentJoinedRow);
}

export async function softDeleteAssignment(userId: string, assignmentId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const target = store.assignments.find((item) => item.id === assignmentId && item.userId === userId);
    if (!target) {
      return;
    }
    target.deletedAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    persistMockStore(store);
    return;
  }

  const { error } = await supabase
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete assignment: ${error.message}`);
  }
}

export async function restoreSoftDeletedAssignment(userId: string, assignmentId: string): Promise<Assignment | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const target = store.assignments.find((item) => item.id === assignmentId && item.userId === userId);
    if (!target) {
      return null;
    }

    target.deletedAt = null;
    target.updatedAt = now;
    persistMockStore(store);
    return hydrateLocalAssignment(target, store.courses);
  }

  const { data, error } = await supabase
    .from("assignments")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .select("*, course:courses(*)")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to restore assignment: ${error.message}`);
  }

  return data ? mapAssignment(data as AssignmentJoinedRow) : null;
}

export async function replaceSubtasks(userId: string, assignmentId: string, titles: string[]) {
  const normalized = titles.map((title) => title.trim()).filter(Boolean);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    store.subtasks = store.subtasks.filter((item) => item.assignmentId !== assignmentId);
    const now = new Date().toISOString();
    normalized.forEach((title, index) => {
      store.subtasks.push({
        id: crypto.randomUUID(),
        assignmentId,
        title,
        done: false,
        orderIndex: index,
        createdAt: now,
        updatedAt: now
      });
    });
    persistMockStore(store);
    return;
  }

  const { error: deleteError } = await supabase
    .from("subtasks")
    .delete()
    .eq("assignment_id", assignmentId);

  if (deleteError) {
    throw new Error(`Failed to replace subtasks: ${deleteError.message}`);
  }

  if (normalized.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("subtasks").insert(
    normalized.map((title, index) => ({
      assignment_id: assignmentId,
      title,
      done: false,
      order_index: index
    }))
  );

  if (insertError) {
    throw new Error(`Failed to insert subtasks: ${insertError.message}`);
  }
}

export async function listSubtasks(userId: string, assignmentId: string): Promise<Subtask[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const owner = store.assignments.find((item) => item.id === assignmentId && item.userId === userId);
    if (!owner) {
      return [];
    }

    return store.subtasks
      .filter((item) => item.assignmentId === assignmentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch subtasks: ${error.message}`);
  }

  return (data as SubtaskRow[]).map(mapSubtask);
}

export async function listCalendarRecords(userId: string, assignmentId?: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const base = store.calendarRecords.filter((item) => item.userId === userId);
    return assignmentId ? base.filter((item) => item.assignmentId === assignmentId) : base;
  }

  let query = supabase.from("calendar_sync_records").select("*").eq("user_id", userId);
  if (assignmentId) {
    query = query.eq("assignment_id", assignmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch calendar records: ${error.message}`);
  }

  return (data as CalendarSyncRow[]).map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    provider: "google" as const,
    externalEventId: row.external_event_id,
    syncStatus: row.sync_status as "pending" | "synced" | "failed",
    errorMessage: row.error_message,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function upsertCalendarRecord(params: {
  userId: string;
  assignmentId: string;
  externalEventId?: string | null;
  syncStatus: "pending" | "synced" | "failed";
  errorMessage?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const existing = store.calendarRecords.find(
      (item) => item.userId === params.userId && item.assignmentId === params.assignmentId
    );

    if (existing) {
      existing.externalEventId = params.externalEventId ?? existing.externalEventId;
      existing.syncStatus = params.syncStatus;
      existing.errorMessage = params.errorMessage ?? null;
      existing.lastSyncedAt = params.syncStatus === "synced" ? now : existing.lastSyncedAt;
      existing.updatedAt = now;
      persistMockStore(store);
      return existing;
    }

    const created = {
      id: crypto.randomUUID(),
      assignmentId: params.assignmentId,
      userId: params.userId,
      provider: "google" as const,
      externalEventId: params.externalEventId ?? null,
      syncStatus: params.syncStatus,
      errorMessage: params.errorMessage ?? null,
      lastSyncedAt: params.syncStatus === "synced" ? now : null,
      createdAt: now,
      updatedAt: now
    };

    store.calendarRecords.push(created);
    persistMockStore(store);
    return created;
  }

  const { data: existing } = await supabase
    .from("calendar_sync_records")
    .select("id")
    .eq("user_id", params.userId)
    .eq("assignment_id", params.assignmentId)
    .maybeSingle();

  const payload = {
    assignment_id: params.assignmentId,
    user_id: params.userId,
    provider: "google",
    external_event_id: params.externalEventId ?? null,
    sync_status: params.syncStatus,
    error_message: params.errorMessage ?? null,
    last_synced_at: params.syncStatus === "synced" ? now : null,
    updated_at: now
  };

  if (existing?.id) {
    const { error } = await supabase.from("calendar_sync_records").update(payload).eq("id", existing.id);

    if (error) {
      throw new Error(`Failed to update calendar record: ${error.message}`);
    }
    return;
  }

  const { error } = await supabase.from("calendar_sync_records").insert(payload);
  if (error) {
    throw new Error(`Failed to create calendar record: ${error.message}`);
  }
}

export async function listDashboardAssignments(userId: string) {
  const all = await listAssignments(userId, { sortBy: "due" });

  const now = new Date();
  const today = startOfDay(now);

  const incomplete = all.filter((item) => item.status !== "done");
  const dueToday = incomplete.filter((item) => {
    const due = parseISO(item.dueAt);
    return due >= today && due < new Date(today.getTime() + 1000 * 60 * 60 * 24);
  });

  const overdue = incomplete.filter((item) => isBefore(parseISO(item.dueAt), now));

  return {
    all,
    incomplete,
    dueToday,
    overdue,
    upcoming: incomplete.filter((item) => isAfter(parseISO(item.dueAt), now)).slice(0, 8)
  };
}

export async function updateProgressAndStatus(userId: string, assignmentId: string, progress: number) {
  const safeProgress = Math.max(0, Math.min(100, toInt(progress, 0))) as ProgressValue;
  const status = safeProgress === 100 ? "done" : safeProgress === 0 ? "todo" : "in_progress";
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const target = store.assignments.find(
      (item) => item.id === assignmentId && item.userId === userId && !item.deletedAt
    );

    if (!target) {
      throw new Error("Assignment not found");
    }

    target.progress = safeProgress;
    target.status = status;
    target.updatedAt = new Date().toISOString();
    persistMockStore(store);
    return target;
  }

  const { data, error } = await supabase
    .from("assignments")
    .update({
      progress: safeProgress,
      status,
      updated_at: new Date().toISOString()
    })
    .eq("id", assignmentId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update assignment progress: ${error.message}`);
  }

  if (!data) {
    throw new Error("Assignment not found");
  }

  return { id: assignmentId, progress: safeProgress, status };
}
