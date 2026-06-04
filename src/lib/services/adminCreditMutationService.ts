import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

type CreditBalanceRow = Database["public"]["Tables"]["ai_credit_balances"]["Row"];
type CreditBalanceInsert = Database["public"]["Tables"]["ai_credit_balances"]["Insert"];
type CreditBalanceUpdate = Database["public"]["Tables"]["ai_credit_balances"]["Update"];

export type AdminCreditMutationInput = {
  adminUserId: string;
  adminEmail: string | null;
  targetUserId: string;
  monthKey: string;
  reason: string;
  remainingDelta: number;
  nextMonthlyLimitOverride?: number | null;
  nextPlan?: "free" | "plus" | "pro" | null;
};

export type AdminCreditMutationResult =
  | { ok: true }
  | {
      ok: false;
      code: "admin_client_unavailable" | "balance_table_missing" | "invalid_input" | "unknown_error";
      message: string;
    };

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "42P01" || /does not exist|relation/i.test(maybe.message ?? "");
}

function safePlan(value: string | null | undefined): "free" | "plus" | "pro" {
  if (value === "plus" || value === "pro") return value;
  return "free";
}

async function insertAuditLogIfAvailable(payload: Record<string, unknown>) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const result = await (admin as unknown as {
    from: (name: string) => { insert: (data: Record<string, unknown>) => Promise<{ error: { message?: string; code?: string } | null }> };
  })
    .from("ai_credit_admin_logs")
    .insert(payload);

  if (result.error && !isMissingRelationError(result.error)) {
    console.error("AI credit audit log insert failed", result.error);
  }
}

export async function applyAdminCreditMutation(input: AdminCreditMutationInput): Promise<AdminCreditMutationResult> {
  if (!input.targetUserId || !input.monthKey || !input.reason.trim()) {
    return { ok: false, code: "invalid_input", message: "対象ユーザー・対象月・変更理由は必須です。" };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, code: "admin_client_unavailable", message: "Supabase管理クライアントが未設定です。" };
  }

  const { data: currentRow, error: currentError } = await admin
    .from("ai_credit_balances")
    .select("*")
    .eq("user_id", input.targetUserId)
    .eq("month_key", input.monthKey)
    .maybeSingle();

  if (currentError) {
    if (isMissingRelationError(currentError)) {
      return { ok: false, code: "balance_table_missing", message: "ai_credit_balances テーブルが未適用です。" };
    }
    return { ok: false, code: "unknown_error", message: `クレジット残高の読取に失敗しました: ${currentError.message}` };
  }

  const now = new Date().toISOString();
  const existing = (currentRow as CreditBalanceRow | null) ?? {
    id: crypto.randomUUID(),
    user_id: input.targetUserId,
    month_key: input.monthKey,
    plan: "free",
    monthly_limit: 15,
    credits_used: 0,
    created_at: now,
    updated_at: now
  };

  if (!currentRow) {
    const insertPayload: CreditBalanceInsert = {
      user_id: existing.user_id,
      month_key: existing.month_key,
      plan: safePlan(existing.plan),
      monthly_limit: Math.max(0, existing.monthly_limit),
      credits_used: Math.max(0, existing.credits_used)
    };

    const { error: insertError } = await admin.from("ai_credit_balances").insert(insertPayload);
    if (insertError) {
      return { ok: false, code: "unknown_error", message: `初期残高の作成に失敗しました: ${insertError.message}` };
    }
  }

  const beforePlan = safePlan(existing.plan);
  const beforeMonthlyLimit = Math.max(0, existing.monthly_limit);
  const beforeCreditsUsed = Math.max(0, existing.credits_used);
  const beforeRemaining = Math.max(0, beforeMonthlyLimit - beforeCreditsUsed);
  const nextPlan = input.nextPlan ? safePlan(input.nextPlan) : beforePlan;
  const nextMonthlyLimit =
    typeof input.nextMonthlyLimitOverride === "number" && Number.isFinite(input.nextMonthlyLimitOverride)
      ? Math.max(0, Math.round(input.nextMonthlyLimitOverride))
      : beforeMonthlyLimit;

  const requestedRemaining = Math.max(0, beforeRemaining + Math.round(input.remainingDelta));
  const nextRemaining = Math.min(requestedRemaining, nextMonthlyLimit);
  const nextCreditsUsed = Math.max(0, nextMonthlyLimit - nextRemaining);

  const updatePayload: CreditBalanceUpdate = {
    plan: nextPlan,
    monthly_limit: nextMonthlyLimit,
    credits_used: nextCreditsUsed,
    updated_at: now
  };

  const { error: updateError } = await admin
    .from("ai_credit_balances")
    .update(updatePayload)
    .eq("user_id", input.targetUserId)
    .eq("month_key", input.monthKey);

  if (updateError) {
    return { ok: false, code: "unknown_error", message: `クレジット更新に失敗しました: ${updateError.message}` };
  }

  await insertAuditLogIfAvailable({
    admin_user_id: input.adminUserId,
    admin_email: input.adminEmail ?? null,
    target_user_id: input.targetUserId,
    month_key: input.monthKey,
    reason: input.reason.trim(),
    action: input.remainingDelta > 0 ? "add_credits" : input.remainingDelta < 0 ? "decrease_credits" : "update_credit_policy",
    before_plan: beforePlan,
    after_plan: nextPlan,
    before_monthly_limit: beforeMonthlyLimit,
    after_monthly_limit: nextMonthlyLimit,
    before_credits_used: beforeCreditsUsed,
    after_credits_used: nextCreditsUsed,
    before_credits_remaining: beforeRemaining,
    after_credits_remaining: Math.max(0, nextMonthlyLimit - nextCreditsUsed),
    created_at: now
  });

  return { ok: true };
}
