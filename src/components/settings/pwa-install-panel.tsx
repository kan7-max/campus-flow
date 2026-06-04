"use client";

import { useEffect, useState } from "react";
import { Download, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isIosBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstallPanel() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setStandalone(isStandaloneDisplay());
      setIos(isIosBrowser());
    });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
      setStatus("インストール済み");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setStatus(ios ? "Safariの共有メニューからホーム画面に追加できます" : "ブラウザのインストールメニューを使えます");
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setStatus(choice.outcome === "accepted" ? "インストールを開始しました" : "インストールを閉じました");
  };

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-primary/25 bg-primary/10 p-2 text-primary">
            <MonitorSmartphone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">アプリとして使う</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {standalone ? "この端末ではアプリ表示で開いています。" : "ホーム画面やDockからすぐ開けます。"}
            </p>
            {status ? <p className="mt-2 text-xs text-primary">{status}</p> : null}
          </div>
        </div>

        <Button variant={standalone ? "secondary" : "default"} onClick={install} disabled={standalone}>
          <Download className="h-4 w-4" />
          {standalone ? "インストール済み" : "インストール"}
        </Button>
      </div>
    </Card>
  );
}
