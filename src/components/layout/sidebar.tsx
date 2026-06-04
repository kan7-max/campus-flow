"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare, ClipboardList, Cog, Inbox, LayoutDashboard, Sparkles, Timer, BookOpen } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/today", label: "今日やること", icon: Timer },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/deadlines", label: "締切が近い", icon: ClipboardList },
  { href: "/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/assignments", label: "課題一覧", icon: CheckSquare },
  { href: "/courses", label: "授業別", icon: BookOpen },
  { href: "/ai", label: "AI入力", icon: Sparkles },
  { href: "/settings", label: "設定", icon: Cog }
];

type SidebarProps = {
  pathname: string;
};

export function Sidebar({ pathname }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-border bg-card p-4 lg:flex">
      <div className="mb-6 rounded-lg border border-border bg-muted px-3 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Campus</p>
        <h1 className="mt-2 text-xl font-semibold leading-tight tracking-tight">TaskFlow</h1>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">今日の自分を動かす課題ナビ</p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border border-primary/20 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
