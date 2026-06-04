"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";
import type { AppUser } from "@/lib/auth";

type TopBarProps = {
  user: AppUser;
  isSupabaseEnabled: boolean;
};

export function TopBar({ user, isSupabaseEnabled }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 py-3 shadow-sm backdrop-blur lg:px-8">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Daily Focus</p>
          <p className="text-sm leading-5 text-muted-foreground">今日の課題を優先度順で管理</p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">{user.email}</p>
          <Link href="/settings">
            <Button size="sm" type="button" variant="outline">
              <Settings className="h-4 w-4" />
              設定
            </Button>
          </Link>
          <LogoutButton isSupabaseEnabled={isSupabaseEnabled} />
        </div>
      </div>
    </header>
  );
}
