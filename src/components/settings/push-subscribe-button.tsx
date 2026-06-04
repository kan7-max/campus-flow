"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type PushSubscribeResponse = {
  error?: string;
  ok?: boolean;
};

type PushTestResponse = {
  error?: string;
  failed?: number;
  reasons?: string[];
  sent?: number;
  total?: number;
};

function base64ToUint8Array(base64: string) {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }

  return output;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function PushSubscribeButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enablePush = async () => {
    setIsSubmitting(true);
    setStatus(null);

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker未対応ブラウザです");
      }

      if (!("Notification" in window)) {
        throw new Error("通知未対応ブラウザです");
      }

      if (!("PushManager" in window)) {
        throw new Error("Web Push未対応ブラウザです");
      }

      const key = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
      if (!key) {
        throw new Error("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY が未設定です");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("通知許可が必要です");
      }

      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = base64ToUint8Array(key);
      const subscribe = () => registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
      const saveAndTest = async (subscription: PushSubscription) => {
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(subscription)
        });

        if (!response.ok) {
          const body = await readJson<PushSubscribeResponse>(response);
          throw new Error(body?.error ?? "サーバーへの購読保存に失敗しました");
        }

        const testResponse = await fetch("/api/push/test", { method: "POST" });
        const testBody = await readJson<PushTestResponse>(testResponse);

        if (!testResponse.ok || !testBody?.sent) {
          throw new Error(testBody?.error ?? testBody?.reasons?.[0] ?? "購読保存後のテスト通知送信に失敗しました");
        }
      };

      const existingSubscription = await registration.pushManager.getSubscription();

      if (existingSubscription) {
        try {
          await saveAndTest(existingSubscription);
        } catch {
          await existingSubscription.unsubscribe();
          await saveAndTest(await subscribe());
        }
      } else {
        await saveAndTest(await subscribe());
      }

      setStatus("Web Pushを有効化し、テスト通知を送信しました");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Web Push設定に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={enablePush} disabled={isSubmitting}>
        {isSubmitting ? "Web Pushを確認中" : "Web Pushを有効化"}
      </Button>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}
