import { DEFAULT_NOTIFICATION_TIMING, DEFAULT_PRIORITY_WEIGHTS } from "@/lib/constants/domain";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";
import type { UserSettings } from "@/lib/types/domain";
import { getMockStore, persistMockStore } from "@/lib/mock/store";

type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];
type UserSettingsUpdate = Database["public"]["Tables"]["user_settings"]["Update"];

type SettingsPatch = Partial<
  Pick<
    UserSettings,
    | "aiEnabled"
    | "displayName"
    | "googleCalendarEnabled"
    | "notificationConfig"
    | "onboardingCompleted"
    | "preferredAvailableMinutes"
    | "preferredTodayMode"
    | "priorityWeights"
    | "setupCourseNames"
    | "theme"
    | "timezone"
  >
> & {
  googleAccessToken?: string | null;
  googleRefreshToken?: string | null;
  googleTokenExpiry?: string | null;
};

type LegacyNotificationConfig = UserSettings["notificationConfig"] & {
  aiEnabled?: boolean;
  displayName?: string | null;
  googleAccessToken?: string | null;
  googleCalendarEnabled?: boolean;
  googleRefreshToken?: string | null;
  googleTokenExpiry?: string | null;
  onboardingCompleted?: boolean;
  preferredAvailableMinutes?: UserSettings["preferredAvailableMinutes"];
  preferredTodayMode?: UserSettings["preferredTodayMode"];
  setupCourseNames?: string[];
  __setupCompat?: Partial<
    Pick<
      UserSettings,
      | "displayName"
      | "onboardingCompleted"
      | "preferredAvailableMinutes"
      | "preferredTodayMode"
      | "aiEnabled"
      | "googleCalendarEnabled"
      | "setupCourseNames"
    >
  >;
};

const optionalSettingsColumnPattern =
  /display_name|onboarding_completed|preferred_available_minutes|preferred_today_mode|ai_enabled|google_calendar_enabled|setup_course_names|google_access_token|google_refresh_token|google_token_expiry/i;

function defaultSettings(userId: string): UserSettings {
  const now = new Date().toISOString();

  return {
    userId,
    displayName: null,
    onboardingCompleted: false,
    timezone: "Asia/Tokyo",
    theme: "dark",
    preferredAvailableMinutes: 60,
    preferredTodayMode: "normal",
    aiEnabled: true,
    googleCalendarEnabled: false,
    setupCourseNames: [],
    priorityWeights: DEFAULT_PRIORITY_WEIGHTS,
    notificationConfig: {
      email: true,
      webPush: true,
      ...DEFAULT_NOTIFICATION_TIMING
    },
    createdAt: now,
    updatedAt: now
  };
}

function notificationConfigFromRow(row: UserSettingsRow) {
  return {
    email: true,
    webPush: true,
    ...DEFAULT_NOTIFICATION_TIMING,
    ...(row.notification_config as object)
  } as LegacyNotificationConfig;
}

function mapSettings(row: UserSettingsRow): UserSettings {
  const notificationConfig = notificationConfigFromRow(row);
  const setupCompat =
    notificationConfig.__setupCompat && typeof notificationConfig.__setupCompat === "object"
      ? notificationConfig.__setupCompat
      : {};

  return {
    userId: row.user_id,
    displayName: row.display_name ?? setupCompat.displayName ?? notificationConfig.displayName ?? null,
    onboardingCompleted:
      row.onboarding_completed
      ?? setupCompat.onboardingCompleted
      ?? notificationConfig.onboardingCompleted
      ?? false,
    timezone: row.timezone,
    theme: (row.theme as UserSettings["theme"]) ?? "dark",
    preferredAvailableMinutes: ([15, 30, 60, 120, 180].includes(row.preferred_available_minutes)
      ? row.preferred_available_minutes
      : setupCompat.preferredAvailableMinutes ?? notificationConfig.preferredAvailableMinutes ?? 60) as UserSettings["preferredAvailableMinutes"],
    preferredTodayMode: (["busy", "exam", "low_energy", "normal"].includes(row.preferred_today_mode)
      ? row.preferred_today_mode
      : setupCompat.preferredTodayMode ?? notificationConfig.preferredTodayMode ?? "normal") as UserSettings["preferredTodayMode"],
    aiEnabled: row.ai_enabled ?? setupCompat.aiEnabled ?? notificationConfig.aiEnabled ?? true,
    googleCalendarEnabled:
      row.google_calendar_enabled
      ?? setupCompat.googleCalendarEnabled
      ?? notificationConfig.googleCalendarEnabled
      ?? false,
    setupCourseNames: Array.isArray(row.setup_course_names)
      ? row.setup_course_names
      : setupCompat.setupCourseNames ?? notificationConfig.setupCourseNames ?? [],
    priorityWeights: { ...DEFAULT_PRIORITY_WEIGHTS, ...(row.priority_weights as object) },
    notificationConfig,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isMissingOptionalSettingsColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return optionalSettingsColumnPattern.test(message);
}

function legacyNotificationConfig(current: UserSettings, patch: SettingsPatch): LegacyNotificationConfig {
  const config: LegacyNotificationConfig = {
    ...current.notificationConfig,
    ...(patch.notificationConfig ?? {})
  };

  if ("displayName" in patch) {
    config.displayName = patch.displayName ?? null;
  }

  if ("onboardingCompleted" in patch) {
    config.onboardingCompleted = patch.onboardingCompleted ?? false;
  }

  if ("preferredAvailableMinutes" in patch && patch.preferredAvailableMinutes) {
    config.preferredAvailableMinutes = patch.preferredAvailableMinutes;
  }

  if ("preferredTodayMode" in patch && patch.preferredTodayMode) {
    config.preferredTodayMode = patch.preferredTodayMode;
  }

  if ("aiEnabled" in patch) {
    config.aiEnabled = patch.aiEnabled ?? true;
  }

  if ("googleCalendarEnabled" in patch) {
    config.googleCalendarEnabled = patch.googleCalendarEnabled ?? false;
  }

  if ("setupCourseNames" in patch) {
    config.setupCourseNames = patch.setupCourseNames ?? [];
  }

  if ("googleAccessToken" in patch) {
    config.googleAccessToken = patch.googleAccessToken ?? null;
  }

  if ("googleRefreshToken" in patch) {
    config.googleRefreshToken = patch.googleRefreshToken ?? null;
  }

  if ("googleTokenExpiry" in patch) {
    config.googleTokenExpiry = patch.googleTokenExpiry ?? null;
  }

  return config;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.settings[userId] ?? defaultSettings(userId);
  }

  const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(`Failed to get user settings: ${error.message}`);
  }

  if (!data) {
    const fallback = defaultSettings(userId);
    const { error: insertError } = await supabase.from("user_settings").insert({
      user_id: userId,
      timezone: fallback.timezone,
      theme: fallback.theme,
      priority_weights: fallback.priorityWeights,
      notification_config: fallback.notificationConfig
    });

    if (insertError) {
      throw new Error(`Failed to initialize user settings: ${insertError.message}`);
    }

    return fallback;
  }

  return mapSettings(data as UserSettingsRow);
}

export async function patchUserSettings(userId: string, patch: SettingsPatch): Promise<UserSettings> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const current = store.settings[userId] ?? defaultSettings(userId);
    const merged: UserSettings = {
      ...current,
      displayName: patch.displayName ?? current.displayName,
      onboardingCompleted: patch.onboardingCompleted ?? current.onboardingCompleted,
      timezone: patch.timezone ?? current.timezone,
      theme: patch.theme ?? current.theme,
      preferredAvailableMinutes: patch.preferredAvailableMinutes ?? current.preferredAvailableMinutes,
      preferredTodayMode: patch.preferredTodayMode ?? current.preferredTodayMode,
      aiEnabled: patch.aiEnabled ?? current.aiEnabled,
      googleCalendarEnabled: patch.googleCalendarEnabled ?? current.googleCalendarEnabled,
      setupCourseNames: patch.setupCourseNames ?? current.setupCourseNames,
      priorityWeights: { ...current.priorityWeights, ...(patch.priorityWeights ?? {}) },
      notificationConfig: { ...current.notificationConfig, ...(patch.notificationConfig ?? {}) },
      updatedAt: new Date().toISOString()
    };

    store.settings[userId] = merged;

    if (
      "googleAccessToken" in patch ||
      "googleRefreshToken" in patch ||
      "googleTokenExpiry" in patch
    ) {
      const currentTokens = store.googleTokens[userId] ?? {
        accessToken: null,
        refreshToken: null,
        expiry: null
      };

      store.googleTokens[userId] = {
        accessToken: "googleAccessToken" in patch ? patch.googleAccessToken ?? null : currentTokens.accessToken,
        refreshToken: "googleRefreshToken" in patch ? patch.googleRefreshToken ?? null : currentTokens.refreshToken,
        expiry: "googleTokenExpiry" in patch ? patch.googleTokenExpiry ?? null : currentTokens.expiry
      };
    }

    persistMockStore(store);
    return merged;
  }

  const current = await getUserSettings(userId);
  const mergedNotificationConfig = legacyNotificationConfig(current, patch);
  const setupCompatPatch: NonNullable<LegacyNotificationConfig["__setupCompat"]> = {};

  if ("displayName" in patch) {
    setupCompatPatch.displayName = patch.displayName ?? null;
  }

  if ("onboardingCompleted" in patch) {
    setupCompatPatch.onboardingCompleted = patch.onboardingCompleted ?? false;
  }

  if ("preferredAvailableMinutes" in patch && patch.preferredAvailableMinutes) {
    setupCompatPatch.preferredAvailableMinutes = patch.preferredAvailableMinutes;
  }

  if ("preferredTodayMode" in patch && patch.preferredTodayMode) {
    setupCompatPatch.preferredTodayMode = patch.preferredTodayMode;
  }

  if ("aiEnabled" in patch) {
    setupCompatPatch.aiEnabled = patch.aiEnabled ?? true;
  }

  if ("googleCalendarEnabled" in patch) {
    setupCompatPatch.googleCalendarEnabled = patch.googleCalendarEnabled ?? false;
  }

  if ("setupCourseNames" in patch) {
    setupCompatPatch.setupCourseNames = patch.setupCourseNames ?? [];
  }

  mergedNotificationConfig.__setupCompat = {
    ...(mergedNotificationConfig.__setupCompat ?? {}),
    ...setupCompatPatch
  };

  const payload: UserSettingsUpdate = {
    timezone: patch.timezone ?? current.timezone,
    theme: patch.theme ?? current.theme,
    priority_weights: { ...current.priorityWeights, ...(patch.priorityWeights ?? {}) },
    notification_config: mergedNotificationConfig,
    updated_at: new Date().toISOString()
  };

  if ("displayName" in patch) {
    payload.display_name = patch.displayName;
  }

  if ("onboardingCompleted" in patch) {
    payload.onboarding_completed = patch.onboardingCompleted;
  }

  if ("preferredAvailableMinutes" in patch) {
    payload.preferred_available_minutes = patch.preferredAvailableMinutes;
  }

  if ("preferredTodayMode" in patch) {
    payload.preferred_today_mode = patch.preferredTodayMode;
  }

  if ("aiEnabled" in patch) {
    payload.ai_enabled = patch.aiEnabled;
  }

  if ("googleCalendarEnabled" in patch) {
    payload.google_calendar_enabled = patch.googleCalendarEnabled;
  }

  if ("setupCourseNames" in patch) {
    payload.setup_course_names = patch.setupCourseNames;
  }

  if ("googleAccessToken" in patch) {
    payload.google_access_token = patch.googleAccessToken;
  }

  if ("googleRefreshToken" in patch) {
    payload.google_refresh_token = patch.googleRefreshToken;
  }

  if ("googleTokenExpiry" in patch) {
    payload.google_token_expiry = patch.googleTokenExpiry;
  }

  const { data, error } = await supabase
    .from("user_settings")
    .update(payload)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (!error) {
    return mapSettings(data as UserSettingsRow);
  }

  if (!isMissingOptionalSettingsColumn(error)) {
    throw new Error(`Failed to update user settings: ${error.message}`);
  }

  console.warn("Falling back to legacy user_settings update because optional columns are missing", error.message);

  const legacyPayload: Database["public"]["Tables"]["user_settings"]["Update"] = {
    timezone: patch.timezone ?? current.timezone,
    theme: patch.theme ?? current.theme,
    priority_weights: { ...current.priorityWeights, ...(patch.priorityWeights ?? {}) },
    notification_config: mergedNotificationConfig,
    updated_at: new Date().toISOString()
  };

  const { data: legacyData, error: legacyError } = await supabase
    .from("user_settings")
    .update(legacyPayload)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (legacyError) {
    throw new Error(`Failed to update user settings: ${legacyError.message}`);
  }

  return mapSettings(legacyData as UserSettingsRow);
}

export async function getGoogleTokens(userId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const tokens = store.googleTokens[userId];
    return tokens ?? {
      accessToken: null,
      refreshToken: null,
      expiry: null
    };
  }

  const { data, error } = await supabase
    .from("user_settings")
    .select("google_access_token, google_refresh_token, google_token_expiry, notification_config")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (!isMissingOptionalSettingsColumn(error)) {
      throw new Error(`Failed to fetch Google token: ${error.message}`);
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("user_settings")
      .select("notification_config")
      .eq("user_id", userId)
      .maybeSingle();

    if (fallbackError) {
      throw new Error(`Failed to fetch Google token: ${fallbackError.message}`);
    }

    const config = {
      ...(fallbackData?.notification_config as object)
    } as LegacyNotificationConfig;

    return {
      accessToken: config.googleAccessToken ?? null,
      refreshToken: config.googleRefreshToken ?? null,
      expiry: config.googleTokenExpiry ?? null
    };
  }

  const config = {
    ...(data?.notification_config as object)
  } as LegacyNotificationConfig;

  return {
    accessToken: data?.google_access_token ?? config.googleAccessToken ?? null,
    refreshToken: data?.google_refresh_token ?? config.googleRefreshToken ?? null,
    expiry: data?.google_token_expiry ?? config.googleTokenExpiry ?? null
  };
}

type WebPushSubscriptionPayload = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};

function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybe = error as { code?: string; message?: string };
  return maybe.code === "42703" || new RegExp(column, "i").test(maybe.message ?? "");
}

function normalizePushSubscriptionPayload(value: unknown): WebPushSubscriptionPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    endpoint?: unknown;
    auth?: unknown;
    p256dh?: unknown;
    keys?: { auth?: unknown; p256dh?: unknown } | null;
  };

  const endpoint = typeof candidate.endpoint === "string" ? candidate.endpoint : null;
  const auth = typeof candidate.keys?.auth === "string"
    ? candidate.keys.auth
    : typeof candidate.auth === "string"
      ? candidate.auth
      : null;
  const p256dh = typeof candidate.keys?.p256dh === "string"
    ? candidate.keys.p256dh
    : typeof candidate.p256dh === "string"
      ? candidate.p256dh
      : null;

  if (!endpoint || !auth || !p256dh) {
    return null;
  }

  return {
    endpoint,
    keys: {
      auth,
      p256dh
    }
  };
}

async function resolvePushSupabaseClient(useAdmin: boolean) {
  if (!useAdmin) {
    return createSupabaseServerClient();
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    return admin;
  }

  const server = await createSupabaseServerClient();
  if (server) {
    throw new Error("Supabase admin client is required for system push subscription access");
  }

  return null;
}

export async function listPushSubscriptions(userId: string, options?: { useAdmin?: boolean }) {
  const supabase = await resolvePushSupabaseClient(Boolean(options?.useAdmin));

  if (!supabase) {
    const store = getMockStore();
    return store.pushSubscriptions
      .filter((item) => item.userId === userId)
      .map((item) => normalizePushSubscriptionPayload(item.subscription))
      .filter((item): item is WebPushSubscriptionPayload => item !== null);
  }

  const { data: jsonData, error: jsonError } = await supabase
    .from("push_subscriptions")
    .select("subscription")
    .eq("user_id", userId);

  if (!jsonError) {
    return ((jsonData as Array<{ subscription: unknown }> | null) ?? [])
      .map((item) => normalizePushSubscriptionPayload(item.subscription))
      .filter((item): item is WebPushSubscriptionPayload => item !== null);
  }

  if (!isMissingColumnError(jsonError, "subscription")) {
    console.error("Failed to list push subscriptions", jsonError);
    return [];
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to list push subscriptions", error);
    return [];
  }

  return data.map((item) => ({
    endpoint: item.endpoint,
    keys: {
      p256dh: item.p256dh,
      auth: item.auth
    }
  }));
}

export async function savePushSubscription(
  userId: string,
  subscription: WebPushSubscriptionPayload
) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const existing = store.pushSubscriptions.find(
      (item) =>
        item.userId === userId &&
        normalizePushSubscriptionPayload(item.subscription)?.endpoint === subscription.endpoint
    );

    if (existing) {
      existing.subscription = subscription;
      existing.updatedAt = now;
    } else {
      store.pushSubscriptions.push({
        id: crypto.randomUUID(),
        userId,
        subscription,
        createdAt: now,
        updatedAt: now
      });
    }

    persistMockStore(store);
    return;
  }

  const { data: jsonData, error: jsonError } = await supabase
    .from("push_subscriptions")
    .select("id,subscription")
    .eq("user_id", userId);

  if (!jsonError) {
    const existing = ((jsonData as Array<{ id: string; subscription: unknown }> | null) ?? []).find(
      (row) => normalizePushSubscriptionPayload(row.subscription)?.endpoint === subscription.endpoint
    );

    if (existing) {
      const { error: updateError } = await supabase
        .from("push_subscriptions")
        .update({
          subscription,
          updated_at: now
        })
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(`Failed to update push subscription: ${updateError.message}`);
      }
      return;
    }

    const { error: insertError } = await supabase.from("push_subscriptions").insert({
      user_id: userId,
      subscription
    });

    if (insertError) {
      throw new Error(`Failed to save push subscription: ${insertError.message}`);
    }
    return;
  }

  if (!isMissingColumnError(jsonError, "subscription")) {
    throw new Error(`Failed to save push subscription: ${jsonError.message}`);
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth
  }, { onConflict: "endpoint" });

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }
}
