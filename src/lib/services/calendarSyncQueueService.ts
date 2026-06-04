import { getAssignmentById, upsertCalendarRecord } from "@/lib/repositories/assignmentRepository";
import {
  enqueueSyncOutboxJob,
  listPendingSyncOutboxJobs,
  markSyncOutboxJobFailed,
  markSyncOutboxJobProcessing,
  markSyncOutboxJobSynced,
  requeueFailedSyncOutboxJobs,
  type SyncOutboxJob,
  type SyncOutboxOperation
} from "@/lib/repositories/syncOutboxRepository";
import { syncAssignmentWithCalendar } from "@/lib/services/calendarSyncService";
import type { Assignment } from "@/lib/types/domain";
import type { Json } from "@/lib/types/database";

type QueueSyncResult = {
  error: string | null;
  jobId: string | null;
  queued: boolean;
  synced: boolean;
};

function toJsonPayload(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function assignmentFromPayload(job: SyncOutboxJob): Assignment | null {
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
    return null;
  }

  const payload = job.payload as unknown as Assignment;
  return payload.id ? payload : null;
}

async function resolveAssignmentForJob(job: SyncOutboxJob) {
  if (job.operation === "delete") {
    return assignmentFromPayload(job);
  }

  if (!job.assignmentId) {
    return null;
  }

  return getAssignmentById(job.userId, job.assignmentId);
}

export async function processCalendarSyncJob(job: SyncOutboxJob): Promise<QueueSyncResult> {
  const processingJob = await markSyncOutboxJobProcessing(job);

  try {
    const assignment = await resolveAssignmentForJob(processingJob);
    if (!assignment) {
      const error = "Assignment not found for calendar sync job";
      await markSyncOutboxJobFailed(processingJob, error);
      return {
        error,
        jobId: processingJob.id,
        queued: true,
        synced: false
      };
    }

    const result = await syncAssignmentWithCalendar({
      userId: processingJob.userId,
      assignment,
      mode: processingJob.operation
    });

    if (result.synced) {
      await markSyncOutboxJobSynced(processingJob);
      return {
        error: null,
        jobId: processingJob.id,
        queued: true,
        synced: true
      };
    }

    const error = result.error ?? "Calendar sync failed";
    await markSyncOutboxJobFailed(processingJob, error);
    return {
      error,
      jobId: processingJob.id,
      queued: true,
      synced: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown calendar sync error";
    await markSyncOutboxJobFailed(processingJob, message);
    return {
      error: message,
      jobId: processingJob.id,
      queued: true,
      synced: false
    };
  }
}

export async function queueAndTryAssignmentCalendarSync(params: {
  assignment: Assignment;
  operation: SyncOutboxOperation;
  tryImmediate?: boolean;
  userId: string;
}): Promise<QueueSyncResult> {
  await upsertCalendarRecord({
    userId: params.userId,
    assignmentId: params.assignment.id,
    syncStatus: "pending"
  });

  const job = await enqueueSyncOutboxJob({
    userId: params.userId,
    assignmentId: params.assignment.id,
    operation: params.operation,
    payload: toJsonPayload(params.assignment)
  });

  if (!job) {
    if (!params.tryImmediate) {
      return {
        error: null,
        jobId: null,
        queued: false,
        synced: false
      };
    }

    const result = await syncAssignmentWithCalendar({
      userId: params.userId,
      assignment: params.assignment,
      mode: params.operation
    });

    return {
      error: result.error ?? null,
      jobId: null,
      queued: false,
      synced: result.synced
    };
  }

  if (!params.tryImmediate) {
    return {
      error: null,
      jobId: job.id,
      queued: true,
      synced: false
    };
  }

  return processCalendarSyncJob(job);
}

export async function retryAssignmentCalendarSync(userId: string, assignmentId: string): Promise<QueueSyncResult> {
  const assignment = await getAssignmentById(userId, assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  return queueAndTryAssignmentCalendarSync({
    userId,
    assignment,
    operation: "create_or_update",
    tryImmediate: true
  });
}

export async function dispatchCalendarSyncOutbox(params: {
  userId: string;
  limit?: number;
  retryFailed?: boolean;
  retryFailedLimit?: number;
}) {
  const limit = Math.min(Math.max(Math.trunc(params.limit ?? 10), 1), 200);
  const retryFailed = params.retryFailed ?? false;
  const retryFailedLimit = Math.min(Math.max(Math.trunc(params.retryFailedLimit ?? limit), 1), 200);
  const requeued = retryFailed ? await requeueFailedSyncOutboxJobs(params.userId, retryFailedLimit) : 0;
  const jobs = await listPendingSyncOutboxJobs(params.userId, limit);
  const results: QueueSyncResult[] = [];

  for (const job of jobs) {
    results.push(await processCalendarSyncJob(job));
  }

  return {
    requeued,
    picked: jobs.length,
    synced: results.filter((result) => result.synced).length,
    failed: results.filter((result) => !result.synced).length,
    results
  };
}
