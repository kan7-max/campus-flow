import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Bug, CheckCircle2, ExternalLink, Mail, Smartphone } from "lucide-react";
import { env } from "@/lib/env";
import { BETA_CONTACT_EMAIL, BETA_CONTACT_MAILTO } from "@/lib/betaInfo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type BetaGuideView = "pc" | "mobile";

type BetaGuideContentProps = {
  view: BetaGuideView;
  basePath: string;
};

type SlideImage = {
  src: string;
  width: number;
  height: number;
};

const SLIDE_IMAGES: Record<BetaGuideView, SlideImage[]> = {
  pc: [1, 2, 3, 4, 5].map((page) => ({
    src: `/docs/beta/beta-guide-pc-${String(page).padStart(2, "0")}.png`,
    width: 2560,
    height: 1440
  })),
  mobile: [1, 2, 3, 4, 5].map((page) => ({
    src: `/docs/beta/beta-guide-mobile-${String(page).padStart(2, "0")}.png`,
    width: 1440,
    height: 2560
  }))
};

const GUIDE_DECK_FILES: Record<BetaGuideView, string> = {
  pc: "/beta-guides/Campus_Flow_new_user_guide_one_glance_wide.pptx",
  mobile: "/beta-guides/Campus_Flow_new_user_guide_one_glance_vertical.pptx"
};

function toPublicFilePath(src: string) {
  return join(process.cwd(), "public", src.replace(/^\//, ""));
}

function hasPublicImage(src: string) {
  return existsSync(toPublicFilePath(src));
}

function viewTitle(view: BetaGuideView) {
  return view === "mobile" ? "スマホ向け資料" : "PC向け資料";
}

export function BetaGuideContent({ view, basePath }: BetaGuideContentProps) {
  const slides = SLIDE_IMAGES[view].filter((item) => hasPublicImage(item.src));
  const feedbackFormUrl = env.BETA_FEEDBACK_FORM_URL?.trim() || null;
  const feedbackGuidePath = "/feedback?screen=/beta-guide";
  const deckFile = GUIDE_DECK_FILES[view];
  const appLinks = [
    { href: "/dashboard", label: "アプリを開く" },
    { href: "/ai", label: "AI入力を開く" },
    { href: "/today", label: "今日やることを見る" },
    { href: "/assignments", label: "課題一覧を見る" },
    { href: feedbackGuidePath, label: "不具合・感想を送る" },
    { href: "/terms", label: "利用規約" },
    { href: "/privacy", label: "プライバシーポリシー" }
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Beta Guide</p>
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Campus Flow βテスター向け案内</h1>
          <p className="text-sm text-muted-foreground">
            Campus Flowは時間割アプリではなく、大学生向けのAI課題整理アプリです。WebClass / LMSの課題文を貼るとAIが候補を整理し、
            抽出結果を確認・編集して保存すると、今日やることへつながります。
          </p>
        </section>

        <Card className="border-warning/35 bg-warning/10">
          <div className="flex items-start gap-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              β版のため、AI抽出結果（課題名・締切・授業名）は必ず保存前に確認してください。不具合や改善点はGitHub不要で送れます。
            </p>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">配布用リンク</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {appLinks.map((item) => (
              <Link key={item.href} href={item.href} className="inline-flex">
                <Button variant="outline" className="w-full justify-between">
                  {item.label}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            ))}
            {feedbackFormUrl ? (
              <a href={feedbackFormUrl} target="_blank" rel="noreferrer" className="inline-flex">
                <Button variant="outline" className="w-full justify-between">
                  外部フォームを開く
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            ) : null}
            <a href={BETA_CONTACT_MAILTO} className="inline-flex">
              <Button variant="outline" className="w-full justify-between">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {BETA_CONTACT_EMAIL}
                </span>
              </Button>
            </a>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">3分で開始</h2>
          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            {[
              { title: "1. ログイン", text: "アプリを開いてGoogleでログインします。" },
              { title: "2. 授業を追加", text: "「授業を追加」で授業名、曜日、時限を入れて「授業を保存」を押します。" },
              { title: "3. 今日やることを確認", text: "「今日やること」で保存済みの課題と次の作業を確認します。" }
            ].map((item) => (
              <div key={item.title} className="rounded-md border border-border bg-muted/50 p-3">
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  {item.title}
                </p>
                <p className="mt-1">{item.text}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-2">
          <h2 className="text-base font-semibold">PWAでの使い方（短縮版）</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>iPhone: Safariで開く → 共有 → ホーム画面に追加</li>
            <li>Android: Chromeで開く → メニュー → ホーム画面に追加</li>
          </ul>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-semibold">つまずきやすい操作</h2>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">曜日/時限が分からない</p>
              <p className="mt-1">まず分かる曜日と開始・終了時刻で「授業を保存」し、あとから授業編集で直してください。</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">時間割画像/PDFから作成に失敗した</p>
              <p className="mt-1">「授業を追加」に戻り、授業名、曜日、時限を手入力して「授業を保存」を押してください。</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">保存に失敗した</p>
              <p className="mt-1">入力欄の下に出る赤い案内を直して、同じ画面で「授業を保存」または「選択候補を保存」をもう一度押してください。</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">AI抽出結果が違う</p>
              <p className="mt-1">保存前の抽出プレビューで課題名・授業名・締切を修正してから「選択候補を保存」を押してください。</p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{viewTitle(view)}</h2>
            <Link href={`${basePath}?view=pc`} className="inline-flex">
              <Button variant={view === "pc" ? "default" : "outline"} size="sm">PC向け</Button>
            </Link>
            <Link href={`${basePath}?view=mobile`} className="inline-flex">
              <Button variant={view === "mobile" ? "default" : "outline"} size="sm">
                <Smartphone className="h-4 w-4" />
                スマホ向け
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            ページ内表示は高解像度PNGです。資料本体を確認したい場合はPPTXを開いてください。
          </p>
          <a href={deckFile} target="_blank" rel="noreferrer" className="inline-flex">
            <Button variant="outline">
              PPTXを開く
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </Card>

        {slides.length > 0 ? (
          <section
            className={
              view === "mobile"
                ? "-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3"
                : "space-y-4"
            }
          >
            {slides.map((slide, index) => (
              <Card
                key={slide.src}
                className={view === "mobile" ? "w-[82vw] shrink-0 snap-start overflow-hidden p-0 sm:w-auto" : "overflow-hidden p-0"}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>
                    {viewTitle(view)} {index + 1} / {slides.length}
                  </span>
                  <a href={slide.src} target="_blank" rel="noreferrer" className="inline-flex">
                    <Button variant="ghost" size="sm">
                      原寸を開く
                    </Button>
                  </a>
                </div>
                <Image
                  src={slide.src}
                  alt={`βテスター用資料 ${index + 1}ページ目`}
                  width={slide.width}
                  height={slide.height}
                  unoptimized
                  priority={index < 2}
                  sizes="(max-width: 768px) 100vw, 960px"
                  className="h-auto w-full max-w-full object-contain"
                />
              </Card>
            ))}
          </section>
        ) : (
          <Card className="border-warning/35 bg-warning/10">
            <div className="space-y-2 text-sm text-warning">
              <p className="font-semibold">資料画像が見つかりません。</p>
              <p>
                `public/docs/beta/beta-guide-pc-01.png` などのファイルを配置すると、このページで自動表示されます。
              </p>
            </div>
          </Card>
        )}

        <Card className="space-y-2">
          <h2 className="text-base font-semibold">不具合報告について</h2>
          <p className="text-sm text-muted-foreground">
            GitHubアカウントは不要です。`/feedback` か外部フォーム、または {BETA_CONTACT_EMAIL} 宛のメールで送信してください。
          </p>
          <Link href={feedbackGuidePath} className="inline-flex">
            <Button>
              <Bug className="h-4 w-4" />
              不具合・感想を送る
            </Button>
          </Link>
        </Card>
      </div>
    </main>
  );
}
