"use client";

import { useMemo, useState } from "react";
import { BookOpenText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type BetaTesterGuidesGateProps = {
  userKey: string;
};

const WIDE_GUIDE_PATH = "/beta-guide?view=pc";
const VERTICAL_GUIDE_PATH = "/beta-guide?view=mobile";

function storageKey(userKey: string) {
  return `taskflow.beta_guides_seen.v2.${userKey}`;
}

export function BetaTesterGuidesGate({ userKey }: BetaTesterGuidesGateProps) {
  const key = useMemo(() => storageKey(userKey), [userKey]);
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(key) !== "1";
  });

  function markSeen() {
    window.localStorage.setItem(key, "1");
  }

  function closeGuide() {
    markSeen();
    setOpen(false);
  }

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 px-4 py-6 backdrop-blur-[1px]">
          <section className="w-full max-w-[680px] rounded-lg border border-border bg-card p-5 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Beta Guide</p>
            <h2 className="mt-2 text-lg font-semibold">テスター向け資料</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              初回アクセス時のみこのガイドを表示しています。2回目以降は左下の「β資料」ボタンからいつでも開けます。
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link href={WIDE_GUIDE_PATH} target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" className="w-full justify-between">
                  PC向け資料
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
              <Link href={VERTICAL_GUIDE_PATH} target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" className="w-full justify-between">
                  スマホ向け資料
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={closeGuide}>
                アプリを開始
              </Button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="fixed bottom-24 left-3 z-[60] lg:bottom-6 lg:left-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="shadow-md"
          aria-label="βテスター向け資料を開く"
        >
          <BookOpenText className="h-4 w-4" />
          β資料
        </Button>
      </div>
    </>
  );
}
