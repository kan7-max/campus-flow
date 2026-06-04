import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { dispatchDueNotifications, dispatchDueNotificationsUntilEmpty } from "@/lib/services/notificationService";

function parseLimit(value: string | null) {
  if (value === null || value.trim() === "") {
    return 20;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseLimitOrDefault(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") {
    return Math.min(Math.max(Math.trunc(fallback), 1), 200);
  }
  return parseLimit(value);
}

function parseRounds(value: string | null) {
  if (value === null || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function parseBool(value: string | null) {
  if (!value) {
    return false;
  }

  return /^(1|true|yes|on)$/i.test(value);
}

function isCronAuthorized(request: Request) {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cronAuthorized = isCronAuthorized(request);
    let scopedUserId: string | undefined;

    if (!cronAuthorized) {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      scopedUserId = user.id;
    }

    const cronDefaultLimit = Number(env.NOTIFICATION_DISPATCH_BATCH_LIMIT ?? 100);
    const cronDefaultRounds = Number(env.NOTIFICATION_DISPATCH_MAX_ROUNDS ?? 20);
    const limit = cronAuthorized
      ? parseLimitOrDefault(searchParams.get("limit"), cronDefaultLimit)
      : parseLimit(searchParams.get("limit"));
    const retryFailed = parseBool(searchParams.get("retryFailed"));
    const retryFailedLimit = parseLimitOrDefault(searchParams.get("retryFailedLimit"), limit);
    const drainRequested = parseBool(searchParams.get("drain")) || cronAuthorized;

    const result = drainRequested
      ? await dispatchDueNotificationsUntilEmpty({
        batchLimit: limit,
        maxRounds: parseRounds(searchParams.get("rounds")) ?? Math.min(Math.max(Math.trunc(cronDefaultRounds), 1), 100),
        retryFailed,
        retryFailedLimit,
        userId: scopedUserId
      })
      : await dispatchDueNotifications(limit, {
        retryFailed,
        retryFailedLimit,
        userId: scopedUserId
      });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch notifications" },
      { status: 500 }
    );
  }
}
