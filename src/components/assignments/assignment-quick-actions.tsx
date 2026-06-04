"use client";

import { type ReactNode, useActionState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarMinus,
  CalendarPlus,
  CalendarX2,
  CheckCircle2,
  Timer,
  TrendingUp
} from "lucide-react";
import {
  postponeAssignmentToTomorrowWithUndoAction,
  restoreAssignmentDueDateAction,
  restoreAssignmentProgressAction,
  setAssignmentProgressWithUndoAction,
  startAssignmentWorkSessionAction
} from "@/lib/actions/assignmentActions";
import type { AssignmentQuickActionState } from "@/lib/actions/assignmentActions";
import { formatDateTime } from "@/lib/utils";
import type { Assignment } from "@/lib/types/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type QuickActionButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  title: string;
  variant?: "default" | "outline" | "secondary";
};

function QuickActionButton({
  children,
  disabled = false,
  title,
  variant = "outline"
}: QuickActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-label={title}
      className="h-10 shrink-0 px-2.5 sm:h-8"
      disabled={disabled || pending}
      size="sm"
      title={title}
      type="submit"
      variant={variant}
    >
      {children}
    </Button>
  );
}

const initialQuickActionState: AssignmentQuickActionState = {
  message: null,
  tone: "success",
  undo: null
};

function QuickActionFeedback({
  assignment,
  dueState,
  pathname,
  progressState,
  restoreDueAction,
  restoreProgressAction
}: {
  assignment: Assignment;
  dueState: AssignmentQuickActionState;
  pathname: string;
  progressState: AssignmentQuickActionState;
  restoreDueAction: (formData: FormData) => void;
  restoreProgressAction: (formData: FormData) => void;
}) {
  const progressUndo =
    progressState.undo?.type === "progress" &&
    typeof progressState.undo.progress === "number" &&
    assignment.progress !== progressState.undo.progress
      ? progressState.undo
      : null;
  const dueUndo =
    dueState.undo?.type === "due" && dueState.undo.dueAt && assignment.dueAt !== dueState.undo.dueAt
      ? dueState.undo
      : null;
  const restoreMessage = !progressUndo && !dueUndo ? progressState.message ?? dueState.message : null;

  if (!progressUndo && !dueUndo && !restoreMessage) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-success/35 bg-success/10 px-3 py-2 text-xs text-success">
      <span>{restoreMessage ?? progressState.message ?? dueState.message}</span>
      {progressUndo ? (
        <form action={restoreProgressAction}>
          <input type="hidden" name="id" value={progressUndo.assignmentId} />
          <input type="hidden" name="progress" value={progressUndo.progress} />
          <input type="hidden" name="sourcePath" value={pathname} />
          <QuickActionButton title="進捗を元に戻す" variant="outline">
            取り消す
          </QuickActionButton>
        </form>
      ) : null}
      {dueUndo ? (
        <form action={restoreDueAction}>
          <input type="hidden" name="id" value={dueUndo.assignmentId} />
          <input type="hidden" name="dueAt" value={dueUndo.dueAt} />
          <input type="hidden" name="sourcePath" value={pathname} />
          <QuickActionButton title="締切を元に戻す" variant="outline">
            取り消す
          </QuickActionButton>
        </form>
      ) : null}
    </div>
  );
}

export function CalendarSyncStatusBadge({ assignment }: { assignment: Assignment }) {
  const sync = assignment.calendarSync;
  const lastSyncedText = sync?.lastSyncedAt ? `最終同期: ${formatDateTime(sync.lastSyncedAt)}` : null;
  const title = [lastSyncedText, sync?.errorMessage ? `エラー: ${sync.errorMessage}` : null].filter(Boolean).join(" / ");

  if (!sync) {
    return (
      <Badge className="gap-1.5 border-border/60 bg-muted text-muted-foreground" title="Google Calendar同期レコードなし">
        <CalendarMinus className="h-3.5 w-3.5" />
        Google未同期
      </Badge>
    );
  }

  if (sync.syncStatus === "synced") {
    return (
      <Badge className="gap-1.5 border-success/35 bg-success/10 text-success" title={title || "Google Calendar同期済み"}>
        <CalendarCheck2 className="h-3.5 w-3.5" />
        Google同期済み
      </Badge>
    );
  }

  if (sync.syncStatus === "failed") {
    return (
      <Badge className="gap-1.5 border-danger/35 bg-danger/10 text-danger" title={title || "Google Calendar同期失敗"}>
        <CalendarX2 className="h-3.5 w-3.5" />
        同期失敗
      </Badge>
    );
  }

  return (
    <Badge className="gap-1.5 border-warning/35 bg-warning/10 text-warning" title={title || "Google Calendar同期待ち"}>
      <CalendarClock className="h-3.5 w-3.5" />
      同期待ち
    </Badge>
  );
}

export function AssignmentQuickActions({ assignment }: { assignment: Assignment }) {
  const pathname = usePathname();
  const [progressState, progressAction] = useActionState(setAssignmentProgressWithUndoAction, initialQuickActionState);
  const [dueState, postponeAction] = useActionState(postponeAssignmentToTomorrowWithUndoAction, initialQuickActionState);
  const [, restoreProgressAction] = useActionState(restoreAssignmentProgressAction, initialQuickActionState);
  const [, restoreDueAction] = useActionState(restoreAssignmentDueDateAction, initialQuickActionState);
  const nextProgress = Math.min(100, assignment.progress + 25);
  const isDone = assignment.status === "done" || assignment.progress >= 100;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <form action={progressAction}>
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="progress" value={100} />
          <input type="hidden" name="sourcePath" value={pathname} />
          <QuickActionButton disabled={isDone} title="課題を完了にする" variant="secondary">
            <CheckCircle2 className="h-4 w-4" />
            完了
          </QuickActionButton>
        </form>

        <form action={startAssignmentWorkSessionAction}>
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="sourcePath" value={pathname} />
          <QuickActionButton disabled={isDone} title="25分作業を開始する">
            <Timer className="h-4 w-4" />
            25分
          </QuickActionButton>
        </form>

        <form action={progressAction}>
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="progress" value={nextProgress} />
          <input type="hidden" name="sourcePath" value={pathname} />
          <QuickActionButton disabled={isDone} title="進捗を25%進める">
            <TrendingUp className="h-4 w-4" />
            +25%
          </QuickActionButton>
        </form>

        <form action={postponeAction}>
          <input type="hidden" name="id" value={assignment.id} />
          <input type="hidden" name="sourcePath" value={pathname} />
          <QuickActionButton disabled={isDone} title="締切を明日に回す">
            <CalendarPlus className="h-4 w-4" />
            明日
          </QuickActionButton>
        </form>
      </div>

      <QuickActionFeedback
        assignment={assignment}
        dueState={dueState}
        pathname={pathname}
        progressState={progressState}
        restoreDueAction={restoreDueAction}
        restoreProgressAction={restoreProgressAction}
      />
    </div>
  );
}
