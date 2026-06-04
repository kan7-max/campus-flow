"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ASSIGNMENT_TYPES } from "@/lib/constants/domain";
import {
  deleteAssignmentWithCalendarSync,
  restoreAssignmentWithCalendarSync,
  saveAssignmentWithIntegrations
} from "@/lib/services/assignmentService";
import { getAssignmentById, updateProgressAndStatus } from "@/lib/repositories/assignmentRepository";
import {
  createAssignmentStep,
  moveAssignmentStep,
  updateAssignmentStepStatus
} from "@/lib/repositories/assignmentStepRepository";
import { retryAssignmentCalendarSync } from "@/lib/services/calendarSyncQueueService";
import { cancelWorkSession, completeWorkSession, createWorkSession } from "@/lib/repositories/workSessionRepository";
import {
  getStudyBlockById,
  rescheduleStudyBlock,
  updateStudyBlockStatus
} from "@/lib/repositories/studyBlockRepository";
import { createTemplateAssignmentSteps } from "@/lib/services/assignmentStepTemplateService";
import { regenerateTodayStudyPlan } from "@/lib/services/studyBlockPlanningService";
import type { AssignmentStatus, AssignmentTag, AssignmentType, ProgressValue } from "@/lib/types/domain";

const assignmentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  courseId: z.string().nullable(),
  dueAt: z.string().min(1),
  submissionTarget: z.string().nullable(),
  assignmentType: z.enum(ASSIGNMENT_TYPES),
  memo: z.string().nullable(),
  progress: z.coerce.number().min(0).max(100),
  status: z.enum(["todo", "in_progress", "done"]),
  url: z.string().nullable(),
  estimatedHours: z.coerce.number().min(1).max(24),
  isHeavy: z.boolean(),
  tagQuick: z.boolean(),
  suggestedSubtasks: z.string().nullable()
});

const assignmentStatusSchema = z.enum(["todo", "in_progress", "done"]);

export type AssignmentQuickActionState = {
  message: string | null;
  tone: "success" | "warning";
  undo?: {
    assignmentId: string;
    dueAt?: string;
    progress?: number;
    type: "due" | "progress";
  } | null;
};

const emptyQuickActionState: AssignmentQuickActionState = {
  message: null,
  tone: "success",
  undo: null
};

function normalizeDateInput(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid due date");
  }
  return date.toISOString();
}

function moveToTomorrowKeepingTime(input: string) {
  const currentDueAt = new Date(input);
  if (Number.isNaN(currentDueAt.getTime())) {
    throw new Error("Invalid due date");
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(
    currentDueAt.getHours(),
    currentDueAt.getMinutes(),
    currentDueAt.getSeconds(),
    currentDueAt.getMilliseconds()
  );

  return tomorrow.toISOString();
}

function tomorrowDateKey() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, "0"),
    String(tomorrow.getDate()).padStart(2, "0")
  ].join("-");
}

function revalidateAssignmentViews(assignmentId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/assignments");
  revalidatePath("/today");

  if (assignmentId) {
    revalidatePath(`/assignments/${assignmentId}`);
  }
}

function parseHotSourcePath(formData: FormData) {
  const raw = formData.get("sourcePath");
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const normalized = trimmed.split("?")[0]?.split("#")[0] ?? "";
  if (
    normalized === "/dashboard" ||
    normalized === "/today" ||
    normalized === "/assignments" ||
    normalized.startsWith("/assignments/")
  ) {
    return normalized;
  }

  return null;
}

function revalidateHotActionViews({
  assignmentId,
  sourcePath
}: {
  assignmentId?: string;
  sourcePath?: string | null;
}) {
  const targetPath = sourcePath?.trim() ? sourcePath : assignmentId ? `/assignments/${assignmentId}` : "/today";
  revalidatePath(targetPath);

  if (assignmentId) {
    const detailPath = `/assignments/${assignmentId}`;
    if (targetPath !== detailPath) {
      revalidatePath(detailPath);
    }
  }
}

async function saveAssignmentDueAt(userId: string, assignmentId: string, dueAt: string) {
  const current = await getAssignmentById(userId, assignmentId);
  if (!current) {
    throw new Error("Assignment not found");
  }

  await saveAssignmentWithIntegrations(
    {
      id: current.id,
      userId,
      courseId: current.courseId,
      title: current.title,
      dueAt,
      submissionTarget: current.submissionTarget,
      assignmentType: current.assignmentType,
      memo: current.memo,
      progress: current.progress,
      status: current.status,
      url: current.url,
      estimatedHours: current.estimatedHours,
      aiSourceText: current.aiSourceText,
      aiConfidence: current.aiConfidence,
      isHeavy: current.isHeavy,
      tags: current.tags
    },
    undefined,
    {
      deferIntegrations: true
    }
  );

  return current;
}

async function saveAssignmentStatus(userId: string, assignmentId: string, status: AssignmentStatus) {
  const current = await getAssignmentById(userId, assignmentId);
  if (!current) {
    throw new Error("Assignment not found");
  }

  const progress = (() => {
    if (status === "done") return 100;
    if (status === "todo") return 0;
    if (current.progress === 0 || current.progress === 100) return 25;
    return current.progress;
  })() as ProgressValue;

  await updateProgressAndStatus(userId, current.id, progress);

  return current;
}

function parseAssignmentFormData(formData: FormData) {
  const raw = {
    id: formData.get("id")?.toString() || undefined,
    title: formData.get("title")?.toString() ?? "",
    courseId: formData.get("courseId")?.toString() || null,
    dueAt: formData.get("dueAt")?.toString() ?? "",
    submissionTarget: formData.get("submissionTarget")?.toString() || null,
    assignmentType: formData.get("assignmentType")?.toString() ?? "other",
    memo: formData.get("memo")?.toString() || null,
    progress: formData.get("progress")?.toString() ?? "0",
    status: formData.get("status")?.toString() ?? "todo",
    url: formData.get("url")?.toString() || null,
    estimatedHours: formData.get("estimatedHours")?.toString() ?? "1",
    isHeavy: formData.get("isHeavy") === "on",
    tagQuick: formData.get("tagQuick") === "on",
    suggestedSubtasks: formData.get("suggestedSubtasks")?.toString() || null
  };

  return assignmentSchema.parse(raw);
}

export async function saveAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const data = parseAssignmentFormData(formData);

  const tags: AssignmentTag[] = [];
  if (data.isHeavy) tags.push("heavy");
  if (data.tagQuick) tags.push("quick");

  const { assignment } = await saveAssignmentWithIntegrations(
    {
      id: data.id,
      userId: user.id,
      courseId: data.courseId,
      title: data.title,
      dueAt: normalizeDateInput(data.dueAt),
      submissionTarget: data.submissionTarget,
      assignmentType: data.assignmentType as AssignmentType,
      memo: data.memo,
      progress: data.progress as 0 | 25 | 50 | 75 | 100,
      status: data.status,
      url: data.url,
      estimatedHours: data.estimatedHours,
      isHeavy: data.isHeavy,
      tags,
      suggestedSubtasks: data.suggestedSubtasks
        ?.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    },
    undefined,
    {
      deferIntegrations: true
    }
  );

  revalidateAssignmentViews(assignment.id);

  if (data.id) {
    redirect(`/assignments/${assignment.id}`);
  }

  redirect("/assignments");
}

export async function deleteAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Assignment ID is required");
  }

  await deleteAssignmentWithCalendarSync(user.id, id);

  revalidateAssignmentViews(id);

  redirect(`/assignments?deleted=${encodeURIComponent(id)}`);
}

export async function deleteAssignmentInPlaceAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Assignment ID is required");
  }

  await deleteAssignmentWithCalendarSync(user.id, id);
  revalidateAssignmentViews(id);
}

export async function restoreDeletedAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();

  if (!id) {
    redirect("/assignments?restore=not_found");
  }

  const assignment = await restoreAssignmentWithCalendarSync(user.id, id);

  revalidateAssignmentViews(id);

  redirect(`/assignments/${assignment.id}`);
}

export async function setAssignmentProgressAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const progress = Number(formData.get("progress")?.toString() ?? 0);
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    throw new Error("Assignment ID is required");
  }

  await updateProgressAndStatus(user.id, id, progress);

  revalidateHotActionViews({ assignmentId: id, sourcePath });
}

export async function setAssignmentStatusAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const status = assignmentStatusSchema.parse(formData.get("status")?.toString() ?? "todo");
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    throw new Error("Assignment ID is required");
  }

  await saveAssignmentStatus(user.id, id, status);

  revalidateHotActionViews({ assignmentId: id, sourcePath });
}

export async function setAssignmentDueDateAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const dueAt = formData.get("dueAt")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!id || !dueAt) {
    throw new Error("Assignment due date is required");
  }

  await saveAssignmentDueAt(user.id, id, normalizeDateInput(dueAt));

  revalidateHotActionViews({ assignmentId: id, sourcePath });
}

export async function setAssignmentProgressWithUndoAction(
  _previousState: AssignmentQuickActionState,
  formData: FormData
): Promise<AssignmentQuickActionState> {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const progress = Number(formData.get("progress")?.toString() ?? 0);
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    return {
      ...emptyQuickActionState,
      message: "課題を見つけられませんでした。",
      tone: "warning"
    };
  }

  const current = await getAssignmentById(user.id, id);
  if (!current) {
    return {
      ...emptyQuickActionState,
      message: "課題を見つけられませんでした。",
      tone: "warning"
    };
  }

  await updateProgressAndStatus(user.id, id, progress);

  revalidateHotActionViews({ assignmentId: id, sourcePath });

  return {
    message: progress >= 100 ? "課題を完了にしました。" : `進捗を${progress}%にしました。`,
    tone: "success",
    undo: {
      assignmentId: id,
      progress: current.progress,
      type: "progress"
    }
  };
}

export async function restoreAssignmentProgressAction(
  _previousState: AssignmentQuickActionState,
  formData: FormData
): Promise<AssignmentQuickActionState> {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const progress = Number(formData.get("progress")?.toString() ?? 0);
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    return {
      ...emptyQuickActionState,
      message: "課題を見つけられませんでした。",
      tone: "warning"
    };
  }

  await updateProgressAndStatus(user.id, id, progress);

  revalidateHotActionViews({ assignmentId: id, sourcePath });

  return {
    message: "進捗を元に戻しました。",
    tone: "success",
    undo: null
  };
}

export async function postponeAssignmentToTomorrowAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    throw new Error("Assignment ID is required");
  }

  const current = await getAssignmentById(user.id, id);
  if (!current) {
    throw new Error("Assignment not found");
  }

  await saveAssignmentDueAt(user.id, current.id, moveToTomorrowKeepingTime(current.dueAt));

  revalidateHotActionViews({ assignmentId: id, sourcePath });
}

export async function postponeAssignmentToTomorrowWithUndoAction(
  _previousState: AssignmentQuickActionState,
  formData: FormData
): Promise<AssignmentQuickActionState> {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    return {
      ...emptyQuickActionState,
      message: "課題を見つけられませんでした。",
      tone: "warning"
    };
  }

  const current = await getAssignmentById(user.id, id);
  if (!current) {
    return {
      ...emptyQuickActionState,
      message: "課題を見つけられませんでした。",
      tone: "warning"
    };
  }

  await saveAssignmentDueAt(user.id, current.id, moveToTomorrowKeepingTime(current.dueAt));

  revalidateHotActionViews({ assignmentId: id, sourcePath });

  return {
    message: "締切を明日に回しました。",
    tone: "success",
    undo: {
      assignmentId: id,
      dueAt: current.dueAt,
      type: "due"
    }
  };
}

export async function restoreAssignmentDueDateAction(
  _previousState: AssignmentQuickActionState,
  formData: FormData
): Promise<AssignmentQuickActionState> {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const dueAt = formData.get("dueAt")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!id || !dueAt) {
    return {
      ...emptyQuickActionState,
      message: "戻すための締切情報を見つけられませんでした。",
      tone: "warning"
    };
  }

  await saveAssignmentDueAt(user.id, id, dueAt);

  revalidateHotActionViews({ assignmentId: id, sourcePath });

  return {
    message: "締切を元に戻しました。",
    tone: "success",
    undo: null
  };
}

export async function retryAssignmentCalendarSyncAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    throw new Error("Assignment ID is required");
  }

  await retryAssignmentCalendarSync(user.id, id);
  revalidateHotActionViews({ assignmentId: id, sourcePath });
}

export async function startAssignmentWorkSessionAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!id) {
    throw new Error("Assignment ID is required");
  }

  const assignment = await getAssignmentById(user.id, id);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  await createWorkSession({
    userId: user.id,
    assignmentId: id,
    progressBefore: assignment.progress,
    plannedMinutes: 25
  });

  revalidateHotActionViews({ assignmentId: id, sourcePath });
}

export async function startStudyBlockWorkSessionAction(formData: FormData) {
  const user = await requireUser();
  const blockId = formData.get("blockId")?.toString();
  const fallbackAssignmentId = formData.get("assignmentId")?.toString() || null;
  const sourcePath = parseHotSourcePath(formData);

  if (!blockId && !fallbackAssignmentId) {
    console.warn("Study block start skipped: blockId and assignmentId are missing");
    revalidateHotActionViews({ sourcePath });
    return;
  }

  const block = blockId ? await getStudyBlockById(user.id, blockId) : null;
  const assignmentId = block?.assignmentId ?? fallbackAssignmentId;

  if (!assignmentId) {
    console.warn("Study block start skipped: assignmentId could not be resolved", {
      blockId,
      fallbackAssignmentId
    });
    revalidateHotActionViews({ sourcePath });
    return;
  }

  const assignment = await getAssignmentById(user.id, assignmentId);
  if (!assignment) {
    console.warn("Study block start skipped: assignment not found", { assignmentId, blockId });
    revalidateHotActionViews({ assignmentId, sourcePath });
    return;
  }

  try {
    await createWorkSession({
      userId: user.id,
      assignmentId,
      progressBefore: assignment.progress,
      plannedMinutes: block?.durationMinutes ?? 25
    });
  } catch (error) {
    console.error("Study block work session start failed", error);
  }

  if (block) {
    try {
      await updateStudyBlockStatus(user.id, block.id, "started");
    } catch (error) {
      console.error("Study block status update to started failed", error);
    }
  }

  revalidateHotActionViews({ assignmentId, sourcePath });
}

export async function completeStudyBlockAction(formData: FormData) {
  const user = await requireUser();
  const blockId = formData.get("blockId")?.toString();
  const fallbackAssignmentId = formData.get("assignmentId")?.toString() || null;
  const sourcePath = parseHotSourcePath(formData);
  const nextProgress = Number(formData.get("nextProgress")?.toString() ?? NaN);

  if (!blockId && !fallbackAssignmentId) {
    console.warn("Study block completion skipped: blockId and assignmentId are missing");
    revalidateHotActionViews({ sourcePath });
    return;
  }

  const block = blockId ? await getStudyBlockById(user.id, blockId) : null;
  const assignmentId = block?.assignmentId ?? fallbackAssignmentId;

  if (block) {
    try {
      await updateStudyBlockStatus(user.id, block.id, "completed");
    } catch (error) {
      console.error("Study block status update to completed failed", error);
    }
  }

  if (assignmentId) {
    try {
      if (Number.isFinite(nextProgress) && nextProgress >= 0 && nextProgress <= 100) {
        await updateProgressAndStatus(user.id, assignmentId, Math.round(nextProgress));
      } else {
        const assignment = await getAssignmentById(user.id, assignmentId);
        if (assignment && assignment.status !== "done") {
          await updateProgressAndStatus(user.id, assignmentId, Math.min(100, assignment.progress + 25));
        }
      }
    } catch (error) {
      console.error("Assignment progress sync after study block completion failed", error);
    }
  }

  revalidateHotActionViews({ assignmentId: assignmentId ?? undefined, sourcePath });
}

export async function postponeStudyBlockToTomorrowAction(formData: FormData) {
  const user = await requireUser();
  const blockId = formData.get("blockId")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!blockId) {
    console.warn("Study block postpone skipped: blockId is missing");
    revalidateHotActionViews({ sourcePath });
    return;
  }

  const block = await getStudyBlockById(user.id, blockId);
  if (block) {
    try {
      await rescheduleStudyBlock({
        userId: user.id,
        blockId: block.id,
        plannedDate: tomorrowDateKey(),
        startTime: null,
        endTime: null
      });
    } catch (error) {
      console.error("Study block postpone failed", error);
    }
  }

  revalidateHotActionViews({ assignmentId: block?.assignmentId ?? undefined, sourcePath });
}

export async function restoreStudyBlockToPlannedAction(formData: FormData) {
  const user = await requireUser();
  const blockId = formData.get("blockId")?.toString();
  const sourcePath = parseHotSourcePath(formData);

  if (!blockId) {
    console.warn("Study block restore skipped: blockId is missing");
    revalidateHotActionViews({ sourcePath });
    return;
  }

  const block = await getStudyBlockById(user.id, blockId);
  if (block) {
    try {
      await updateStudyBlockStatus(user.id, block.id, "planned");
    } catch (error) {
      console.error("Study block restore to planned failed", error);
    }
  }

  revalidateHotActionViews({ assignmentId: block?.assignmentId ?? undefined, sourcePath });
}

export async function regenerateTodayStudyBlocksAction() {
  const user = await requireUser();

  await regenerateTodayStudyPlan(user.id);
  revalidateAssignmentViews();
}

export async function addAssignmentStepAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = formData.get("assignmentId")?.toString();
  const title = formData.get("title")?.toString().trim();
  const estimatedMinutes = Number(formData.get("estimatedMinutes")?.toString() ?? 25);

  if (!assignmentId || !title) {
    throw new Error("Assignment ID and step title are required");
  }

  const assignment = await getAssignmentById(user.id, assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  await createAssignmentStep({
    userId: user.id,
    assignmentId,
    title,
    estimatedMinutes: Number.isFinite(estimatedMinutes) ? estimatedMinutes : 25
  });

  try {
    await regenerateTodayStudyPlan(user.id);
  } catch (error) {
    console.error("Study plan refresh after step add failed", error);
  }

  revalidateAssignmentViews(assignmentId);
}

export async function toggleAssignmentStepAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = formData.get("assignmentId")?.toString();
  const stepId = formData.get("stepId")?.toString();
  const done = formData.get("done")?.toString() === "1";
  const sourcePath = parseHotSourcePath(formData);
  const nextProgress = Number(formData.get("nextProgress")?.toString() ?? NaN);

  if (!assignmentId || !stepId) {
    console.warn("Assignment step toggle skipped: assignmentId or stepId missing", { assignmentId, stepId });
    revalidateHotActionViews({ assignmentId: assignmentId ?? undefined, sourcePath });
    return;
  }

  let step = null;
  try {
    step = await updateAssignmentStepStatus({
      userId: user.id,
      stepId,
      done
    });
  } catch (error) {
    console.error("Assignment step toggle failed", error);
  }

  const progress = Number.isFinite(nextProgress)
    ? Math.max(0, Math.min(100, Math.round(nextProgress)))
    : null;

  if (step && progress !== null) {
    try {
      await updateProgressAndStatus(user.id, assignmentId, progress);
    } catch (error) {
      // チェックリストの完了切替を最優先し、進捗同期はbest effortにする。
      console.error("Assignment progress sync after step toggle failed", error);
    }
  }

  revalidateHotActionViews({ assignmentId, sourcePath });
}

export async function moveAssignmentStepAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = formData.get("assignmentId")?.toString();
  const stepId = formData.get("stepId")?.toString();
  const direction = formData.get("direction")?.toString() === "down" ? "down" : "up";
  const sourcePath = parseHotSourcePath(formData);

  if (!assignmentId || !stepId) {
    throw new Error("Assignment ID and step ID are required");
  }

  await moveAssignmentStep({
    userId: user.id,
    assignmentId,
    stepId,
    direction
  });

  revalidateHotActionViews({ assignmentId, sourcePath });
}

export async function generateAssignmentStepsAction(formData: FormData) {
  const user = await requireUser();
  const assignmentId = formData.get("assignmentId")?.toString();

  if (!assignmentId) {
    throw new Error("Assignment ID is required");
  }

  const assignment = await getAssignmentById(user.id, assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  await createTemplateAssignmentSteps(user.id, assignment);

  try {
    await regenerateTodayStudyPlan(user.id);
  } catch (error) {
    console.error("Study plan refresh after step generation failed", error);
  }

  revalidateAssignmentViews(assignmentId);
}

export async function completeAssignmentWorkSessionAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const sessionId = formData.get("sessionId")?.toString();
  const progress = Number(formData.get("progress")?.toString() ?? 0);
  const note = formData.get("note")?.toString().trim() || null;

  if (!id || !sessionId) {
    throw new Error("Assignment ID and session ID are required");
  }

  await completeWorkSession({
    userId: user.id,
    sessionId,
    progressAfter: progress,
    note
  });

  await updateProgressAndStatus(user.id, id, progress);
  revalidateAssignmentViews(id);
}

export async function undoCompletedWorkSessionAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  const sessionId = formData.get("sessionId")?.toString();

  if (!id || !sessionId) {
    throw new Error("Assignment ID and session ID are required");
  }

  const session = await cancelWorkSession({
    userId: user.id,
    sessionId
  });

  if (session) {
    await updateProgressAndStatus(user.id, id, session.progressBefore);
  }

  revalidateAssignmentViews(id);
}
