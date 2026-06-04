"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { resolveAdminAccess } from "@/lib/adminAccess";
import { applyAdminCreditMutation } from "@/lib/services/adminCreditMutationService";

function asNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value?.toString() ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.round(parsed);
}

function asPlan(value: FormDataEntryValue | null) {
  const plan = value?.toString();
  if (plan === "free" || plan === "plus" || plan === "pro") {
    return plan;
  }
  return null;
}

function safeReturnPath(value: FormDataEntryValue | null) {
  const text = value?.toString();
  if (text === "/admin" || text === "/admin/credits") {
    return text;
  }
  return "/admin/credits";
}

function withStatus(returnPath: string, status: string) {
  return `${returnPath}?status=${encodeURIComponent(status)}&ts=${Date.now()}`;
}

export async function updateAdminCreditsAction(formData: FormData) {
  const user = await requireUser();
  const access = resolveAdminAccess(user);
  const returnPath = safeReturnPath(formData.get("returnTo"));

  if (!access.isAdmin) {
    redirect(withStatus(returnPath, "forbidden"));
  }

  const targetUserId = formData.get("targetUserId")?.toString() ?? "";
  const monthKey = formData.get("monthKey")?.toString() ?? "";
  const reason = formData.get("reason")?.toString() ?? "";
  const remainingDelta = asNumber(formData.get("remainingDelta"), 0);
  const monthlyLimitInput = formData.get("monthlyLimit")?.toString().trim() ?? "";
  const nextMonthlyLimitOverride = monthlyLimitInput === "" ? null : asNumber(monthlyLimitInput, 0);
  const nextPlan = asPlan(formData.get("plan"));

  const result = await applyAdminCreditMutation({
    adminUserId: user.id,
    adminEmail: user.email,
    targetUserId,
    monthKey,
    reason,
    remainingDelta,
    nextMonthlyLimitOverride,
    nextPlan
  });

  revalidatePath("/admin");
  revalidatePath("/admin/credits");
  revalidatePath("/settings");
  revalidatePath("/ai");

  if (!result.ok) {
    redirect(withStatus(returnPath, result.code));
  }

  redirect(withStatus(returnPath, "updated"));
}
