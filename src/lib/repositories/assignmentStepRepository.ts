import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Database } from "@/lib/types/database";
import type { AssignmentStep, AssignmentStepInsertInput, AssignmentStepStatus, Subtask } from "@/lib/types/domain";

type AssignmentStepRow = Database["public"]["Tables"]["assignment_steps"]["Row"];
type AssignmentStepInsert = Database["public"]["Tables"]["assignment_steps"]["Insert"];

function mapAssignmentStep(row: AssignmentStepRow): AssignmentStep {
  return {
    id: row.id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    title: row.title,
    description: row.description,
    status: row.status as AssignmentStepStatus,
    estimatedMinutes: row.estimated_minutes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapLegacySubtask(userId: string, subtask: Subtask): AssignmentStep {
  return {
    id: `legacy-${subtask.id}`,
    userId,
    assignmentId: subtask.assignmentId,
    title: subtask.title,
    description: null,
    status: subtask.done ? "done" : "todo",
    estimatedMinutes: 25,
    sortOrder: subtask.orderIndex,
    createdAt: subtask.createdAt,
    updatedAt: subtask.updatedAt
  };
}

function toInsertPayload(input: AssignmentStepInsertInput): AssignmentStepInsert {
  return {
    user_id: input.userId,
    assignment_id: input.assignmentId,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "todo",
    estimated_minutes: input.estimatedMinutes ?? 25,
    sort_order: input.sortOrder ?? 0
  };
}

function isMissingAssignmentStepsTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /assignment_steps/i.test(maybeError.message ?? "");
}

function hasAssignmentOwner(userId: string, assignmentId: string) {
  const store = getMockStore();
  return store.assignments.some((assignment) => assignment.userId === userId && assignment.id === assignmentId);
}

function sortSteps(a: AssignmentStep, b: AssignmentStep) {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }

  return a.createdAt.localeCompare(b.createdAt);
}

export async function listAssignmentSteps(userId: string, assignmentId: string): Promise<AssignmentStep[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const steps = store.assignmentSteps
      .filter((step) => step.userId === userId && step.assignmentId === assignmentId)
      .sort(sortSteps);

    if (steps.length > 0) {
      return steps;
    }

    return store.subtasks
      .filter((subtask) => subtask.assignmentId === assignmentId && hasAssignmentOwner(userId, assignmentId))
      .map((subtask) => mapLegacySubtask(userId, subtask))
      .sort(sortSteps);
  }

  const { data, error } = await supabase
    .from("assignment_steps")
    .select("*")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingAssignmentStepsTable(error)) {
      return [];
    }
    throw new Error(`Failed to list assignment steps: ${error.message}`);
  }

  return (data as AssignmentStepRow[]).map(mapAssignmentStep);
}

export async function createAssignmentStep(input: AssignmentStepInsertInput): Promise<AssignmentStep | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    if (!hasAssignmentOwner(input.userId, input.assignmentId)) {
      throw new Error("Assignment not found");
    }

    const store = getMockStore();
    const current = store.assignmentSteps.filter(
      (step) => step.userId === input.userId && step.assignmentId === input.assignmentId
    );
    const step: AssignmentStep = {
      id: crypto.randomUUID(),
      userId: input.userId,
      assignmentId: input.assignmentId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      estimatedMinutes: input.estimatedMinutes ?? 25,
      sortOrder: input.sortOrder ?? current.length,
      createdAt: now,
      updatedAt: now
    };

    store.assignmentSteps.push(step);
    persistMockStore(store);
    return step;
  }

  const existing = await listAssignmentSteps(input.userId, input.assignmentId);
  const payload = toInsertPayload({
    ...input,
    sortOrder: input.sortOrder ?? existing.length
  });

  const { data, error } = await supabase
    .from("assignment_steps")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (isMissingAssignmentStepsTable(error)) {
      return null;
    }
    throw new Error(`Failed to create assignment step: ${error.message}`);
  }

  return mapAssignmentStep(data as AssignmentStepRow);
}

export async function createAssignmentSteps(
  userId: string,
  assignmentId: string,
  inputs: Array<Omit<AssignmentStepInsertInput, "assignmentId" | "userId">>
): Promise<AssignmentStep[]> {
  const created: AssignmentStep[] = [];
  const existing = await listAssignmentSteps(userId, assignmentId);
  const existingTitles = new Set(existing.map((step) => step.title.trim().toLowerCase()));
  let sortOrder = existing.length;

  for (const input of inputs) {
    const title = input.title.trim();
    if (!title || existingTitles.has(title.toLowerCase())) {
      continue;
    }

    const step = await createAssignmentStep({
      ...input,
      assignmentId,
      userId,
      title,
      sortOrder
    });

    if (step) {
      created.push(step);
      existingTitles.add(title.toLowerCase());
      sortOrder += 1;
    }
  }

  return created;
}

export async function updateAssignmentStepStatus(params: {
  done: boolean;
  stepId: string;
  userId: string;
}): Promise<AssignmentStep | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const status: AssignmentStepStatus = params.done ? "done" : "todo";

  if (!supabase) {
    const store = getMockStore();
    const step = store.assignmentSteps.find((item) => item.userId === params.userId && item.id === params.stepId);
    if (step) {
      step.status = status;
      step.updatedAt = now;
      persistMockStore(store);
      return step;
    }

    if (params.stepId.startsWith("legacy-")) {
      const subtaskId = params.stepId.slice("legacy-".length);
      const subtask = store.subtasks.find((item) => item.id === subtaskId);
      if (!subtask || !hasAssignmentOwner(params.userId, subtask.assignmentId)) {
        return null;
      }

      subtask.done = params.done;
      subtask.updatedAt = now;
      persistMockStore(store);
      return mapLegacySubtask(params.userId, subtask);
    }

    return null;
  }

  const { data, error } = await supabase
    .from("assignment_steps")
    .update({ status, updated_at: now })
    .eq("id", params.stepId)
    .eq("user_id", params.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingAssignmentStepsTable(error)) {
      return null;
    }
    throw new Error(`Failed to update assignment step: ${error.message}`);
  }

  return data ? mapAssignmentStep(data as AssignmentStepRow) : null;
}

export async function moveAssignmentStep(params: {
  assignmentId: string;
  direction: "down" | "up";
  stepId: string;
  userId: string;
}): Promise<void> {
  const steps = await listAssignmentSteps(params.userId, params.assignmentId);
  const index = steps.findIndex((step) => step.id === params.stepId);
  const swapIndex = params.direction === "up" ? index - 1 : index + 1;

  if (index < 0 || swapIndex < 0 || swapIndex >= steps.length) {
    return;
  }

  const current = steps[index];
  const target = steps[swapIndex];
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const currentStep = store.assignmentSteps.find((step) => step.id === current.id && step.userId === params.userId);
    const targetStep = store.assignmentSteps.find((step) => step.id === target.id && step.userId === params.userId);
    if (!currentStep || !targetStep) {
      return;
    }

    [currentStep.sortOrder, targetStep.sortOrder] = [targetStep.sortOrder, currentStep.sortOrder];
    const now = new Date().toISOString();
    currentStep.updatedAt = now;
    targetStep.updatedAt = now;
    persistMockStore(store);
    return;
  }

  const now = new Date().toISOString();
  const updates = [
    supabase
      .from("assignment_steps")
      .update({ sort_order: target.sortOrder, updated_at: now })
      .eq("id", current.id)
      .eq("user_id", params.userId),
    supabase
      .from("assignment_steps")
      .update({ sort_order: current.sortOrder, updated_at: now })
      .eq("id", target.id)
      .eq("user_id", params.userId)
  ];

  const results = await Promise.all(updates);
  const error = results.find((result) => result.error)?.error;
  if (error) {
    if (isMissingAssignmentStepsTable(error)) {
      return;
    }
    throw new Error(`Failed to move assignment step: ${error.message}`);
  }
}
