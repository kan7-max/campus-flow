import Link from "next/link";
import { BETA_CONTACT_EMAIL, BETA_CONTACT_MAILTO } from "@/lib/betaInfo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Privacy</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">プライバシーポリシー（β版）</h1>
        </section>

        <Card className="space-y-2 text-sm text-muted-foreground">
          <p>Campus Flowは課題整理のために入力データを扱いますが、必要以上の個人情報入力は推奨していません。</p>
          <p>不具合報告時も、課題本文の全文や個人情報を必須にはしていません。</p>
          <p>
            データ削除依頼や問い合わせは
            <a href={BETA_CONTACT_MAILTO} className="mx-1 underline underline-offset-4">
              {BETA_CONTACT_EMAIL}
            </a>
            へ連絡してください。
          </p>
        </Card>

        <Link href="/beta-guide" className="inline-flex">
          <Button variant="outline">β案内へ戻る</Button>
        </Link>
      </div>
    </main>
  );
}
