"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { BookOpen, CalendarClock, CheckCircle2, ChevronDown, MoreHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  deleteAssignmentInPlaceAction,
  setAssignmentDueDateAction,
  setAssignmentStatusAction
} from "@/lib/actions/assignmentActions";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/constants/domain";
import type { Assignment, AssignmentStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AssignmentMinimalCardProps = {
  assignment: Assignment;
  className?: string;
  nextAction?: string;
};

type DueTone = "danger" | "neutral" | "success" | "warning";

const statusClassName: Record<AssignmentStatus, string> = {
  todo: "border-border bg-muted text-muted-foreground",
  in_progress: "border-primary/35 bg-primary/10 text-primary",
  done: "border-success/35 bg-success/10 text-success"
};

function dueDistance(dueAt: string, status: AssignmentStatus): { text: string; tone: DueTone } {
  const due = parseISO(dueAt);
  if (Number.isNaN(due.getTime())) {
    return { text: "締切確認", tone: "warning" };
  }

  const diff = differenceInCalendarDays(due, new Date());
  const tone: DueTone = status === "done" ? "success" : diff < 0 ? "danger" : diff <= 1 ? "warning" : "neutral";

  if (diff === 0) return { text: "今日", tone };
  if (diff === 1) return { text: "明日", tone };
  if (diff > 1) return { text: `あと${diff}日`, tone };
  return { text: `${Math.abs(diff)}日超過`, tone };
}

function stableDueDateText(dueAt: string): string {
  const match = dueAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return "締切";
  }

  return `${match[2]}/${match[3]}`;
}

function stableDueTooltip(dueAt: string): string {
  const full = dueAt.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (full) {
    return `締切: ${full[1]}/${full[2]}/${full[3]} ${full[4]}:${full[5]}`;
  }

  const dayOnly = dueAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dayOnly) {
    return `締切: ${dayOnly[1]}/${dayOnly[2]}/${dayOnly[3]}`;
  }

  return "締切を編集";
}

const dueToneClassName: Record<DueTone, string> = {
  danger: "border-danger/45 text-danger hover:bg-danger/5",
  neutral: "border-primary/35 text-muted-foreground hover:bg-primary/5 hover:text-primary",
  success: "border-success/35 text-success hover:bg-success/5",
  warning: "border-warning/45 text-warning hover:bg-warning/5"
};

const hydrationSubscribe = () => () => undefined;

function useIsHydrated() {
  return useSyncExternalStore(
    hydrationSubscribe,
    () => true,
    () => false
  );
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function EditPanel({
  children,
  onClose,
  title
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="閉じる"
        className="fixed inset-0 z-[60] bg-black/45 sm:hidden"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 bottom-0 z-[70] rounded-t-lg border border-border bg-card p-4 shadow-card sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-80 sm:rounded-lg">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{title}</p>
          <button
            type="button"
            className="touch-manipulation grid h-10 w-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:h-8 sm:w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function AssignmentMinimalCard({ assignment, className, nextAction }: AssignmentMinimalCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isHydrated = useIsHydrated();
  const [statusOpen, setStatusOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState(assignment.status);
  const [localDueAt, setLocalDueAt] = useState(assignment.dueAt);
  const [dueInput, setDueInput] = useState(toDateTimeLocal(assignment.dueAt));
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const detailHref = `/assignments/${assignment.id}`;
  const courseHref = assignment.courseId ? `/courses/${assignment.courseId}` : null;
  const courseLabel = assignment.course?.name ?? "授業未設定";
  const due: { text: string; tone: DueTone } = isHydrated
    ? dueDistance(localDueAt, localStatus)
    : {
        text: stableDueDateText(localDueAt),
        tone: localStatus === "done" ? "success" : "neutral"
      };
  const dueTitle = (() => {
    if (!isHydrated) {
      return stableDueTooltip(localDueAt);
    }

    const parsed = parseISO(localDueAt);
    if (Number.isNaN(parsed.getTime())) {
      return "締切を編集";
    }

    return `締切: ${format(parsed, "yyyy/MM/dd HH:mm")}`;
  })();

  function closeAllPanels() {
    setStatusOpen(false);
    setDueOpen(false);
    setMenuOpen(false);
    setDeleteOpen(false);
  }

  function runMutation(
    action: () => Promise<void>,
    options?: { onError?: () => void; refresh?: boolean }
  ) {
    setActionError(null);
    startTransition(async () => {
      try {
        await action();
        closeAllPanels();
        if (options?.refresh) {
          router.refresh();
        }
      } catch (error) {
        console.error("Assignment card mutation failed", error);
        options?.onError?.();
        setActionError("反映に失敗しました。時間をおいて再試行してください。");
      }
    });
  }

  return (
    <article
      aria-label={`${assignment.title} の詳細を開く`}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a,button,input,form,select,textarea")) return;
        router.push(detailHref);
      }}
      className={cn(
        "group relative cursor-pointer touch-manipulation rounded-lg border border-border bg-card p-2.5 shadow-card transition hover:border-primary/45 hover:shadow-md sm:p-3",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Link
            href={detailHref}
            className="block line-clamp-2 text-[15px] font-bold leading-5 tracking-tight text-foreground decoration-primary/45 underline-offset-4 hover:text-primary hover:underline sm:text-base sm:leading-6"
          >
            {assignment.title}
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/80 px-2 py-0.5">
              <BookOpen className="h-3 w-3 shrink-0" />
              {courseHref ? (
                <Link href={courseHref} className="min-w-0 truncate hover:text-primary">
                  {courseLabel}
                </Link>
              ) : (
                <span className="min-w-0 truncate">{courseLabel}</span>
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isPending}
          className={cn(
            "touch-manipulation inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md border border-dashed px-2 text-[11px] font-bold transition sm:min-h-9 sm:text-sm",
            dueToneClassName[due.tone]
          )}
          title={dueTitle}
          onClick={() => {
            setDueInput(toDateTimeLocal(localDueAt));
            setDueOpen((current) => !current);
            setStatusOpen(false);
            setMenuOpen(false);
          }}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          {due.text}
        </button>
      </div>

      {nextAction ? (
        <p className="mt-2 line-clamp-1 rounded-md border border-border/50 bg-muted/60 px-2 py-1 text-[11px] leading-4 text-muted-foreground sm:text-xs">
          <span className="mr-1 font-semibold text-primary">次</span>
          {nextAction}
        </p>
      ) : null}

      <div className="relative mt-2 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
        <button
          type="button"
          disabled={isPending}
          className={cn(
            "touch-manipulation inline-flex min-h-7 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:border-primary/45 sm:min-h-8 sm:text-xs",
            statusClassName[localStatus]
          )}
          title="ステータスを変更"
          onClick={() => {
            setStatusOpen((current) => !current);
            setDueOpen(false);
            setMenuOpen(false);
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {ASSIGNMENT_STATUS_LABELS[localStatus]}
          <ChevronDown className="h-3 w-3" />
        </button>

        <button
          type="button"
          disabled={isPending}
          className="touch-manipulation grid h-7 w-7 place-items-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary/45 hover:bg-accent hover:text-primary sm:h-8 sm:w-8"
          aria-label="その他"
          title="その他"
          onClick={() => {
            setMenuOpen((current) => !current);
            setStatusOpen(false);
            setDueOpen(false);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {statusOpen ? (
          <EditPanel title="ステータス変更" onClose={() => setStatusOpen(false)}>
            <div className="grid gap-2">
              {(["todo", "in_progress", "done"] satisfies AssignmentStatus[]).map((status) => (
                <Button
                  key={status}
                  type="button"
                  disabled={isPending}
                  variant={localStatus === status ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => {
                    const previousStatus = localStatus;
                    setLocalStatus(status);
                    runMutation(async () => {
                      const formData = new FormData();
                      formData.set("id", assignment.id);
                      formData.set("status", status);
                      formData.set("sourcePath", pathname);
                      await setAssignmentStatusAction(formData);
                    }, { onError: () => setLocalStatus(previousStatus) });
                  }}
                >
                  {ASSIGNMENT_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          </EditPanel>
        ) : null}

        {dueOpen ? (
          <EditPanel title="締切日時を編集" onClose={() => setDueOpen(false)}>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                const nextDueInput = formData.get("dueAt")?.toString() ?? dueInput;
                const nextDueDate = new Date(nextDueInput);
                const nextDueAt = Number.isNaN(nextDueDate.getTime()) ? localDueAt : nextDueDate.toISOString();
                const previousDueAt = localDueAt;
                setLocalDueAt(nextDueAt);
                runMutation(async () => {
                  formData.set("sourcePath", pathname);
                  await setAssignmentDueDateAction(formData);
                }, { onError: () => setLocalDueAt(previousDueAt) });
              }}
            >
              <input type="hidden" name="id" value={assignment.id} />
              <input
                name="dueAt"
                type="datetime-local"
                value={dueInput}
                onChange={(event) => setDueInput(event.currentTarget.value)}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary/70 focus:ring-2 focus:ring-primary/20"
                disabled={isPending}
                required
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                保存
              </Button>
            </form>
          </EditPanel>
        ) : null}

        {menuOpen ? (
          <EditPanel title="その他" onClose={() => setMenuOpen(false)}>
            <div className="grid gap-2">
              <Link href={detailHref}>
                <Button variant="outline" className="w-full justify-start">
                  詳細を開く
                </Button>
              </Link>
              <Link href={`/assignments/${assignment.id}/edit`}>
                <Button variant="outline" className="w-full justify-start">
                  編集
                </Button>
              </Link>
              <Button
                type="button"
                variant="danger"
                className="w-full justify-start"
                disabled={isPending}
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteOpen(true);
                }}
              >
                課題を削除
              </Button>
            </div>
          </EditPanel>
        ) : null}

        {deleteOpen ? (
          <EditPanel title="課題を削除" onClose={() => setDeleteOpen(false)}>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                「{assignment.title}」を削除しますか？
                <br />
                Google Calendarの削除同期に失敗しても、課題の削除は優先して実行します。
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => setDeleteOpen(false)}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={isPending}
                  onClick={() =>
                    runMutation(async () => {
                      const formData = new FormData();
                      formData.set("id", assignment.id);
                      formData.set("sourcePath", pathname);
                      await deleteAssignmentInPlaceAction(formData);
                    }, { refresh: true })
                  }
                >
                  削除する
                </Button>
              </div>
            </div>
          </EditPanel>
        ) : null}
      </div>

      {actionError ? (
        <p className="mt-3 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-xs text-danger">{actionError}</p>
      ) : null}
    </article>
  );
}
