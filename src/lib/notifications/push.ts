import webpush, { type PushSubscription } from "web-push";
import { env, isWebPushEnabled } from "@/lib/env";

if (isWebPushEnabled) {
  webpush.setVapidDetails(env.WEB_PUSH_SUBJECT, env.WEB_PUSH_PUBLIC_KEY!, env.WEB_PUSH_PRIVATE_KEY!);
}

export async function sendWebPushNotification(subscription: unknown, payload: object) {
  if (!isWebPushEnabled) {
    return { ok: false, reason: "web push not configured" };
  }

  try {
    await webpush.sendNotification(subscription as PushSubscription, JSON.stringify(payload), { timeout: 5000 });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown web push error"
    };
  }
}
