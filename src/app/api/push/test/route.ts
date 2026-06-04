import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendWebPushNotification } from "@/lib/notifications/push";
import { listPushSubscriptions } from "@/lib/repositories/settingsRepository";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscriptions = await listPushSubscriptions(user.id);
    if (subscriptions.length === 0) {
      return NextResponse.json({ error: "No push subscription" }, { status: 400 });
    }

    let sent = 0;
    const reasons: string[] = [];

    for (const subscription of subscriptions) {
      const response = await sendWebPushNotification(subscription, {
        title: "Campus Flow",
        body: "Web Push通知を送信できる状態です",
        url: "/settings"
      });

      if (response.ok) {
        sent += 1;
      } else if (response.reason) {
        reasons.push(response.reason);
      }
    }

    if (sent === 0) {
      return NextResponse.json(
        {
          error: reasons[0] ?? "Push send failed",
          failed: subscriptions.length,
          reasons,
          sent,
          total: subscriptions.length
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      failed: subscriptions.length - sent,
      reasons,
      sent,
      total: subscriptions.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test push notification" },
      { status: 400 }
    );
  }
}
