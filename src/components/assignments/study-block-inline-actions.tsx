import Link from "next/link";
import { CalendarPlus, CheckCircle2, PlayCircle, RotateCcw } from "lucide-react";
import {
  completeStudyBlockAction,
  postponeStudyBlockToTomorrowAction,
  restoreStudyBlockToPlannedAction,
  startStudyBlockWorkSessionAction
} from "@/lib/actions/assignmentActions";
import { Button } from "@/components/ui/button";

type StudyBlockInlineActionsProps = {
  assignmentId: string | null;
  assignmentProgress?: number | null;
  blockId: string | null;
  canUseSavedBlock?: boolean;
  compact?: boolean;
  detailHref?: string | null;
  isAssignmentDone?: boolean;
  isClosed?: boolean;
  sourcePath?: string | null;
  showRestore?: boolean;
};

export function StudyBlockInlineActions({
  assignmentId,
  assignmentProgress = null,
  blockId,
  canUseSavedBlock = true,
  compact = false,
  detailHref = null,
  isAssignmentDone = false,
  isClosed = false,
  sourcePath = null,
  showRestore = false
}: StudyBlockInlineActionsProps) {
  const closed = isClosed || isAssignmentDone;
  const nextProgress =
    typeof assignmentProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(Math.min(100, assignmentProgress + 25))))
      : null;

  return (
    <div className="flex flex-wrap gap-2">
      <form action={startStudyBlockWorkSessionAction}>
        {blockId ? <input type="hidden" name="blockId" value={blockId} /> : null}
        {assignmentId ? <input type="hidden" name="assignmentId" value={assignmentId} /> : null}
        {sourcePath ? <input type="hidden" name="sourcePath" value={sourcePath} /> : null}
        <Button disabled={!assignmentId || closed} size="sm" type="submit" variant={compact ? "outline" : "default"}>
          <PlayCircle className="h-4 w-4" />
          25分開始
        </Button>
      </form>

      <form action={completeStudyBlockAction}>
        {blockId ? <input type="hidden" name="blockId" value={blockId} /> : null}
        {assignmentId ? <input type="hidden" name="assignmentId" value={assignmentId} /> : null}
        {sourcePath ? <input type="hidden" name="sourcePath" value={sourcePath} /> : null}
        {nextProgress !== null ? <input type="hidden" name="nextProgress" value={String(nextProgress)} /> : null}
        <Button disabled={!assignmentId || closed} size="sm" type="submit" variant="outline">
          <CheckCircle2 className="h-4 w-4" />
          完了
        </Button>
      </form>

      {canUseSavedBlock ? (
        <form action={postponeStudyBlockToTomorrowAction}>
          {blockId ? <input type="hidden" name="blockId" value={blockId} /> : null}
          {sourcePath ? <input type="hidden" name="sourcePath" value={sourcePath} /> : null}
          <Button disabled={closed || !blockId} size="sm" type="submit" variant="outline">
            <CalendarPlus className="h-4 w-4" />
            明日
          </Button>
        </form>
      ) : null}

      {canUseSavedBlock && showRestore ? (
        <form action={restoreStudyBlockToPlannedAction}>
          {blockId ? <input type="hidden" name="blockId" value={blockId} /> : null}
          {sourcePath ? <input type="hidden" name="sourcePath" value={sourcePath} /> : null}
          <Button disabled={isAssignmentDone || !blockId} size="sm" type="submit" variant="outline">
            <RotateCcw className="h-4 w-4" />
            戻す
          </Button>
        </form>
      ) : null}

      {detailHref ? (
        <Link href={detailHref}>
          <Button size="sm" type="button" variant="outline">
            詳細
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
