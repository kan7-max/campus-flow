"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare, LayoutDashboard, PlusCircle, Settings, Timer } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", icon: LayoutDashboard, label: "ホーム" },
  { href: "/today", icon: Timer, label: "今日" },
  { href: "/add", icon: PlusCircle, label: "追加", primary: true },
  { href: "/assignments", icon: CheckSquare, label: "課題" },
  { href: "/calendar", icon: CalendarDays, label: "予定" },
  { href: "/settings", icon: Settings, label: "設定" }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-2 pb-safe pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <ul className="grid grid-cols-6 gap-1">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={`${tab.href}-${tab.label}`}>
              <Link
                href={tab.href}
                className={cn(
                  "flex h-14 flex-col items-center justify-center rounded-md py-2 text-[10px] font-semibold leading-none",
                  tab.primary && "bg-primary text-primary-foreground shadow-sm",
                  active && !tab.primary ? "bg-primary/10 text-primary" : !tab.primary && "text-muted-foreground"
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
