"use client";

import Link from "next/link";
import { Bot, FileText, Inbox, PencilLine, Plus, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { saveAndParseInboxTextAction, saveInboxTextAction } from "@/lib/actions/inboxActions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const actions = [
  {
    href: "/assignments/new",
    label: "手入力",
    description: "課題を直接追加",
    icon: PencilLine
  },
  {
    href: "/ai",
    label: "AI入力",
    description: "文章から抽出",
    icon: Bot
  },
  {
    href: "/ai",
    label: "ファイル",
    description: "PDFや画像から抽出",
    icon: FileText
  }
];

export function QuickAddMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isNewAssignmentPage = pathname === "/assignments/new";

  if (isNewAssignmentPage) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-8 z-40 hidden lg:block">
      {open ? (
        <div className="mb-3 w-[min(calc(100vw-2rem),420px)] rounded-lg border border-border bg-card p-4 shadow-card">
          <form action={saveAndParseInboxTextAction} className="space-y-3">
            <input type="hidden" name="sourceType" value="manual_text" />
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Inbox className="h-4 w-4 text-primary" />
                課題文を貼る
              </div>
              <Textarea
                name="rawText"
                required
                className="min-h-[132px]"
                placeholder="例: 物理実験レポート 来週月曜まで グラフと考察必要"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="submit" variant="outline" formAction={saveInboxTextAction}>
                メモ保存
              </Button>
              <Button type="submit">
                <Sparkles className="h-4 w-4" />
                整理
              </Button>
            </div>
          </form>

          <div className="mt-3 border-t border-border/60 pt-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition hover:bg-accent"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-medium">{action.label}</span>
                    <span className="block text-xs text-muted-foreground">{action.description}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "追加メニューを閉じる" : "課題を追加"}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 lg:h-12 lg:w-12",
          open && "rotate-90"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
