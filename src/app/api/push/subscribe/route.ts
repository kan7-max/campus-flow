import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { savePushSubscription } from "@/lib/repositories/settingsRepository";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await savePushSubscription(user.id, body);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save push subscription" },
      { status: 400 }
    );
  }
}
