import Link from "next/link";
import { CheckCircle2, ListChecks, Settings2, Sparkles, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { getUserSettings } from "@/lib/repositories/settingsRepository";
import type { Assignment } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setupCompleted(params: Record<string, string | string[] | undefined>) {
  return toSingle(params.setup) === "completed";
}

function getTodayNotice(params: Record<string, string | string[] | undefined>) {
  const notice = toSingle(params.today);

  if (notice === "preferences_updated") {
    return {
      className: "border-success/35 bg-success/10 text-success",
      message: "今日の作戦を保存しました。"
    };
  }

  if (notice === "preferences_fallback") {
    return {
      className: "border-warning/35 bg-warning/10 text-warning",
      message: "設定保存はできませんでしたが、今日の表示には反映しました。"
    };
  }

  return null;
}

function getNextActionText(assignment: Assignment) {
  if (assignment.progress >= 75) {
    return "提出条件を確認して完了へ";
  }

  switch (assignment.assignmentType) {
    case "lab_report":
      return "データ・グラフを確認する";
    case "report":
      return "課題内容を確認する";
    case "quiz":
    case "exam":
      return "範囲を確認する";
    case "presentation":
      return "原稿・資料を確認する";
    case "homework":
      return "問題を確認する";
    default:
      return "内容を確認する";
  }
}

function formatDueLabel(dueAt: string) {
  const match = dueAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return "締切確認";
  }

  return `${match[2]}/${match[3]}`;
}

function QuietDashboardHome() {
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">Campus TaskFlow</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl">まずは1つだけ</h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:hidden">
            AI入力か今日やることから始められます。
          </p>
          <p className="mt-2 hidden max-w-2xl text-sm leading-6 text-muted-foreground sm:block">
            開いた瞬間に全部を見せず、課題の追加・今日やること・一覧確認だけに絞りました。詳しい状況は必要なときだけ開けます。
          </p>
        </div>
        <div className="hidden rounded-full border border-primary/20 bg-primary/10 p-3 text-primary sm:block">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 sm:mt-5 sm:grid-cols-3 sm:gap-2">
        <Link href="/ai" className="block">
          <Button className="h-9 w-full justify-start text-xs sm:h-10 sm:text-sm">
            <Sparkles className="h-4 w-4" />
            AIで課題を入れる
          </Button>
        </Link>
        <Link href="/today" className="block">
          <Button className="h-9 w-full justify-start text-xs sm:h-10 sm:text-sm" variant="outline">
            <Timer className="h-4 w-4" />
            今日やること
          </Button>
        </Link>
        <Link href="/assignments" className="block">
          <Button className="h-9 w-full justify-start text-xs sm:h-10 sm:text-sm" variant="outline">
            <ListChecks className="h-4 w-4" />
            課題一覧
          </Button>
        </Link>
      </div>
    </section>
  );
}

function NextActionCard({ assignment }: { assignment: Assignment | null }) {
  if (!assignment) {
    return (
      <section className="rounded-lg border border-border bg-card p-3 shadow-sm sm:p-4">
        <p className="text-xs font-semibold text-primary">次やること</p>
        <p className="mt-1 text-sm font-semibold text-foreground">今すぐ必要な課題は落ち着いています</p>
        <p className="mt-1 text-xs text-muted-foreground">新しい課題があればAI入力から追加できます。</p>
      </section>
    );
  }

  return (
    <Link
      href={`/assignments/${assignment.id}`}
      className="block rounded-lg border border-primary/25 bg-primary/5 p-3 shadow-sm transition hover:border-primary/45 hover:bg-primary/10 sm:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">次やること</p>
          <h2 className="mt-1 line-clamp-1 text-base font-semibold text-foreground">{getNextActionText(assignment)}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{assignment.title}</p>
        </div>
        <span className="shrink-0 rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-muted-foreground">
          {formatDueLabel(assignment.dueAt)}
        </span>
      </div>
    </Link>
  );
}

function OptionalInfoPanel() {
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/60">
        <div>
          <p className="text-sm font-semibold text-foreground">詳しい状況は必要なときだけ</p>
          <p className="mt-1 text-xs text-muted-foreground">期限超過・未整理メモ・今日の作戦は、確認したい時に開きます。</p>
        </div>
        <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground group-open:border-primary/45 group-open:bg-primary/10 group-open:text-primary">
          表示
        </span>
      </summary>
      <div className="grid gap-2 border-t border-border p-4 text-sm text-muted-foreground sm:grid-cols-2">
        <Link href="/today" className="rounded-md border border-border bg-background px-3 py-2 transition hover:border-primary/40 hover:text-primary">
          今日の詳細を見る
        </Link>
        <Link href="/inbox" className="rounded-md border border-border bg-background px-3 py-2 transition hover:border-primary/40 hover:text-primary">
          未整理メモを確認する
        </Link>
        <Link href="/settings" className="rounded-md border border-border bg-background px-3 py-2 transition hover:border-primary/40 hover:text-primary">
          通知・連携を確認する
        </Link>
        <Link href="/assignments/new" className="rounded-md border border-border bg-background px-3 py-2 transition hover:border-primary/40 hover:text-primary">
          手動で課題を追加する
        </Link>
      </div>
    </details>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getUserSettings(user.id);
  const assignments = await listAssignments(user.id, { onlyIncomplete: true, sortBy: "due" });
  const nextAssignment = assignments[0] ?? null;
  const todayNotice = getTodayNotice(params);

  return (
    <div className="space-y-3 sm:space-y-5">
      {todayNotice ? (
        <section className={`rounded-lg border px-4 py-3 text-sm ${todayNotice.className}`}>{todayNotice.message}</section>
      ) : null}

      {setupCompleted(params) ? (
        <section className="rounded-lg border border-success/35 bg-success/10 px-4 py-3 text-sm text-success">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            初回セットアップを保存しました。
          </div>
        </section>
      ) : null}

      {!settings.onboardingCompleted ? (
        <section className="rounded-lg border border-primary/35 bg-primary/10 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-primary">3分で初回セットアップ</h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                作業時間と通知の使い方を決めると、今日やることの表示が自分向けになります。
              </p>
            </div>
            <Link href="/setup">
              <Button variant="outline">
                <Settings2 className="h-4 w-4" />
                セットアップ
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      <QuietDashboardHome />
      <NextActionCard assignment={nextAssignment} />
      <OptionalInfoPanel />
    </div>
  );
}
