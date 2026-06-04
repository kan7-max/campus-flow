import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Database } from "@/lib/types/database";
import type { AiCreditBalance, AiCreditPlan } from "@/lib/types/domain";

type AiCreditBalanceRow = Database["public"]["Tables"]["ai_credit_balances"]["Row"];

const plans: AiCreditPlan[] = ["free", "plus", "pro"];
const defaultMonthlyLimit: Record<AiCreditPlan, number> = {
  free: 15,
  plus: 150,
  pro: 400
};

export function getAiCreditMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isMissingAiCreditBalancesTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "42P01" || /ai_credit_balances/i.test(maybeError.message ?? "");
}

function normalizePlan(value: string | null | undefined): AiCreditPlan {
  return plans.includes(value as AiCreditPlan) ? (value as AiCreditPlan) : "free";
}

function mapAiCreditBalance(row: AiCreditBalanceRow): AiCreditBalance {
  const monthlyLimit = Math.max(0, row.monthly_limit);
  const creditsUsed = Math.max(0, row.credits_used);

  return {
    id: row.id,
    userId: row.user_id,
    monthKey: row.month_key,
    plan: normalizePlan(row.plan),
    monthlyLimit,
    creditsUsed,
    creditsRemaining: Math.max(0, monthlyLimit - creditsUsed),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function makeMockBalance(userId: string, monthKey: string): AiCreditBalance {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    monthKey,
    plan: "free",
    monthlyLimit: defaultMonthlyLimit.free,
    creditsUsed: 0,
    creditsRemaining: defaultMonthlyLimit.free,
    createdAt: now,
    updatedAt: now
  };
}

export async function getOrCreateAiCreditBalance(userId: string, monthKey = getAiCreditMonthKey()): Promise<AiCreditBalance | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    let balance = store.aiCreditBalances.find((item) => item.userId === userId && item.monthKey === monthKey);
    if (!balance) {
      balance = makeMockBalance(userId, monthKey);
      store.aiCreditBalances.push(balance);
      persistMockStore(store);
    }
    return balance;
  }

  const { data, error } = await supabase
    .from("ai_credit_balances")
    .select("*")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    if (isMissingAiCreditBalancesTable(error)) {
      return null;
    }
    throw new Error(`Failed to get AI credit balance: ${error.message}`);
  }

  if (data) {
    return mapAiCreditBalance(data as AiCreditBalanceRow);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("ai_credit_balances")
    .insert({
      user_id: userId,
      month_key: monthKey,
      plan: "free",
      monthly_limit: defaultMonthlyLimit.free,
      credits_used: 0
    })
    .select("*")
    .single();

  if (insertError) {
    if (isMissingAiCreditBalancesTable(insertError)) {
      return null;
    }
    throw new Error(`Failed to initialize AI credit balance: ${insertError.message}`);
  }

  return mapAiCreditBalance(inserted as AiCreditBalanceRow);
}

export async function consumeAiCredits(params: {
  credits: number;
  monthKey?: string;
  userId: string;
}): Promise<{ balance: AiCreditBalance | null; charged: boolean; insufficient: boolean }> {
  const credits = Math.max(0, Math.round(params.credits));
  const monthKey = params.monthKey ?? getAiCreditMonthKey();

  if (credits === 0) {
    return {
      balance: await getOrCreateAiCreditBalance(params.userId, monthKey),
      charged: false,
      insufficient: false
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    let balance = store.aiCreditBalances.find((item) => item.userId === params.userId && item.monthKey === monthKey);
    if (!balance) {
      balance = makeMockBalance(params.userId, monthKey);
      store.aiCreditBalances.push(balance);
      persistMockStore(store);
    }

    if (balance.creditsRemaining < credits) {
      return { balance, charged: false, insufficient: true };
    }

    balance.creditsUsed += credits;
    balance.creditsRemaining = Math.max(0, balance.monthlyLimit - balance.creditsUsed);
    balance.updatedAt = new Date().toISOString();
    persistMockStore(store);
    return { balance, charged: true, insufficient: false };
  }

  const current = await getOrCreateAiCreditBalance(params.userId, monthKey);
  if (!current) {
    return { balance: null, charged: false, insufficient: false };
  }

  if (current.creditsRemaining < credits) {
    return { balance: current, charged: false, insufficient: true };
  }

  const { data, error } = await supabase
    .from("ai_credit_balances")
    .update({
      credits_used: current.creditsUsed + credits,
      updated_at: new Date().toISOString()
    })
    .eq("id", current.id)
    .eq("user_id", params.userId)
    .select("*")
    .single();

  if (error) {
    if (isMissingAiCreditBalancesTable(error)) {
      return { balance: null, charged: false, insufficient: false };
    }
    throw new Error(`Failed to consume AI credits: ${error.message}`);
  }

  return { balance: mapAiCreditBalance(data as AiCreditBalanceRow), charged: true, insufficient: false };
}
