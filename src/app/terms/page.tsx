import Link from "next/link";
import { BETA_CONTACT_EMAIL, BETA_CONTACT_MAILTO } from "@/lib/betaInfo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Terms</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">利用規約（β版）</h1>
        </section>

        <Card className="space-y-2 text-sm text-muted-foreground">
          <p>Campus Flowはβテスト中のAI課題整理アプリです。抽出結果は必ず利用者自身で確認してください。</p>
          <p>AI抽出や外部連携が失敗しても、入力データが保存されることを優先する設計方針です。</p>
          <p>
            不具合報告やお問い合わせは
            <a href={BETA_CONTACT_MAILTO} className="mx-1 underline underline-offset-4">
              {BETA_CONTACT_EMAIL}
            </a>
            へ送ってください。
          </p>
        </Card>

        <Link href="/beta-guide" className="inline-flex">
          <Button variant="outline">β案内へ戻る</Button>
        </Link>
      </div>
    </main>
  );
}
