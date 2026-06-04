import { ASSIGNMENT_TAGS, ASSIGNMENT_TYPES } from "@/lib/constants/domain";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/types/database";
import type {
  AssignmentTag,
  AssignmentType,
  InboxAssignmentCandidate,
  InboxAssignmentCandidateOption,
  InboxItem,
  InboxItemInsertInput,
  InboxSourceType,
  InboxStatus
} from "@/lib/types/domain";

type InboxItemRow = Database["public"]["Tables"]["inbox_items"]["Row"];
type InboxItemInsert = Database["public"]["Tables"]["inbox_items"]["Insert"];
type InboxItemUpdate = Database["public"]["Tables"]["inbox_items"]["Update"];

const openInboxStatuses: InboxStatus[] = ["unprocessed", "parsed", "failed"];
const sourceTypes: InboxSourceType[] = ["manual_text", "webclass_text", "screenshot", "pdf", "file", "ai_input"];
const statuses: InboxStatus[] = ["unprocessed", "parsed", "saved", "ignored", "failed"];

function isMissingInboxItemsTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /inbox_items/i.test(maybeError.message ?? "");
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asAssignmentType(value: unknown): AssignmentType {
  return typeof value === "string" && ASSIGNMENT_TYPES.includes(value as AssignmentType)
    ? (value as AssignmentType)
    : "other";
}

function asTags(value: unknown): AssignmentTag[] {
  const tags = asStringArray(value);
  return tags.filter((tag): tag is AssignmentTag => ASSIGNMENT_TAGS.includes(tag as AssignmentTag));
}

function mapCandidatePayload(value: unknown): InboxAssignmentCandidateOption | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const title = asString(payload.title).trim();
  if (!title) {
    return null;
  }

  return {
    title,
    courseName: asNullableString(payload.courseName),
    dueAt: asNullableString(payload.dueAt),
    submissionTarget: asNullableString(payload.submissionTarget),
    assignmentType: asAssignmentType(payload.assignmentType),
    memo: asNullableString(payload.memo),
    estimatedHours: Math.max(1, Math.min(24, Math.round(asNumber(payload.estimatedHours, 1)))),
    isHeavy: payload.isHeavy === true,
    tags: asTags(payload.tags),
    confidence: Math.max(0, Math.min(1, asNumber(payload.confidence, 0.5))),
    suggestedSubtasks: asStringArray(payload.suggestedSubtasks).map((item) => item.trim()).filter(Boolean),
    warnings: asStringArray(payload.warnings).map((item) => item.trim()).filter(Boolean)
  };
}

function mapParsedPayload(value: Json | null): InboxAssignmentCandidate | null {
  const primary = mapCandidatePayload(value);
  if (!primary || !value || typeof value !== "object" || Array.isArray(value)) {
    return primary;
  }

  const payload = value as Record<string, unknown>;
  const alternativeCandidates = Array.isArray(payload.alternativeCandidates)
    ? payload.alternativeCandidates
        .map(mapCandidatePayload)
        .filter((item): item is InboxAssignmentCandidateOption => Boolean(item))
    : [];
  const savedCandidateAssignmentIds =
    payload.savedCandidateAssignmentIds && typeof payload.savedCandidateAssignmentIds === "object" && !Array.isArray(payload.savedCandidateAssignmentIds)
      ? Object.fromEntries(
          Object.entries(payload.savedCandidateAssignmentIds).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        )
      : undefined;

  return {
    ...primary,
    alternativeCandidates,
    savedCandidateAssignmentIds
  };
}

function mapInboxItem(row: InboxItemRow): InboxItem {
  const sourceType = sourceTypes.includes(row.source_type as InboxSourceType)
    ? (row.source_type as InboxSourceType)
    : "manual_text";
  const status = statuses.includes(row.status as InboxStatus) ? (row.status as InboxStatus) : "unprocessed";

  return {
    id: row.id,
    userId: row.user_id,
    rawText: row.raw_text,
    sourceType,
    status,
    parsedPayload: mapParsedPayload(row.parsed_payload),
    createdAssignmentId: row.created_assignment_id,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toInsertPayload(input: InboxItemInsertInput): InboxItemInsert {
  return {
    user_id: input.userId,
    raw_text: input.rawText,
    source_type: input.sourceType ?? "manual_text",
    status: input.status ?? "unprocessed",
    parsed_payload: (input.parsedPayload ?? null) as unknown as Json | null,
    error_message: input.errorMessage ?? null
  };
}

function sortInboxItems(a: InboxItem, b: InboxItem) {
  return b.createdAt.localeCompare(a.createdAt);
}

export async function listInboxItems(userId: string, limit = 40): Promise<InboxItem[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.inboxItems
      .filter((item) => item.userId === userId)
      .sort(sortInboxItems)
      .slice(0, limit);
  }

  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingInboxItemsTable(error)) {
      return [];
    }
    throw new Error(`Failed to list inbox items: ${error.message}`);
  }

  return (data as InboxItemRow[]).map(mapInboxItem);
}

export async function countOpenInboxItems(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.inboxItems.filter((item) => item.userId === userId && openInboxStatuses.includes(item.status)).length;
  }

  const { count, error } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", openInboxStatuses);

  if (error) {
    if (isMissingInboxItemsTable(error)) {
      return 0;
    }
    throw new Error(`Failed to count inbox items: ${error.message}`);
  }

  return count ?? 0;
}

export async function getInboxItemById(userId: string, inboxItemId: string): Promise<InboxItem | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.inboxItems.find((item) => item.userId === userId && item.id === inboxItemId) ?? null;
  }

  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("id", inboxItemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingInboxItemsTable(error)) {
      return null;
    }
    throw new Error(`Failed to fetch inbox item: ${error.message}`);
  }

  return data ? mapInboxItem(data as InboxItemRow) : null;
}

export async function createInboxItem(input: InboxItemInsertInput): Promise<InboxItem | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const item: InboxItem = {
      id: crypto.randomUUID(),
      userId: input.userId,
      rawText: input.rawText,
      sourceType: input.sourceType ?? "manual_text",
      status: input.status ?? "unprocessed",
      parsedPayload: input.parsedPayload ?? null,
      createdAssignmentId: null,
      errorMessage: input.errorMessage ?? null,
      createdAt: now,
      updatedAt: now
    };

    store.inboxItems.push(item);
    persistMockStore(store);
    return item;
  }

  const { data, error } = await supabase
    .from("inbox_items")
    .insert(toInsertPayload(input))
    .select("*")
    .single();

  if (error) {
    if (isMissingInboxItemsTable(error)) {
      return null;
    }
    throw new Error(`Failed to create inbox item: ${error.message}`);
  }

  return mapInboxItem(data as InboxItemRow);
}

export async function updateInboxItem(params: {
  createdAssignmentId?: string | null;
  errorMessage?: string | null;
  id: string;
  parsedPayload?: InboxAssignmentCandidate | null;
  rawText?: string;
  sourceType?: InboxSourceType;
  status?: InboxStatus;
  userId: string;
}): Promise<InboxItem | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const item = store.inboxItems.find((current) => current.userId === params.userId && current.id === params.id);
    if (!item) {
      return null;
    }

    if ("rawText" in params && params.rawText !== undefined) item.rawText = params.rawText;
    if ("sourceType" in params && params.sourceType) item.sourceType = params.sourceType;
    if ("status" in params && params.status) item.status = params.status;
    if ("parsedPayload" in params) item.parsedPayload = params.parsedPayload ?? null;
    if ("createdAssignmentId" in params) item.createdAssignmentId = params.createdAssignmentId ?? null;
    if ("errorMessage" in params) item.errorMessage = params.errorMessage ?? null;
    item.updatedAt = now;
    persistMockStore(store);
    return item;
  }

  const payload: InboxItemUpdate = {
    updated_at: now
  };

  if ("rawText" in params && params.rawText !== undefined) payload.raw_text = params.rawText;
  if ("sourceType" in params && params.sourceType) payload.source_type = params.sourceType;
  if ("status" in params && params.status) payload.status = params.status;
  if ("parsedPayload" in params) payload.parsed_payload = (params.parsedPayload ?? null) as unknown as Json | null;
  if ("createdAssignmentId" in params) payload.created_assignment_id = params.createdAssignmentId ?? null;
  if ("errorMessage" in params) payload.error_message = params.errorMessage ?? null;

  const { data, error } = await supabase
    .from("inbox_items")
    .update(payload)
    .eq("id", params.id)
    .eq("user_id", params.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (isMissingInboxItemsTable(error)) {
      return null;
    }
    throw new Error(`Failed to update inbox item: ${error.message}`);
  }

  return data ? mapInboxItem(data as InboxItemRow) : null;
}
