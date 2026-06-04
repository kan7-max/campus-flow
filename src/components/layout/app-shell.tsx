"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { RoutePrefetcher } from "@/components/layout/route-prefetcher";
import type { AppUser } from "@/lib/auth";

const BetaTesterGuidesGate = dynamic(
  () =>
    import("@/components/layout/beta-tester-guides-gate").then(
      (mod) => mod.BetaTesterGuidesGate
    ),
  { ssr: false }
);

const QuickAddMenu = dynamic(
  () => import("@/components/layout/quick-add-menu").then((mod) => mod.QuickAddMenu),
  { ssr: false }
);

type AppShellProps = {
  user: AppUser;
  isSupabaseEnabled: boolean;
  children: React.ReactNode;
};

export function AppShell({ user, isSupabaseEnabled, children }: AppShellProps) {
  const pathname = usePathname();
  const betaGuideUserKey = user.email?.trim().toLowerCase() || user.id;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <RoutePrefetcher />
      <Sidebar pathname={pathname} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopBar user={user} isSupabaseEnabled={isSupabaseEnabled} />
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-28 pt-5 sm:px-5 lg:px-8 lg:pb-10 lg:pt-7">
          {children}
        </main>
      </div>
      <BetaTesterGuidesGate userKey={betaGuideUserKey} />
      <QuickAddMenu />
      <MobileNav />
    </div>
  );
}
