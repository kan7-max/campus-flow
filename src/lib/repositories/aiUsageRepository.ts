import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Database, Json } from "@/lib/types/database";
import type { AiUsageFeature, AiUsageLog, AiUsageLogInput, AiUsageStatus } from "@/lib/types/domain";

type AiUsageLogRow = Database["public"]["Tables"]["ai_usage_logs"]["Row"];

const features: AiUsageFeature[] = [
  "assignment_extract",
  "daily_strategy_generate",
  "file_text_extract",
  "inbox_parse",
  "step_generate",
  "study_plan_generate"
];

const statuses: AiUsageStatus[] = ["failed", "fallback", "success"];

function isMissingAiUsageLogsTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /ai_usage_logs/i.test(maybeError.message ?? "");
}

function mapAiUsageLog(row: AiUsageLogRow): AiUsageLog {
  return {
    id: row.id,
    userId: row.user_id,
    feature: features.includes(row.feature as AiUsageFeature) ? (row.feature as AiUsageFeature) : "assignment_extract",
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    creditsUsed: row.credits_used,
    status: statuses.includes(row.status as AiUsageStatus) ? (row.status as AiUsageStatus) : "failed",
    errorMessage: row.error_message,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: row.created_at
  };
}

export async function createAiUsageLog(input: AiUsageLogInput): Promise<AiUsageLog | null> {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const creditsUsed = Math.max(0, Math.round(input.creditsUsed ?? 0));

  if (!supabase) {
    const store = getMockStore();
    const log: AiUsageLog = {
      id: crypto.randomUUID(),
      userId: input.userId,
      feature: input.feature,
      model: input.model,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      creditsUsed,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      metadata: input.metadata ?? {},
      createdAt: now
    };
    store.aiUsageLogs.push(log);
    persistMockStore(store);
    return log;
  }

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .insert({
      user_id: input.userId,
      feature: input.feature,
      model: input.model,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      credits_used: creditsUsed,
      status: input.status,
      error_message: input.errorMessage ?? null,
      metadata: (input.metadata ?? {}) as Json
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingAiUsageLogsTable(error)) {
      return null;
    }
    throw new Error(`Failed to create AI usage log: ${error.message}`);
  }

  return mapAiUsageLog(data as AiUsageLogRow);
}

export async function createAiUsageLogBestEffort(input: AiUsageLogInput): Promise<void> {
  try {
    await createAiUsageLog(input);
  } catch (error) {
    console.error("AI usage log failed", error);
  }
}
