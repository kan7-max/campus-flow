import "server-only";
import { isGoogleCalendarOAuthEnabled, isOpenAiEnabled, isSupabaseEnabled } from "@/lib/env";
import { getMockStore } from "@/lib/mock/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

type CountValue = number | null;

type ServiceStatus = "configured" | "not_configured" | "candidate";

type CreditBalanceRow = Database["public"]["Tables"]["ai_credit_balances"]["Row"];
type CreditBalanceInsert = Database["public"]["Tables"]["ai_credit_balances"]["Insert"];
type CreditBalanceUpdate = Database["public"]["Tables"]["ai_credit_balances"]["Update"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export type AdminOverviewMetrics = {
  registeredUsers: CountValue;
  assignmentSaves: CountValue;
  aiExtractionCount: CountValue;
  aiExtractionSuccessApprox: CountValue;
  aiExtractionFailedApprox: CountValue;
  calendarSyncSuccessApprox: CountValue;
  calendarSyncFailedApprox: CountValue;
  appErrorApprox: CountValue;
  inquiryCountMemo: string;
  deletionRequestMemo: string;
  openAiUsageMemo: string;
  supabaseUsageMemo: string;
  vercelUsageMemo: string;
};

export type AdminServiceChecks = {
  openAi: ServiceStatus;
  googleOAuthCalendar: ServiceStatus;
  supabase: ServiceStatus;
  sentry: ServiceStatus;
  posthog: ServiceStatus;
  resend: ServiceStatus;
  stripe: ServiceStatus;
  vercelEnv: "manual_check";
  notes: string[];
};

export type AdminCreditRow = {
  userId: string;
  email: string | null;
  monthKey: string;
  plan: "free" | "plus" | "pro";
  monthlyLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
  isTestUser: boolean;
  updatedAt: string;
};

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
  | { ok: true; after: AdminCreditRow; before: AdminCreditRow }
  | { ok: false; code: "admin_client_unavailable" | "audit_log_missing" | "balance_table_missing" | "invalid_input" | "unknown_error"; message: string };

const EXTRACT_FEATURES = ["assignment_extract", "file_text_extract", "inbox_parse"];

function hasConfiguredValue(value: string | undefined) {
  if (!value) {
    return false;
  }
  return !/^(YOUR_|example$|changeme$|placeholder$)/i.test(value.trim());
}

function isMissingRelationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "42P01" || /does not exist|relation/i.test(maybe.message ?? "");
}

function safePlan(value: string): "free" | "plus" | "pro" {
  if (value === "plus" || value === "pro") {
    return value;
  }
  return "free";
}

function toCreditRow(row: CreditBalanceRow, email: string | null): AdminCreditRow {
  const monthlyLimit = Math.max(0, row.monthly_limit);
  const creditsUsed = Math.max(0, row.credits_used);
  return {
    userId: row.user_id,
    email,
    monthKey: row.month_key,
    plan: safePlan(row.plan),
    monthlyLimit,
    creditsUsed,
    creditsRemaining: Math.max(0, monthlyLimit - creditsUsed),
    isTestUser: row.user_id === "demo-user" || (email ?? "").toLowerCase().endsWith("@example.com"),
    updatedAt: row.updated_at
  };
}

type CountFilterQuery = {
  eq: (column: string, value: unknown) => CountFilterQuery;
  in: (column: string, values: unknown[]) => CountFilterQuery;
  is: (column: string, value: unknown) => CountFilterQuery;
} & Promise<{ count: number | null; error: { message: string; code?: string } | null }>;

async function safeCount(
  table: string,
  configure?: (query: CountFilterQuery) => CountFilterQuery
) {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  try {
    const baseQuery = admin.from(table).select("id", { count: "exact", head: true }) as unknown as CountFilterQuery;
    const finalQuery = configure ? configure(baseQuery) : baseQuery;
    const { count, error } = await (finalQuery as Promise<{ count: number | null; error: { message: string; code?: string } | null }>);
    if (error) {
      if (isMissingRelationError(error)) {
        return null;
      }
      console.error(`Admin count failed: ${table}`, error);
      return null;
    }
    return count ?? 0;
  } catch (error) {
    console.error(`Admin count failed: ${table}`, error);
    return null;
  }
}

async function loadSupabaseConnectionStatus() {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return false;
  }

  const { error } = await admin.from("users").select("id").limit(1);
  if (error && !isMissingRelationError(error)) {
    return false;
  }
  return true;
}

function getMockOverview(): AdminOverviewMetrics {
  const store = getMockStore();
  const aiSuccessApprox = store.aiUsageLogs.filter(
    (item) => EXTRACT_FEATURES.includes(item.feature) && (item.status === "success" || item.status === "fallback")
  ).length;
  const aiFailedApprox = store.aiUsageLogs.filter(
    (item) => EXTRACT_FEATURES.includes(item.feature) && item.status === "failed"
  ).length;

  return {
    registeredUsers: 1,
    assignmentSaves: store.assignments.filter((item) => !item.deletedAt).length,
    aiExtractionCount: store.aiLogs.length,
    aiExtractionSuccessApprox: aiSuccessApprox,
    aiExtractionFailedApprox: aiFailedApprox,
    calendarSyncSuccessApprox: store.syncOutbox.filter((item) => item.status === "synced").length,
    calendarSyncFailedApprox: store.syncOutbox.filter((item) => item.status === "failed").length,
    appErrorApprox: null,
    inquiryCountMemo: "手動スプレッドシート管理（未実装）",
    deletionRequestMemo: "手動スプレッドシート管理（未実装）",
    openAiUsageMemo: "OpenAI Dashboard と ai_usage_logs を確認",
    supabaseUsageMemo: "Supabase Project Usage を確認",
    vercelUsageMemo: "Vercel Usage / Runtime Logs を確認"
  };
}

export async function getAdminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return getMockOverview();
  }

  const [
    registeredUsers,
    assignmentSaves,
    aiExtractionCount,
    aiExtractionSuccessApprox,
    aiExtractionFailedApprox,
    calendarSyncSuccessApprox,
    calendarSyncFailedApprox
  ] = await Promise.all([
    safeCount("users"),
    safeCount("assignments", (query) => query.is("deleted_at", null)),
    safeCount("ai_extraction_logs"),
    safeCount("ai_usage_logs", (query) =>
      query.in("feature", EXTRACT_FEATURES).in("status", ["success", "fallback"])
    ),
    safeCount("ai_usage_logs", (query) => query.in("feature", EXTRACT_FEATURES).eq("status", "failed")),
    safeCount("sync_outbox", (query) => query.eq("status", "synced")),
    safeCount("sync_outbox", (query) => query.eq("status", "failed"))
  ]);

  return {
    registeredUsers,
    assignmentSaves,
    aiExtractionCount,
    aiExtractionSuccessApprox,
    aiExtractionFailedApprox,
    calendarSyncSuccessApprox,
    calendarSyncFailedApprox,
    appErrorApprox: null,
    inquiryCountMemo: "問い合わせ件数は運営シートで管理",
    deletionRequestMemo: "削除依頼件数は運営シートで管理",
    openAiUsageMemo: "OpenAI Dashboard と ai_usage_logs を確認",
    supabaseUsageMemo: "Supabase Project Usage を確認",
    vercelUsageMemo: "Vercel Usage / Runtime Logs を確認"
  };
}

export async function getAdminServiceChecks(): Promise<AdminServiceChecks> {
  const supabaseConnected = await loadSupabaseConnectionStatus();

  const sentryConfigured = hasConfiguredValue(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const posthogConfigured = hasConfiguredValue(process.env.NEXT_PUBLIC_POSTHOG_TOKEN) && hasConfiguredValue(process.env.NEXT_PUBLIC_POSTHOG_HOST);
  const resendConfigured = hasConfiguredValue(process.env.RESEND_API_KEY);
  const stripeConfigured = hasConfiguredValue(process.env.STRIPE_SECRET_KEY) && hasConfiguredValue(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const notes = [
    "Sentry / PostHog / Resend / Stripe は導入方針のみ先行。本実装は段階導入。",
    "課題本文・raw_text・授業メモ・PDF抽出本文を外部分析イベントに送信しない。",
    "Vercel環境変数は Production / Preview の両方を手動確認する。"
  ];

  return {
    openAi: isOpenAiEnabled ? "configured" : "not_configured",
    googleOAuthCalendar: isGoogleCalendarOAuthEnabled ? "configured" : "not_configured",
    supabase: isSupabaseEnabled && supabaseConnected ? "configured" : "not_configured",
    sentry: sentryConfigured ? "configured" : "candidate",
    posthog: posthogConfigured ? "configured" : "candidate",
    resend: resendConfigured ? "configured" : "candidate",
    stripe: stripeConfigured ? "configured" : "candidate",
    vercelEnv: "manual_check",
    notes
  };
}

export async function listAdminCreditRows(params?: { query?: string; limit?: number }) {
  const query = params?.query?.trim().toLowerCase() ?? "";
  const limit = Math.max(20, Math.min(params?.limit ?? 120, 400));
  const admin = createSupabaseAdminClient();

  if (!admin) {
    const store = getMockStore();
    const rows = store.aiCreditBalances.map((item) =>
      toCreditRow(
        {
          id: item.id,
          user_id: item.userId,
          month_key: item.monthKey,
          plan: item.plan,
          monthly_limit: item.monthlyLimit,
          credits_used: item.creditsUsed,
          created_at: item.createdAt,
          updated_at: item.updatedAt
        },
        item.userId === "demo-user" ? "demo@example.com" : null
      )
    );
    return rows
      .filter((row) => !query || row.userId.toLowerCase().includes(query) || (row.email ?? "").toLowerCase().includes(query))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit);
  }

  const { data: balances, error } = await admin
    .from("ai_credit_balances")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw new Error(`Failed to list AI credit balances: ${error.message}`);
  }

  const rows = (balances as CreditBalanceRow[]) ?? [];
  const userIds = Array.from(new Set(rows.map((item) => item.user_id)));
  let userMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: usersData, error: usersError } = await admin
      .from("users")
      .select("id,email")
      .in("id", userIds);

    if (usersError && !isMissingRelationError(usersError)) {
      console.error("Failed to load user emails for admin credits", usersError);
    } else {
      userMap = new Map(
        ((usersData as Pick<UserRow, "id" | "email">[] | null) ?? []).map((item) => [item.id, item.email])
      );
    }
  }

  return rows
    .map((row) => toCreditRow(row, userMap.get(row.user_id) ?? null))
    .filter((row) => !query || row.userId.toLowerCase().includes(query) || (row.email ?? "").toLowerCase().includes(query))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function applyAdminCreditMutation(input: AdminCreditMutationInput): Promise<AdminCreditMutationResult> {
  if (!input.targetUserId || !input.monthKey || !input.reason.trim()) {
    return {
      ok: false,
      code: "invalid_input",
      message: "対象ユーザー・対象月・変更理由は必須です。"
    };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      code: "admin_client_unavailable",
      message: "Supabase管理クライアントが未設定です。"
    };
  }

  const auditProbe = await (admin as unknown as { from: (name: string) => { select: (columns: string, options?: { head?: boolean; count?: "exact" }) => { limit: (count: number) => Promise<{ error: { message: string; code?: string } | null }> } } })
    .from("ai_credit_admin_logs")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (auditProbe.error) {
    if (isMissingRelationError(auditProbe.error)) {
      return {
        ok: false,
        code: "audit_log_missing",
        message: "監査ログテーブルが未適用です。docs のSQL案を先に適用してください。"
      };
    }
    return {
      ok: false,
      code: "unknown_error",
      message: `監査ログテーブル確認に失敗しました: ${auditProbe.error.message}`
    };
  }

  const { data: currentRow, error: currentError } = await admin
    .from("ai_credit_balances")
    .select("*")
    .eq("user_id", input.targetUserId)
    .eq("month_key", input.monthKey)
    .maybeSingle();

  if (currentError) {
    if (isMissingRelationError(currentError)) {
      return {
        ok: false,
        code: "balance_table_missing",
        message: "ai_credit_balances テーブルが未適用です。"
      };
    }
    return {
      ok: false,
      code: "unknown_error",
      message: `クレジット残高の読取に失敗しました: ${currentError.message}`
    };
  }

  const defaultLimit = 15;
  const now = new Date().toISOString();
  const existing = currentRow ?? {
    id: crypto.randomUUID(),
    user_id: input.targetUserId,
    month_key: input.monthKey,
    plan: "free",
    monthly_limit: defaultLimit,
    credits_used: 0,
    created_at: now,
    updated_at: now
  };

  if (!currentRow) {
    const insertPayload: CreditBalanceInsert = {
      user_id: existing.user_id,
      month_key: existing.month_key,
      plan: existing.plan,
      monthly_limit: existing.monthly_limit,
      credits_used: existing.credits_used
    };
    const { error: insertError } = await admin.from("ai_credit_balances").insert(insertPayload);

    if (insertError) {
      return {
        ok: false,
        code: "unknown_error",
        message: `初期残高の作成に失敗しました: ${insertError.message}`
      };
    }
  }

  const beforePlan = safePlan(existing.plan);
  const beforeMonthlyLimit = Math.max(0, existing.monthly_limit);
  const beforeCreditsUsed = Math.max(0, existing.credits_used);
  const beforeRemaining = Math.max(0, beforeMonthlyLimit - beforeCreditsUsed);

  const overrideLimit =
    typeof input.nextMonthlyLimitOverride === "number" && Number.isFinite(input.nextMonthlyLimitOverride)
      ? Math.max(0, Math.round(input.nextMonthlyLimitOverride))
      : beforeMonthlyLimit;
  const nextPlan = input.nextPlan ? safePlan(input.nextPlan) : beforePlan;
  const nextMonthlyLimit = Math.max(0, overrideLimit + Math.round(input.remainingDelta));
  const nextCreditsUsed = Math.min(beforeCreditsUsed, nextMonthlyLimit);
  const afterRemaining = Math.max(0, nextMonthlyLimit - nextCreditsUsed);

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
    return {
      ok: false,
      code: "unknown_error",
      message: `クレジット更新に失敗しました: ${updateError.message}`
    };
  }

  const auditPayload = {
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
    after_credits_remaining: afterRemaining,
    created_at: now
  };

  const auditInsert = await (admin as unknown as { from: (name: string) => { insert: (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } })
    .from("ai_credit_admin_logs")
    .insert(auditPayload);

  if (auditInsert.error) {
    return {
      ok: false,
      code: "unknown_error",
      message: `監査ログ保存に失敗しました: ${auditInsert.error.message}`
    };
  }

  const email = input.targetUserId === "demo-user" ? "demo@example.com" : null;
  const before: AdminCreditRow = {
    userId: input.targetUserId,
    email,
    monthKey: input.monthKey,
    plan: beforePlan,
    monthlyLimit: beforeMonthlyLimit,
    creditsUsed: beforeCreditsUsed,
    creditsRemaining: beforeRemaining,
    isTestUser: input.targetUserId === "demo-user" || (email ?? "").toLowerCase().endsWith("@example.com"),
    updatedAt: existing.updated_at
  };
  const after: AdminCreditRow = {
    userId: input.targetUserId,
    email,
    monthKey: input.monthKey,
    plan: nextPlan,
    monthlyLimit: nextMonthlyLimit,
    creditsUsed: nextCreditsUsed,
    creditsRemaining: afterRemaining,
    isTestUser: input.targetUserId === "demo-user" || (email ?? "").toLowerCase().endsWith("@example.com"),
    updatedAt: now
  };

  return { ok: true, before, after };
}
