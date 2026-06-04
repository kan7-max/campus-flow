import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Database } from "@/lib/types/database";
import type { StudyBlock, StudyBlockInsertInput, StudyBlockStatus } from "@/lib/types/domain";

type StudyBlockRow = Database["public"]["Tables"]["study_blocks"]["Row"];
type StudyBlockInsert = Database["public"]["Tables"]["study_blocks"]["Insert"];

function mapStudyBlock(row: StudyBlockRow): StudyBlock {
  return {
    id: row.id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    plannedDate: row.planned_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    status: row.status as StudyBlock["status"],
    source: row.source as StudyBlock["source"],
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toInsertPayload(input: StudyBlockInsertInput): StudyBlockInsert {
  return {
    user_id: input.userId,
    assignment_id: input.assignmentId ?? null,
    course_id: input.courseId ?? null,
    title: input.title,
    description: input.description ?? null,
    planned_date: input.plannedDate,
    start_time: input.startTime ?? null,
    end_time: input.endTime ?? null,
    duration_minutes: input.durationMinutes ?? 25,
    status: input.status ?? "planned",
    source: input.source ?? "rule_based",
    priority: input.priority ?? 0
  };
}

function isMissingStudyBlocksTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /study_blocks/i.test(maybeError.message ?? "");
}

function sortStudyBlocks(a: StudyBlock, b: StudyBlock) {
  if (a.plannedDate !== b.plannedDate) {
    return a.plannedDate.localeCompare(b.plannedDate);
  }

  const aTime = a.startTime ?? "99:99";
  const bTime = b.startTime ?? "99:99";
  if (aTime !== bTime) {
    return aTime.localeCompare(bTime);
  }

  return b.priority - a.priority;
}

export async function listStudyBlocksForDate(userId: string, plannedDate: string): Promise<StudyBlock[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.studyBlocks
      .filter((block) => block.userId === userId && block.plannedDate === plannedDate)
      .sort(sortStudyBlocks);
  }

  const { data, error } = await supabase
    .from("study_blocks")
    .select("*")
    .eq("user_id", userId)
    .eq("planned_date", plannedDate)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });

  if (error) {
    if (isMissingStudyBlocksTable(error)) {
      return [];
    }
    throw new Error(`Failed to list study blocks: ${error.message}`);
  }

  return (data as StudyBlockRow[]).map(mapStudyBlock);
}

export async function listStudyBlocksForAssignment(
  userId: string,
  assignmentId: string,
  limit = 8
): Promise<StudyBlock[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.studyBlocks
      .filter((block) => block.userId === userId && block.assignmentId === assignmentId)
      .sort(sortStudyBlocks)
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("study_blocks")
    .select("*")
    .eq("user_id", userId)
    .eq("assignment_id", assignmentId)
    .order("planned_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    if (isMissingStudyBlocksTable(error)) {
      return [];
    }
    throw new Error(`Failed to list assignment study blocks: ${error.message}`);
  }

  return (data as StudyBlockRow[]).map(mapStudyBlock);
}

export async function getStudyBlockById(userId: string, blockId: string): Promise<StudyBlock | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.studyBlocks.find((block) => block.userId === userId && block.id === blockId) ?? null;
  }

  const { data, error } = await supabase
    .from("study_blocks")
    .select("*")
    .eq("user_id", userId)
    .eq("id", blockId)
    .maybeSingle();

  if (error) {
    if (isMissingStudyBlocksTable(error)) {
      return null;
    }
    throw new Error(`Failed to fetch study block: ${error.message}`);
  }

  return data ? mapStudyBlock(data as StudyBlockRow) : null;
}

export async function replaceRuleBasedStudyBlocksForDate(
  userId: string,
  plannedDate: string,
  inputs: StudyBlockInsertInput[]
): Promise<StudyBlock[]> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    store.studyBlocks = store.studyBlocks.filter(
      (block) => !(block.userId === userId && block.plannedDate === plannedDate && block.source === "rule_based")
    );

    const blocks = inputs.map((input) => ({
      id: crypto.randomUUID(),
      userId: input.userId,
      assignmentId: input.assignmentId ?? null,
      courseId: input.courseId ?? null,
      title: input.title,
      description: input.description ?? null,
      plannedDate: input.plannedDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      durationMinutes: input.durationMinutes ?? 25,
      status: input.status ?? "planned",
      source: input.source ?? "rule_based",
      priority: input.priority ?? 0,
      createdAt: now,
      updatedAt: now
    })) satisfies StudyBlock[];

    store.studyBlocks.push(...blocks);
    persistMockStore(store);
    return blocks.sort(sortStudyBlocks);
  }

  const { error: deleteError } = await supabase
    .from("study_blocks")
    .delete()
    .eq("user_id", userId)
    .eq("planned_date", plannedDate)
    .eq("source", "rule_based");

  if (deleteError) {
    if (isMissingStudyBlocksTable(deleteError)) {
      return [];
    }
    throw new Error(`Failed to clear study blocks: ${deleteError.message}`);
  }

  if (inputs.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("study_blocks")
    .insert(inputs.map(toInsertPayload))
    .select("*");

  if (error) {
    if (isMissingStudyBlocksTable(error)) {
      return [];
    }
    throw new Error(`Failed to create study blocks: ${error.message}`);
  }

  return (data as StudyBlockRow[]).map(mapStudyBlock).sort(sortStudyBlocks);
}

export async function updateStudyBlockStatus(
  userId: string,
  blockId: string,
  status: StudyBlockStatus
): Promise<StudyBlock | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const block = store.studyBlocks.find((item) => item.userId === userId && item.id === blockId);
    if (!block) {
      return null;
    }

    block.status = status;
    block.updatedAt = now;
    persistMockStore(store);
    return block;
  }

  const { data, error } = await supabase
    .from("study_blocks")
    .update({ status, updated_at: now })
    .eq("id", blockId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingStudyBlocksTable(error)) {
      return null;
    }
    throw new Error(`Failed to update study block: ${error.message}`);
  }

  return data ? mapStudyBlock(data as StudyBlockRow) : null;
}

export async function rescheduleStudyBlock(params: {
  blockId: string;
  endTime?: string | null;
  plannedDate: string;
  startTime?: string | null;
  userId: string;
}): Promise<StudyBlock | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const block = store.studyBlocks.find((item) => item.userId === params.userId && item.id === params.blockId);
    if (!block) {
      return null;
    }

    block.plannedDate = params.plannedDate;
    block.startTime = params.startTime ?? null;
    block.endTime = params.endTime ?? null;
    block.status = "planned";
    block.updatedAt = now;
    persistMockStore(store);
    return block;
  }

  const { data, error } = await supabase
    .from("study_blocks")
    .update({
      planned_date: params.plannedDate,
      start_time: params.startTime ?? null,
      end_time: params.endTime ?? null,
      status: "planned",
      updated_at: now
    })
    .eq("id", params.blockId)
    .eq("user_id", params.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingStudyBlocksTable(error)) {
      return null;
    }
    throw new Error(`Failed to reschedule study block: ${error.message}`);
  }

  return data ? mapStudyBlock(data as StudyBlockRow) : null;
}
