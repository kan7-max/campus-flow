import Link from "next/link";
import { ExternalLink, Mail } from "lucide-react";
import { env } from "@/lib/env";
import { BETA_CONTACT_EMAIL, BETA_CONTACT_MAILTO, isBetaScreenOption } from "@/lib/betaInfo";
import { FeedbackMailtoForm } from "@/components/beta/feedback-mailto-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type FeedbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveDefaultScreen(value: string | string[] | undefined) {
  const picked = firstParam(value);
  if (picked && isBetaScreenOption(picked)) {
    return picked;
  }
  return "/ai";
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const params = await searchParams;
  const defaultScreen = resolveDefaultScreen(params.screen);
  const externalFormUrl = env.BETA_FEEDBACK_FORM_URL?.trim() || null;

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Feedback</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">不具合・感想フォーム（GitHub不要）</h1>
          <p className="text-sm text-muted-foreground">
            βテスター向けの連絡窓口です。課題本文の全文や個人情報は必要な範囲だけ送ってください。
          </p>
        </section>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">送信方法</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>報告種別と発生画面を選択する</li>
            <li>「何をしたか / 期待した動き / 実際の動き」を内容に書く</li>
            <li>送信ボタンを押してメールアプリから送る</li>
          </ol>
          <FeedbackMailtoForm defaultScreen={defaultScreen} />
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">別経路で送る</h2>
          <div className="flex flex-wrap gap-2">
            {externalFormUrl ? (
              <a href={externalFormUrl} target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline">
                  外部フォームを開く
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            ) : null}
            <a href={BETA_CONTACT_MAILTO} className="inline-flex">
              <Button variant="outline">
                <Mail className="h-4 w-4" />
                {BETA_CONTACT_EMAIL}
              </Button>
            </a>
            <Link href="/beta-guide" className="inline-flex">
              <Button variant="outline">β案内に戻る</Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
