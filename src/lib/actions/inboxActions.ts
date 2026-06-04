"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ASSIGNMENT_TYPES } from "@/lib/constants/domain";
import {
  createInboxItem,
  getInboxItemById,
  updateInboxItem
} from "@/lib/repositories/inboxItemRepository";
import { createAiUsageLogBestEffort } from "@/lib/repositories/aiUsageRepository";
import { saveAssignmentWithIntegrations } from "@/lib/services/assignmentService";
import { parseInboxTextWithUsage } from "@/lib/services/inboxParsingService";
import type {
  AssignmentTag,
  AssignmentType,
  InboxAssignmentCandidate,
  InboxAssignmentCandidateOption,
  InboxSourceType
} from "@/lib/types/domain";

const inboxSourceTypes = ["manual_text", "webclass_text", "screenshot", "pdf", "file", "ai_input"] as const;

const textSchema = z.object({
  rawText: z.string().trim().min(1).max(12000),
  sourceType: z.enum(inboxSourceTypes).default("manual_text")
});

const itemTextSchema = textSchema.extend({
  itemId: z.string().min(1)
});

const assignmentCandidateSchema = z.object({
  itemId: z.string().min(1),
  candidateIndex: z.coerce.number().int().min(0).default(0),
  title: z.string().trim().min(1),
  courseId: z.string().nullable(),
  dueAt: z.string().min(1),
  submissionTarget: z.string().nullable(),
  assignmentType: z.enum(ASSIGNMENT_TYPES),
  memo: z.string().nullable(),
  estimatedHours: z.coerce.number().min(1).max(24),
  isHeavy: z.boolean(),
  tagQuick: z.boolean(),
  suggestedSubtasks: z.string().nullable()
});

function normalizeDateInput(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error("締切日時を確認してください。");
  }
  return date.toISOString();
}

function parseTextFormData(formData: FormData) {
  return textSchema.parse({
    rawText: formData.get("rawText")?.toString() ?? "",
    sourceType: (formData.get("sourceType")?.toString() || "manual_text") as InboxSourceType
  });
}

function parseItemTextFormData(formData: FormData) {
  return itemTextSchema.parse({
    itemId: formData.get("itemId")?.toString() ?? "",
    rawText: formData.get("rawText")?.toString() ?? "",
    sourceType: (formData.get("sourceType")?.toString() || "manual_text") as InboxSourceType
  });
}

function parseAssignmentCandidateFormData(formData: FormData) {
  return assignmentCandidateSchema.parse({
    itemId: formData.get("itemId")?.toString() ?? "",
    candidateIndex: formData.get("candidateIndex")?.toString() ?? "0",
    title: formData.get("title")?.toString() ?? "",
    courseId: formData.get("courseId")?.toString() || null,
    dueAt: formData.get("dueAt")?.toString() ?? "",
    submissionTarget: formData.get("submissionTarget")?.toString() || null,
    assignmentType: formData.get("assignmentType")?.toString() ?? "other",
    memo: formData.get("memo")?.toString() || null,
    estimatedHours: formData.get("estimatedHours")?.toString() ?? "1",
    isHeavy: formData.get("isHeavy") === "on",
    tagQuick: formData.get("tagQuick") === "on",
    suggestedSubtasks: formData.get("suggestedSubtasks")?.toString() || null
  });
}

function revalidateInboxViews() {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/assignments");
}

function getInboxCandidates(candidate: InboxAssignmentCandidate | null): InboxAssignmentCandidateOption[] {
  if (!candidate) {
    return [];
  }

  return [candidate, ...(candidate.alternativeCandidates ?? [])];
}

async function parseAndStoreInboxItem(params: {
  itemId: string;
  rawText: string;
  sourceType: InboxSourceType;
  userId: string;
}) {
  try {
    const parsed = await parseInboxTextWithUsage(params.rawText);
    const candidate = parsed.candidate;
    await createAiUsageLogBestEffort({
      userId: params.userId,
      feature: "inbox_parse",
      model: parsed.usage.model,
      inputTokens: Math.max(1, Math.ceil(params.rawText.length / 4)),
      outputTokens: Math.max(1, Math.ceil(JSON.stringify(candidate).length / 4)),
      creditsUsed: 0,
      status: "success",
      metadata: {
        sourceType: params.sourceType,
        usedAi: parsed.usage.usedAi
      }
    });
    await updateInboxItem({
      id: params.itemId,
      userId: params.userId,
      rawText: params.rawText,
      sourceType: params.sourceType,
      status: "parsed",
      parsedPayload: candidate,
      errorMessage: null
    });
    return "parsed";
  } catch (error) {
    await createAiUsageLogBestEffort({
      userId: params.userId,
      feature: "inbox_parse",
      model: "heuristic-rule-based",
      inputTokens: Math.max(1, Math.ceil(params.rawText.length / 4)),
      outputTokens: null,
      creditsUsed: 0,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Inbox parse failed",
      metadata: {
        sourceType: params.sourceType
      }
    });
    await updateInboxItem({
      id: params.itemId,
      userId: params.userId,
      rawText: params.rawText,
      sourceType: params.sourceType,
      status: "failed",
      parsedPayload: null,
      errorMessage: "うまく整理できませんでした。入力内容はInboxに残っています。"
    });
    console.error("Inbox parse failed", error);
    return "parse_failed";
  }
}

export async function saveInboxTextAction(formData: FormData) {
  const user = await requireUser();
  const data = parseTextFormData(formData);

  const item = await createInboxItem({
    userId: user.id,
    rawText: data.rawText,
    sourceType: data.sourceType,
    status: "unprocessed"
  });

  revalidateInboxViews();

  if (!item) {
    redirect("/inbox?inbox=db_missing");
  }

  redirect("/inbox?inbox=saved");
}

export async function saveAndParseInboxTextAction(formData: FormData) {
  const user = await requireUser();
  const data = parseTextFormData(formData);

  const item = await createInboxItem({
    userId: user.id,
    rawText: data.rawText,
    sourceType: data.sourceType,
    status: "unprocessed"
  });

  if (!item) {
    revalidateInboxViews();
    redirect("/inbox?inbox=db_missing");
  }

  const result = await parseAndStoreInboxItem({
    itemId: item.id,
    rawText: data.rawText,
    sourceType: data.sourceType,
    userId: user.id
  });

  revalidateInboxViews();
  redirect(`/inbox?inbox=${result}`);
}

export async function parseExistingInboxItemAction(formData: FormData) {
  const user = await requireUser();
  const data = parseItemTextFormData(formData);

  const result = await parseAndStoreInboxItem({
    itemId: data.itemId,
    rawText: data.rawText,
    sourceType: data.sourceType,
    userId: user.id
  });

  revalidateInboxViews();
  redirect(`/inbox?inbox=${result}`);
}

export async function saveInboxItemAsAssignmentAction(formData: FormData) {
  const user = await requireUser();
  const data = parseAssignmentCandidateFormData(formData);
  const item = await getInboxItemById(user.id, data.itemId);

  if (!item) {
    redirect("/inbox?inbox=not_found");
  }

  const candidates = getInboxCandidates(item.parsedPayload);
  const selectedCandidate = candidates[data.candidateIndex] ?? null;

  if (!selectedCandidate) {
    redirect("/inbox?inbox=candidate_not_found");
  }

  const existingSavedAssignmentId = item.parsedPayload?.savedCandidateAssignmentIds?.[data.candidateIndex];
  if (existingSavedAssignmentId) {
    redirect(`/assignments/${existingSavedAssignmentId}`);
  }

  const tags: AssignmentTag[] = [];
  if (data.isHeavy) tags.push("heavy");
  if (data.tagQuick) tags.push("quick");

  let createdAssignmentId: string;
  let remainingCandidatesAfterSave: number | null = null;

  try {
    const { assignment } = await saveAssignmentWithIntegrations({
      userId: user.id,
      courseId: data.courseId,
      title: data.title,
      dueAt: normalizeDateInput(data.dueAt),
      submissionTarget: data.submissionTarget,
      assignmentType: data.assignmentType as AssignmentType,
      memo: data.memo,
      progress: 0,
      status: "todo",
      estimatedHours: data.estimatedHours,
      aiSourceText: item.rawText,
      aiConfidence: selectedCandidate.confidence,
      isHeavy: data.isHeavy,
      tags,
      suggestedSubtasks: data.suggestedSubtasks
        ?.split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    }, undefined, {
      deferIntegrations: true
    });

    createdAssignmentId = assignment.id;

    const savedCandidateAssignmentIds = {
      ...(item.parsedPayload?.savedCandidateAssignmentIds ?? {}),
      [data.candidateIndex]: assignment.id
    };
    const allCandidatesSaved = candidates.every((_, index) => Boolean(savedCandidateAssignmentIds[index]));
    const remainingCandidates = candidates.filter((_, index) => !savedCandidateAssignmentIds[index]).length;
    remainingCandidatesAfterSave = allCandidatesSaved ? null : remainingCandidates;

    await updateInboxItem({
      id: item.id,
      userId: user.id,
      status: allCandidatesSaved ? "saved" : "parsed",
      createdAssignmentId: assignment.id,
      parsedPayload: item.parsedPayload
        ? {
            ...item.parsedPayload,
            savedCandidateAssignmentIds
          }
        : null,
      errorMessage: null
    });
  } catch (error) {
    console.error("Inbox assignment save failed", error);
    await updateInboxItem({
      id: item.id,
      userId: user.id,
      status: "failed",
      errorMessage: "課題化に失敗しましたが、入力内容はInboxに残っています。"
    });
    revalidateInboxViews();
    redirect("/inbox?inbox=assignment_failed");
  }

  revalidateInboxViews();
  revalidatePath(`/assignments/${createdAssignmentId}`);
  if (remainingCandidatesAfterSave !== null) {
    redirect(
      `/inbox?inbox=assignment_saved_partial&assignmentId=${createdAssignmentId}&remaining=${remainingCandidatesAfterSave}`
    );
  }
  redirect(`/inbox?inbox=assignment_saved&assignmentId=${createdAssignmentId}`);
}

export async function keepInboxItemAsMemoAction(formData: FormData) {
  const user = await requireUser();
  const itemId = formData.get("itemId")?.toString();

  if (!itemId) {
    redirect("/inbox?inbox=not_found");
  }

  await updateInboxItem({
    id: itemId,
    userId: user.id,
    status: "unprocessed",
    parsedPayload: null,
    errorMessage: null
  });

  revalidateInboxViews();
  redirect("/inbox?inbox=kept");
}

export async function ignoreInboxItemAction(formData: FormData) {
  const user = await requireUser();
  const itemId = formData.get("itemId")?.toString();

  if (!itemId) {
    redirect("/inbox?inbox=not_found");
  }

  await updateInboxItem({
    id: itemId,
    userId: user.id,
    status: "ignored",
    errorMessage: null
  });

  revalidateInboxViews();
  redirect("/inbox?inbox=ignored");
}

export async function restoreInboxItemAction(formData: FormData) {
  const user = await requireUser();
  const itemId = formData.get("itemId")?.toString();

  if (!itemId) {
    redirect("/inbox?inbox=not_found");
  }

  await updateInboxItem({
    id: itemId,
    userId: user.id,
    status: "unprocessed",
    errorMessage: null
  });

  revalidateInboxViews();
  redirect("/inbox?inbox=restored");
}
