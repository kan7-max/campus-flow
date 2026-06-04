import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-card">
        <h1 className="text-2xl font-semibold">ページが見つかりません</h1>
        <p className="mt-2 text-sm text-muted-foreground">URLを確認するか、ダッシュボードへ戻ってください。</p>
        <Link href="/dashboard" className="mt-4 inline-flex">
          <Button>ダッシュボードへ</Button>
        </Link>
      </div>
    </main>
  );
}
