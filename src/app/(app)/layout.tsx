import { requireUser } from "@/lib/auth";
import { isSupabaseEnabled } from "@/lib/env";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell user={user} isSupabaseEnabled={isSupabaseEnabled}>
      {children}
    </AppShell>
  );
}
