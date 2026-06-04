import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Database } from "@/lib/types/database";

export type WorkSessionStatus = "active" | "completed" | "cancelled";

export type WorkSession = {
  id: string;
  userId: string;
  assignmentId: string;
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number;
  progressBefore: number;
  progressAfter: number | null;
  note: string | null;
  status: WorkSessionStatus;
  createdAt: string;
  updatedAt: string;
};

type WorkSessionRow = Database["public"]["Tables"]["work_sessions"]["Row"];

function mapWorkSession(row: WorkSessionRow): WorkSession {
  return {
    id: row.id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    plannedMinutes: row.planned_minutes,
    progressBefore: row.progress_before,
    progressAfter: row.progress_after,
    note: row.note,
    status: row.status as WorkSessionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isMissingWorkSessionsTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /work_sessions/i.test(maybeError.message ?? "");
}

export async function createWorkSession(params: {
  assignmentId: string;
  plannedMinutes?: number;
  progressBefore: number;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const existing = store.workSessions.find(
      (session) =>
        session.userId === params.userId &&
        session.assignmentId === params.assignmentId &&
        session.status === "active"
    );

    if (existing) {
      return existing;
    }

    const session: WorkSession = {
      id: crypto.randomUUID(),
      userId: params.userId,
      assignmentId: params.assignmentId,
      startedAt: now,
      endedAt: null,
      plannedMinutes: params.plannedMinutes ?? 25,
      progressBefore: params.progressBefore,
      progressAfter: null,
      note: null,
      status: "active",
      createdAt: now,
      updatedAt: now
    };

    store.workSessions.push(session);
    persistMockStore(store);
    return session;
  }

  const active = await getActiveWorkSession(params.userId, params.assignmentId);
  if (active) {
    return active;
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .insert({
      user_id: params.userId,
      assignment_id: params.assignmentId,
      planned_minutes: params.plannedMinutes ?? 25,
      progress_before: params.progressBefore,
      status: "active"
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingWorkSessionsTable(error)) {
      throw new Error("work_sessions table is not migrated yet");
    }
    throw new Error(`Failed to create work session: ${error.message}`);
  }

  return mapWorkSession(data as WorkSessionRow);
}

export async function getActiveWorkSession(userId: string, assignmentId: string): Promise<WorkSession | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return (
      store.workSessions.find(
        (session) =>
          session.userId === userId &&
          session.assignmentId === assignmentId &&
          session.status === "active"
      ) ?? null
    );
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingWorkSessionsTable(error)) {
      return null;
    }
    throw new Error(`Failed to fetch active work session: ${error.message}`);
  }

  return data ? mapWorkSession(data as WorkSessionRow) : null;
}

export async function listWorkSessions(userId: string, assignmentId: string, limit = 5): Promise<WorkSession[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.workSessions
      .filter((session) => session.userId === userId && session.assignmentId === assignmentId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingWorkSessionsTable(error)) {
      return [];
    }
    throw new Error(`Failed to list work sessions: ${error.message}`);
  }

  return (data as WorkSessionRow[]).map(mapWorkSession);
}

export async function completeWorkSession(params: {
  note?: string | null;
  progressAfter: number;
  sessionId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const session = store.workSessions.find((item) => item.id === params.sessionId && item.userId === params.userId);
    if (!session) {
      throw new Error("Work session not found");
    }

    session.status = "completed";
    session.endedAt = now;
    session.progressAfter = params.progressAfter;
    session.note = params.note ?? null;
    session.updatedAt = now;
    persistMockStore(store);
    return session;
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .update({
      status: "completed",
      ended_at: now,
      progress_after: params.progressAfter,
      note: params.note ?? null,
      updated_at: now
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to complete work session: ${error.message}`);
  }

  return mapWorkSession(data as WorkSessionRow);
}

export async function cancelWorkSession(params: {
  sessionId: string;
  userId: string;
}): Promise<WorkSession | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const session = store.workSessions.find((item) => item.id === params.sessionId && item.userId === params.userId);
    if (!session) {
      return null;
    }

    session.status = "cancelled";
    session.progressAfter = null;
    session.updatedAt = now;
    persistMockStore(store);
    return session;
  }

  const { data, error } = await supabase
    .from("work_sessions")
    .update({
      status: "cancelled",
      progress_after: null,
      updated_at: now
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingWorkSessionsTable(error)) {
      return null;
    }
    throw new Error(`Failed to cancel work session: ${error.message}`);
  }

  return data ? mapWorkSession(data as WorkSessionRow) : null;
}
