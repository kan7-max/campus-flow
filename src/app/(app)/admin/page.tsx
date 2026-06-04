import Link from "next/link";
import { AlertTriangle, BarChart3, CalendarSync, Coins, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { resolveAdminAccess } from "@/lib/adminAccess";
import { getAdminOverviewMetrics, getAdminServiceChecks } from "@/lib/services/adminOperationsService";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function renderCount(value: number | null) {
  return value == null ? "計測未対応" : value.toLocaleString("ja-JP");
}

function serviceText(status: "configured" | "not_configured" | "candidate") {
  if (status === "configured") {
    return "設定あり";
  }
  if (status === "not_configured") {
    return "未設定";
  }
  return "導入候補";
}

function serviceTone(status: "configured" | "not_configured" | "candidate") {
  if (status === "configured") {
    return "border-success/40 bg-success/10 text-success";
  }
  if (status === "not_configured") {
    return "border-danger/40 bg-danger/10 text-danger";
  }
  return "border-warning/40 bg-warning/10 text-warning";
}

function alertToneClass(tone: "warning" | "danger") {
  if (tone === "danger") {
    return "text-danger";
  }
  return "text-warning";
}

function AccessDenied() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="運営ページ"
        description="管理者権限があるアカウントのみ閲覧できます。"
      />
      <Card className="border-danger/35 bg-danger/10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-danger" />
          <div className="space-y-2 text-sm text-danger">
            <p>このアカウントには運営ページの閲覧権限がありません。</p>
            <p className="text-danger/90">
              管理者に `ADMIN_EMAILS`（または既存 `OPERATIONS_ADMIN_EMAILS`）へのメール追加を依頼してください。
            </p>
            <Link href="/dashboard" className="inline-flex">
              <Button variant="outline">ダッシュボードへ戻る</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default async function AdminPage() {
  const user = await requireUser();
  const access = resolveAdminAccess(user);

  if (!access.isAdmin) {
    return <AccessDenied />;
  }

  const [metrics, serviceChecks] = await Promise.all([getAdminOverviewMetrics(), getAdminServiceChecks()]);
  const alerts: Array<{ tone: "warning" | "danger"; text: string }> = [];

  if ((metrics.aiExtractionFailedApprox ?? 0) > 0) {
    alerts.push({ tone: "danger", text: `AI抽出失敗が ${metrics.aiExtractionFailedApprox?.toLocaleString("ja-JP")} 件あります。` });
  }

  if ((metrics.calendarSyncFailedApprox ?? 0) > 0) {
    alerts.push({ tone: "warning", text: `Google Calendar同期失敗が ${metrics.calendarSyncFailedApprox?.toLocaleString("ja-JP")} 件あります。` });
  }

  const coreMissingServices = [
    ["OpenAI API Key", serviceChecks.openAi],
    ["Google OAuth / Calendar", serviceChecks.googleOAuthCalendar],
    ["Supabase接続", serviceChecks.supabase]
  ].filter(([, status]) => status !== "configured");

  if (coreMissingServices.length > 0) {
    alerts.push({
      tone: "warning",
      text: `未設定の必須サービスがあります: ${coreMissingServices.map(([name]) => name).join(" / ")}`
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="運営者ダッシュボード"
        description="βリリース前の運営状況をざっくり確認するための最小ページ"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/credits">
              <Button variant="outline">
                <Coins className="h-4 w-4" />
                クレジット管理
              </Button>
            </Link>
            <Link href="/operations">
              <Button variant="outline">運営方針メモ</Button>
            </Link>
          </div>
        }
      />

      <Card className="border-warning/40 bg-warning/10">
        <div className="flex items-start gap-3 text-sm text-warning">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            この画面は秘密値を表示しません。APIキー実値・課題本文・raw_text・授業メモ・Google Calendar本文は運営画面でも非表示です。
            `/admin` 系はサーバー側で管理者判定し、未許可アカウントは運営データに到達できません。
          </p>
        </div>
      </Card>

      <Card className="space-y-2">
        <h3 className="text-base font-semibold">要確認アラート</h3>
        {alerts.length === 0 ? (
          <p className="text-sm text-success">要対応アラートはありません。</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {alerts.map((item) => (
              <li key={item.text} className={alertToneClass(item.tone)}>{item.text}</li>
            ))}
          </ul>
        )}
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs text-muted-foreground">登録ユーザー数</p>
          <p className="mt-2 text-2xl font-semibold">{renderCount(metrics.registeredUsers)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">課題保存数</p>
          <p className="mt-2 text-2xl font-semibold">{renderCount(metrics.assignmentSaves)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">AI抽出回数</p>
          <p className="mt-2 text-2xl font-semibold">{renderCount(metrics.aiExtractionCount)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">AI抽出 失敗概算</p>
          <p className="mt-2 text-2xl font-semibold">{renderCount(metrics.aiExtractionFailedApprox)}</p>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="h-4 w-4 text-primary" />
            コア指標
          </h3>
          <div className="space-y-2 text-sm">
            <p>AI抽出 成功概算: <span className="font-medium">{renderCount(metrics.aiExtractionSuccessApprox)}</span></p>
            <p>Calendar同期 成功概算: <span className="font-medium">{renderCount(metrics.calendarSyncSuccessApprox)}</span></p>
            <p>Calendar同期 失敗概算: <span className="font-medium">{renderCount(metrics.calendarSyncFailedApprox)}</span></p>
            <p>エラー件数（概算）: <span className="font-medium">{renderCount(metrics.appErrorApprox)}</span></p>
            <p>問い合わせ件数: <span className="font-medium">{metrics.inquiryCountMemo}</span></p>
            <p>削除依頼件数: <span className="font-medium">{metrics.deletionRequestMemo}</span></p>
          </div>
        </Card>

        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CalendarSync className="h-4 w-4 text-primary" />
            外部サービス設定の存在確認
          </h3>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-2"><span>OpenAI API Key</span><Badge className={serviceTone(serviceChecks.openAi)}>{serviceText(serviceChecks.openAi)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>Google OAuth / Calendar</span><Badge className={serviceTone(serviceChecks.googleOAuthCalendar)}>{serviceText(serviceChecks.googleOAuthCalendar)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>Supabase接続</span><Badge className={serviceTone(serviceChecks.supabase)}>{serviceText(serviceChecks.supabase)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>Sentry</span><Badge className={serviceTone(serviceChecks.sentry)}>{serviceText(serviceChecks.sentry)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>PostHog</span><Badge className={serviceTone(serviceChecks.posthog)}>{serviceText(serviceChecks.posthog)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>Resend</span><Badge className={serviceTone(serviceChecks.resend)}>{serviceText(serviceChecks.resend)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>Stripe</span><Badge className={serviceTone(serviceChecks.stripe)}>{serviceText(serviceChecks.stripe)}</Badge></div>
            <div className="flex items-center justify-between gap-2"><span>Vercel環境変数</span><Badge className="border-warning/40 bg-warning/10 text-warning">手動確認</Badge></div>
          </div>
        </Card>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            運営ドキュメント
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link href="https://github.com/kan7-max/New-project/blob/main/docs/beta-release-operations-checklist.md" target="_blank" rel="noreferrer">
              <Button variant="outline">
                βチェックリスト
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com/kan7-max/New-project/blob/main/docs/admin-operations-runbook.md" target="_blank" rel="noreferrer">
              <Button variant="outline">
                Admin Runbook
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com/kan7-max/New-project/blob/main/docs/third-party-services-policy.md" target="_blank" rel="noreferrer">
              <Button variant="outline">
                外部サービス方針
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com/kan7-max/New-project/blob/main/docs/beta-distribution-guide.md" target="_blank" rel="noreferrer">
              <Button variant="outline">
                β配布ガイド
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            問い合わせ・削除依頼は初期運用ではスプレッドシート管理。運営者ページには本文データを表示しません。
          </p>
        </Card>

        <Card className="space-y-3">
          <h3 className="text-base font-semibold">βテスター向け資料</h3>
          <p className="text-sm text-muted-foreground">
            PC版とスマホ版の説明資料です。資料画像は `public/docs/beta` に配置しています。
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/beta-guide?view=pc" target="_blank" rel="noreferrer" className="inline-flex">
              <Button variant="outline">PC向け資料</Button>
            </Link>
            <Link href="/beta-guide?view=mobile" target="_blank" rel="noreferrer" className="inline-flex">
              <Button variant="outline">スマホ向け資料</Button>
            </Link>
          </div>
        </Card>
      </section>

      <Card className="space-y-2">
        <h3 className="text-base font-semibold">確認メモ</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {serviceChecks.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
