import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dispatchCalendarSyncOutbox } from "@/lib/services/calendarSyncQueueService";

function parseLimit(value: string | null, fallback: number) {
  if (value === null || value.trim() === "") {
    return Math.min(Math.max(Math.trunc(fallback), 1), 200);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.min(Math.max(Math.trunc(fallback), 1), 200);
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function parseBool(value: string | null) {
  if (!value) {
    return false;
  }

  return /^(1|true|yes|on)$/i.test(value);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 20);
    const retryFailed = parseBool(searchParams.get("retryFailed"));
    const retryFailedLimit = parseLimit(searchParams.get("retryFailedLimit"), limit);

    const result = await dispatchCalendarSyncOutbox({
      userId: user.id,
      limit,
      retryFailed,
      retryFailedLimit
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch calendar sync jobs" },
      { status: 500 }
    );
  }
}
