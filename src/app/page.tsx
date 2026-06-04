import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const user = await getCurrentUser();
  const href = user ? "/dashboard" : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">Campus TaskFlow</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">今日やることを開きます</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          サイドWebで自動遷移が止まった場合も、ここからアプリに入れます。
        </p>
        <Link href={href} className="mt-5 block">
          <Button className="w-full">{user ? "Dashboardを開く" : "ログインへ進む"}</Button>
        </Link>
      </section>
    </main>
  );
}
