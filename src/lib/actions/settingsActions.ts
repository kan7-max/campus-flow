"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { getUserSettings, patchUserSettings } from "@/lib/repositories/settingsRepository";
import { queueAndTryAssignmentCalendarSync } from "@/lib/services/calendarSyncQueueService";
import { normalizeTodayFreeTimeWindow } from "@/lib/services/todayFreeTimeService";
import type { UserSettings } from "@/lib/types/domain";

const availableMinutes = [15, 30, 60, 120, 180] as const;
const todayModes = ["normal", "busy", "low_energy", "exam"] as const;

function boolFromForm(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function asAvailableMinutes(value: FormDataEntryValue | null) {
  const minutes = Number(value?.toString() ?? 60);
  return availableMinutes.includes(minutes as (typeof availableMinutes)[number])
    ? (minutes as (typeof availableMinutes)[number])
    : 60;
}

function asTodayMode(value: FormDataEntryValue | null) {
  const mode = value?.toString() ?? "normal";
  return todayModes.includes(mode as (typeof todayModes)[number]) ? (mode as (typeof todayModes)[number]) : "normal";
}

function parseCourseNames(input: string) {
  return input
    .split(/[\n,、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function isMissingOnboardingColumns(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /display_name|onboarding_completed|preferred_available_minutes|preferred_today_mode|ai_enabled|setup_course_names/i.test(message);
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();

  await patchUserSettings(user.id, {
    timezone: formData.get("timezone")?.toString() || "Asia/Tokyo",
    theme: (formData.get("theme")?.toString() as "dark" | "light" | "system") || "dark",
    notificationConfig: {
      email: boolFromForm(formData, "email"),
      webPush: boolFromForm(formData, "webPush"),
      oneWeek: boolFromForm(formData, "oneWeek"),
      threeDays: boolFromForm(formData, "threeDays"),
      oneDay: boolFromForm(formData, "oneDay"),
      sameDayMorning: boolFromForm(formData, "sameDayMorning")
    },
    priorityWeights: {
      dueSoonWeight: Number(formData.get("dueSoonWeight") ?? 0.35),
      assignmentTypeWeight: Number(formData.get("assignmentTypeWeight") ?? 0.2),
      heavyWeight: Number(formData.get("heavyWeight") ?? 0.16),
      estimatedHoursWeight: Number(formData.get("estimatedHoursWeight") ?? 0.12),
      progressWeight: Number(formData.get("progressWeight") ?? 0.12),
      weakSubjectWeight: Number(formData.get("weakSubjectWeight") ?? 0.05)
    }
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

function safeTodayPreferencesRedirect(value: FormDataEntryValue | null) {
  const destination = value?.toString();
  return destination === "/dashboard" ? "/dashboard" : "/today";
}

export async function updateTodayPreferencesAction(formData: FormData) {
  const user = await requireUser();
  const preferredAvailableMinutes = asAvailableMinutes(formData.get("availableMinutes"));
  const preferredTodayMode = asTodayMode(formData.get("mode"));
  const hasFreeTimeFields = formData.has("freeTimeStart") || formData.has("freeTimeEnd");
  const todayFreeTimeWindow = hasFreeTimeFields
    ? normalizeTodayFreeTimeWindow(formData.get("freeTimeStart")?.toString(), formData.get("freeTimeEnd")?.toString())
    : null;
  const destination = safeTodayPreferencesRedirect(formData.get("redirectTo"));
  const fallbackParams = new URLSearchParams({
    availableMinutes: String(preferredAvailableMinutes),
    mode: preferredTodayMode,
    today: "preferences_fallback"
  });
  if (hasFreeTimeFields) {
    fallbackParams.set("freeTimeEnd", todayFreeTimeWindow?.end ?? "");
    fallbackParams.set("freeTimeStart", todayFreeTimeWindow?.start ?? "");
  }

  try {
    await patchUserSettings(user.id, {
      preferredAvailableMinutes,
      preferredTodayMode,
      ...(hasFreeTimeFields
        ? {
            notificationConfig: {
              todayFreeTimeEnd: todayFreeTimeWindow?.end ?? "",
              todayFreeTimeNote: "",
              todayFreeTimeStart: todayFreeTimeWindow?.start ?? ""
            } as Partial<UserSettings["notificationConfig"]> as UserSettings["notificationConfig"]
          }
        : {})
    });
  } catch (error) {
    console.error("Today preferences save failed", error);
    revalidatePath(destination);
    redirect(`${destination}?${fallbackParams.toString()}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/today");
  redirect(`${destination}?today=preferences_updated`);
}

export async function saveGoogleCalendarTokenAction(formData: FormData) {
  const user = await requireUser();
  const googleAccessToken = formData.get("googleAccessToken")?.toString() || null;

  // 通常はOAuth接続を使う。手動入力は開発検証用として残す。
  await patchUserSettings(user.id, {
    googleAccessToken,
    googleCalendarEnabled: Boolean(googleAccessToken),
    googleRefreshToken: formData.get("googleRefreshToken")?.toString() || null,
    googleTokenExpiry: formData.get("googleTokenExpiry")?.toString() || null
  });

  revalidatePath("/settings");
  redirect(`/settings?google=${googleAccessToken ? "connected" : "disconnected"}`);
}

export async function disconnectGoogleCalendarAction() {
  const user = await requireUser();

  await patchUserSettings(user.id, {
    googleAccessToken: null,
    googleCalendarEnabled: false,
    googleRefreshToken: null,
    googleTokenExpiry: null
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  redirect("/settings?google=disconnected");
}

export async function syncIncompleteAssignmentsToCalendarAction() {
  const user = await requireUser();
  const settings = await getUserSettings(user.id);

  if (!settings.googleCalendarEnabled) {
    redirect("/settings?google=not_connected");
  }

  const assignments = await listAssignments(user.id, { onlyIncomplete: true, sortBy: "due" });
  const targets = assignments.slice(0, 30);
  let queued = 0;
  let synced = 0;
  let failed = 0;

  for (const assignment of targets) {
    const result = await queueAndTryAssignmentCalendarSync({
      userId: user.id,
      assignment,
      operation: "create_or_update"
    });

    if (result.synced) {
      synced += 1;
    } else if (result.queued) {
      queued += 1;
    } else {
      failed += 1;
    }
  }

  revalidatePath("/settings");
  revalidatePath("/assignments");

  const params = new URLSearchParams({
    google: "sync_done",
    picked: String(targets.length),
    queued: String(queued),
    synced: String(synced),
    failed: String(failed)
  });

  redirect(`/settings?${params.toString()}`);
}

export async function saveInitialSetupAction(formData: FormData) {
  const user = await requireUser();
  const displayName = formData.get("displayName")?.toString().trim() || null;
  const timezone = formData.get("timezone")?.toString() || "Asia/Tokyo";
  const preferredAvailableMinutes = asAvailableMinutes(formData.get("preferredAvailableMinutes"));
  const preferredTodayMode = asTodayMode(formData.get("preferredTodayMode"));
  const aiEnabled = boolFromForm(formData, "aiEnabled");
  const setupCourseNames = parseCourseNames(formData.get("setupCourseNames")?.toString() ?? "");
  const notificationsEnabled = boolFromForm(formData, "notificationsEnabled");
  const setupNotificationConfig = {
    email: notificationsEnabled,
    webPush: notificationsEnabled,
    oneWeek: true,
    threeDays: true,
    oneDay: true,
    sameDayMorning: notificationsEnabled
  };

  try {
    const currentSettings = await getUserSettings(user.id);

    await patchUserSettings(user.id, {
      displayName,
      onboardingCompleted: true,
      timezone,
      preferredAvailableMinutes,
      preferredTodayMode,
      aiEnabled,
      // Google CalendarはOAuth接続完了後だけ有効扱いにする。
      // 初回セットアップのスイッチだけで「接続済み」にしない。
      googleCalendarEnabled: currentSettings.googleCalendarEnabled,
      setupCourseNames,
      notificationConfig: setupNotificationConfig
    });
  } catch (error) {
    console.error("Initial setup save failed", error);
    if (isMissingOnboardingColumns(error)) {
      try {
        const currentSettings = await getUserSettings(user.id);
        await patchUserSettings(user.id, {
          timezone,
          notificationConfig: {
            ...setupNotificationConfig,
            __setupCompat: {
              displayName,
              onboardingCompleted: true,
              preferredAvailableMinutes,
              preferredTodayMode,
              aiEnabled,
              googleCalendarEnabled: currentSettings.googleCalendarEnabled,
              setupCourseNames
            }
          } as UserSettings["notificationConfig"]
        });
      } catch (compatError) {
        console.error("Initial setup compatibility save failed", compatError);
        redirect("/setup?setup=db_missing");
      }
      revalidatePath("/setup");
      revalidatePath("/settings");
      revalidatePath("/dashboard");
      revalidatePath("/today");
      redirect("/dashboard?setup=completed");
    }
    redirect("/setup?setup=failed");
  }

  revalidatePath("/setup");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  redirect("/dashboard?setup=completed");
}
