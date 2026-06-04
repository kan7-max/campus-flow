import { getGoogleTokens, getUserSettings } from "@/lib/repositories/settingsRepository";
import { env, isGoogleCalendarOAuthEnabled } from "@/lib/env";
import { patchUserSettings } from "@/lib/repositories/settingsRepository";
import { listCalendarRecords, upsertCalendarRecord } from "@/lib/repositories/assignmentRepository";
import { GoogleCalendarProvider } from "@/lib/services/googleCalendarProvider";
import type { Assignment } from "@/lib/types/domain";

type GoogleTokens = Awaited<ReturnType<typeof getGoogleTokens>>;

async function getFreshGoogleAccessToken(userId: string, tokens: GoogleTokens) {
  const expiresAt = tokens.expiry ? new Date(tokens.expiry).getTime() : 0;
  const shouldRefresh = !tokens.accessToken || !expiresAt || expiresAt <= Date.now() + 60_000;

  if (!shouldRefresh) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken || !isGoogleCalendarOAuthEnabled) {
    return tokens.accessToken;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      refresh_token: tokens.refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!tokenRes.ok) {
    return tokens.accessToken;
  }

  const json = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!json.access_token) {
    return tokens.accessToken;
  }

  const expiry = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000).toISOString()
    : tokens.expiry;

  await patchUserSettings(userId, {
    googleAccessToken: json.access_token,
    googleTokenExpiry: expiry
  });

  return json.access_token;
}

export async function syncAssignmentWithCalendar(params: {
  userId: string;
  assignment: Assignment;
  mode: "create_or_update" | "delete";
}) {
  const { userId, assignment, mode } = params;

  try {
    const [settings, tokens, existingRecords] = await Promise.all([
      getUserSettings(userId),
      getGoogleTokens(userId),
      listCalendarRecords(userId, assignment.id)
    ]);

    const existing = existingRecords[0];
    const accessToken = await getFreshGoogleAccessToken(userId, tokens);

    await upsertCalendarRecord({
      userId,
      assignmentId: assignment.id,
      externalEventId: existing?.externalEventId ?? null,
      syncStatus: "pending"
    });

    const provider = new GoogleCalendarProvider({ accessToken });

    const result = await provider.syncAssignment({
      assignment,
      mode,
      existingEventId: existing?.externalEventId,
      timezone: settings.timezone
    });

    await upsertCalendarRecord({
      userId,
      assignmentId: assignment.id,
      externalEventId: result.externalEventId ?? existing?.externalEventId ?? null,
      syncStatus: result.synced ? "synced" : "failed",
      errorMessage: result.error ?? null
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown calendar sync error";

    await upsertCalendarRecord({
      userId,
      assignmentId: assignment.id,
      syncStatus: "failed",
      errorMessage: message
    });

    return {
      synced: false,
      error: message
    };
  }
}
