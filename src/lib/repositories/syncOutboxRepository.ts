import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Database, Json } from "@/lib/types/database";

export type SyncOutboxOperation = "create_or_update" | "delete";
export type SyncOutboxStatus = "pending" | "processing" | "synced" | "failed";

export type SyncOutboxJob = {
  id: string;
  userId: string;
  assignmentId: string | null;
  provider: "google";
  operation: SyncOutboxOperation;
  status: SyncOutboxStatus;
  attempts: number;
  payload: Json;
  lastError: string | null;
  availableAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type SyncOutboxRow = Database["public"]["Tables"]["sync_outbox"]["Row"];

function mapSyncOutboxJob(row: SyncOutboxRow): SyncOutboxJob {
  return {
    id: row.id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    provider: "google",
    operation: row.operation as SyncOutboxOperation,
    status: row.status as SyncOutboxStatus,
    attempts: row.attempts,
    payload: row.payload,
    lastError: row.last_error,
    availableAt: row.available_at,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isMissingSyncOutboxTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /sync_outbox/i.test(maybeError.message ?? "");
}

export async function enqueueSyncOutboxJob(params: {
  assignmentId: string | null;
  operation: SyncOutboxOperation;
  payload?: Json;
  userId: string;
}): Promise<SyncOutboxJob | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const job: SyncOutboxJob = {
      id: crypto.randomUUID(),
      userId: params.userId,
      assignmentId: params.assignmentId,
      provider: "google",
      operation: params.operation,
      status: "pending",
      attempts: 0,
      payload: params.payload ?? {},
      lastError: null,
      availableAt: now,
      processedAt: null,
      createdAt: now,
      updatedAt: now
    };

    store.syncOutbox.push(job);
    persistMockStore(store);
    return job;
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .insert({
      user_id: params.userId,
      assignment_id: params.assignmentId,
      provider: "google",
      operation: params.operation,
      status: "pending",
      payload: params.payload ?? {},
      available_at: now
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingSyncOutboxTable(error)) {
      return null;
    }
    throw new Error(`Failed to enqueue sync job: ${error.message}`);
  }

  return mapSyncOutboxJob(data as SyncOutboxRow);
}

export async function listPendingSyncOutboxJobs(userId: string, limit = 10): Promise<SyncOutboxJob[]> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    return store.syncOutbox
      .filter((job) => job.userId === userId && job.status === "pending" && job.availableAt <= now)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("available_at", now)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isMissingSyncOutboxTable(error)) {
      return [];
    }
    throw new Error(`Failed to list pending sync jobs: ${error.message}`);
  }

  return (data as SyncOutboxRow[]).map(mapSyncOutboxJob);
}

export async function listRecentSyncOutboxJobs(userId: string, limit = 8): Promise<SyncOutboxJob[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.syncOutbox
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSyncOutboxTable(error)) {
      return [];
    }
    throw new Error(`Failed to list recent sync jobs: ${error.message}`);
  }

  return (data as SyncOutboxRow[]).map(mapSyncOutboxJob);
}

export async function requeueFailedSyncOutboxJobs(userId: string, limit = 20): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);

  if (!supabase) {
    const store = getMockStore();
    const targets = store.syncOutbox
      .filter((job) => job.userId === userId && job.status === "failed")
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, safeLimit);

    if (targets.length === 0) {
      return 0;
    }

    targets.forEach((job) => {
      job.status = "pending";
      job.availableAt = now;
      job.processedAt = null;
      job.updatedAt = now;
    });

    persistMockStore(store);
    return targets.length;
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "failed")
    .order("updated_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    if (isMissingSyncOutboxTable(error)) {
      return 0;
    }
    throw new Error(`Failed to list failed sync jobs: ${error.message}`);
  }

  const ids = ((data as Array<{ id: string }> | null) ?? []).map((item) => item.id);
  if (ids.length === 0) {
    return 0;
  }

  let requeued = 0;

  for (const id of ids) {
    const { error: updateError } = await supabase
      .from("sync_outbox")
      .update({
        status: "pending",
        available_at: now,
        processed_at: null,
        updated_at: now
      })
      .eq("id", id)
      .eq("user_id", userId)
      .eq("status", "failed");

    if (updateError) {
      throw new Error(`Failed to requeue sync job: ${updateError.message}`);
    }

    requeued += 1;
  }

  return requeued;
}

export async function markSyncOutboxJobProcessing(job: SyncOutboxJob) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    job.status = "processing";
    job.updatedAt = now;
    persistMockStore();
    return job;
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .update({
      status: "processing",
      updated_at: now
    })
    .eq("id", job.id)
    .eq("user_id", job.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to mark sync job processing: ${error.message}`);
  }

  return mapSyncOutboxJob(data as SyncOutboxRow);
}

export async function markSyncOutboxJobSynced(job: SyncOutboxJob) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    job.status = "synced";
    job.lastError = null;
    job.processedAt = now;
    job.updatedAt = now;
    persistMockStore();
    return job;
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .update({
      status: "synced",
      last_error: null,
      processed_at: now,
      updated_at: now
    })
    .eq("id", job.id)
    .eq("user_id", job.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to mark sync job synced: ${error.message}`);
  }

  return mapSyncOutboxJob(data as SyncOutboxRow);
}

export async function markSyncOutboxJobFailed(job: SyncOutboxJob, errorMessage: string) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    job.status = "failed";
    job.attempts += 1;
    job.lastError = errorMessage;
    job.updatedAt = now;
    persistMockStore();
    return job;
  }

  const { data, error } = await supabase
    .from("sync_outbox")
    .update({
      status: "failed",
      attempts: job.attempts + 1,
      last_error: errorMessage,
      updated_at: now
    })
    .eq("id", job.id)
    .eq("user_id", job.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to mark sync job failed: ${error.message}`);
  }

  return mapSyncOutboxJob(data as SyncOutboxRow);
}
