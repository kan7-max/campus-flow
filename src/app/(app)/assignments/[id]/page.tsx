import Link from "next/link";
import { CalendarDays, CheckCircle2, PlayCircle, RefreshCw, RotateCcw, Timer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAssignmentById, listCalendarRecords } from "@/lib/repositories/assignmentRepository";
import { listAssignmentSteps } from "@/lib/repositories/assignmentStepRepository";
import { ASSIGNMENT_TAG_TEXT, ASSIGNMENT_TYPE_LABELS } from "@/lib/constants/domain";
import {
  completeAssignmentWorkSessionAction,
  retryAssignmentCalendarSyncAction,
  startAssignmentWorkSessionAction,
  undoCompletedWorkSessionAction
} from "@/lib/actions/assignmentActions";
import { getActiveWorkSession, listWorkSessions } from "@/lib/repositories/workSessionRepository";
import { listStudyBlocksForAssignment } from "@/lib/repositories/studyBlockRepository";
import type { Assignment, StudyBlock } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PriorityBadge } from "@/components/assignments/priority-badge";
import { StatusBadge } from "@/components/assignments/status-badge";
import { formatDateTime } from "@/lib/utils";
import { DeleteAssignmentForm } from "@/components/assignments/delete-assignment-form";
import { AssignmentStepPanel } from "@/components/assignments/assignment-step-panel";
import { AssignmentProgressPanel } from "@/components/assignments/assignment-progress-panel";
import { StudyBlockInlineActions } from "@/components/assignments/study-block-inline-actions";
import { ResourceNotFound } from "@/components/layout/resource-not-found";
import { formatCalendarSyncErrorMessage } from "@/lib/calendarSyncError";

type AssignmentDetailProps = {
  params: Promise<{ id: string }>;
};

const studyBlockStatusText: Record<StudyBlock["status"], string> = {
  planned: "予定",
  started: "作業中",
  completed: "完了",
  skipped: "スキップ",
  rescheduled: "延期"
};

const workSessionStatusText = {
  active: "作業中",
  cancelled: "取消済み",
  completed: "完了"
};

const calendarSyncStatusText: Record<"pending" | "synced" | "failed", string> = {
  pending: "同期待ち",
  synced: "同期済み",
  failed: "同期失敗"
};

const nextActionFallback: Record<Assignment["assignmentType"], string> = {
  exam: "範囲を確認する",
  homework: "内容を確認する",
  lab_report: "データや提出条件を確認する",
  other: "内容を確認する",
  presentation: "原稿・資料を確認する",
  quiz: "範囲を確認する",
  report: "構成を確認する"
};

function formatStudyBlockWindow(block: StudyBlock) {
  if (!block.startTime || !block.endTime) {
    return `${block.plannedDate} / ${block.durationMinutes}分`;
  }

  return `${block.plannedDate} ${block.startTime.slice(0, 5)} - ${block.endTime.slice(0, 5)}`;
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dueDistanceText(dueAt: string, status: Assignment["status"]) {
  if (status === "done") {
    return "完了済み";
  }

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return "締切確認";
  }

  const diff = Math.round((startOfLocalDate(due) - startOfLocalDate(new Date())) / 86_400_000);
  if (diff === 0) return "今日まで";
  if (diff === 1) return "明日まで";
  if (diff > 1) return `あと${diff}日`;
  return `${Math.abs(diff)}日超過`;
}

export default async function AssignmentDetailPage({ params }: AssignmentDetailProps) {
  const user = await requireUser();
  const { id } = await params;

  const assignment = await getAssignmentById(user.id, id);
  if (!assignment) {
    return (
      <ResourceNotFound
        title="課題が見つかりません"
        description="この課題は削除されたか、デモデータの再起動でIDが変わった可能性があります。課題一覧から現在の課題を開き直してください。"
        primaryHref="/assignments"
        primaryLabel="課題一覧へ"
      />
    );
  }

  const [steps, calendarRecords, activeSession, recentSessions, studyBlocks] = await Promise.all([
    listAssignmentSteps(user.id, assignment.id),
    listCalendarRecords(user.id, assignment.id),
    getActiveWorkSession(user.id, assignment.id),
    listWorkSessions(user.id, assignment.id),
    listStudyBlocksForAssignment(user.id, assignment.id)
  ]);

  const calendarState = calendarRecords[0];
  const nextStep = steps.find((step) => step.status !== "done");
  const nextAction = nextStep?.title ?? nextActionFallback[assignment.assignmentType];
  const completedStepCount = steps.filter((step) => step.status === "done").length;
  const dueLabel = dueDistanceText(assignment.dueAt, assignment.status);
  const isAssignmentDone = assignment.status === "done" || assignment.progress >= 100;

  return (
    <div className="space-y-5">
      <PageHeader
        title={assignment.title}
        description="課題詳細"
        actions={
          <>
            <Link href={`/assignments/${assignment.id}/edit`}>
              <Button variant="outline">編集</Button>
            </Link>
            <DeleteAssignmentForm assignmentId={assignment.id} assignmentTitle={assignment.title} />
          </>
        }
      />

      <Card className="space-y-4 border-primary/15">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={assignment.status} />
          <PriorityBadge label={assignment.priorityLabel} score={assignment.priorityScore} />
          <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
            {ASSIGNMENT_TYPE_LABELS[assignment.assignmentType]}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">締切</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{dueLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(assignment.dueAt)}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">授業</p>
            {assignment.courseId ? (
              <Link
                href={`/courses/${assignment.courseId}`}
                className="mt-1 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {assignment.course?.name ?? "授業未設定"}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-semibold text-foreground">未設定</p>
            )}
          </div>
          <div className="rounded-md border border-border bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">次にやること</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{nextAction}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {steps.length > 0 ? `${completedStepCount}/${steps.length} 完了` : "チェックリスト未作成"}
            </p>
          </div>
          <AssignmentProgressPanel
            key={`${assignment.id}-${assignment.progress}-${assignment.status}`}
            assignmentId={assignment.id}
            initialProgress={assignment.progress}
            initialStatus={assignment.status}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          {!activeSession ? (
            <form action={startAssignmentWorkSessionAction}>
              <input type="hidden" name="id" value={assignment.id} />
              <Button disabled={isAssignmentDone} variant="outline" size="sm" type="submit">
                <PlayCircle className="h-4 w-4" />
                25分開始
              </Button>
            </form>
          ) : (
            <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              25分セッション中
            </span>
          )}
        </div>
      </Card>

      <Card id="focus">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">25分作業セッション</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">実際に進めた時間を残して、次の計画精度を上げます。</p>
          </div>
          {!activeSession ? (
            <form action={startAssignmentWorkSessionAction}>
              <input type="hidden" name="id" value={assignment.id} />
              <Button variant="outline" size="sm" type="submit">
                <PlayCircle className="h-4 w-4" />
                25分開始
              </Button>
            </form>
          ) : null}
        </div>

        {activeSession ? (
          <form action={completeAssignmentWorkSessionAction} className="rounded-lg border border-primary/30 bg-primary/10 p-3">
            <input type="hidden" name="id" value={assignment.id} />
            <input type="hidden" name="sessionId" value={activeSession.id} />
            <p className="text-sm font-medium">作業中: {formatDateTime(activeSession.startedAt)} 開始</p>
            <p className="mt-1 text-xs text-muted-foreground">
              開始時の進捗 {activeSession.progressBefore}% / 予定 {activeSession.plannedMinutes}分
            </p>

            <div className="mt-3">
              <label htmlFor="sessionNote" className="text-xs font-medium text-muted-foreground">
                メモ
              </label>
              <textarea
                id="sessionNote"
                name="note"
                className="mt-1 min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                placeholder="進めたこと、次にやること"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                完了後の進捗
                <select
                  name="progress"
                  defaultValue={Math.max(25, activeSession.progressBefore, assignment.progress)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-sm text-foreground"
                >
                  {[25, 50, 75, 100].map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="outline" size="sm" type="submit">
                <CheckCircle2 className="h-4 w-4" />
                セッション完了
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">まだ作業セッションは開始していません。</p>
        )}

        {recentSessions.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">最近の記録</p>
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <div key={session.id} className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{formatDateTime(session.startedAt)}</span>
                    <span>{workSessionStatusText[session.status]} / {session.progressBefore}% → {session.progressAfter ?? "-"}</span>
                  </div>
                  {session.note ? <p className="mt-1 text-foreground">{session.note}</p> : null}
                  {session.status === "completed" ? (
                    <form action={undoCompletedWorkSessionAction} className="mt-2">
                      <input type="hidden" name="id" value={assignment.id} />
                      <input type="hidden" name="sessionId" value={session.id} />
                      <Button size="sm" type="submit" variant="outline">
                        <RotateCcw className="h-4 w-4" />
                        完了を取り消す
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">作業ブロック</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Today画面で作られた25分単位の予定です。</p>
          </div>
        </div>

        {studyBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">この課題の作業ブロックはまだありません。</p>
        ) : (
          <div className="space-y-2">
            {studyBlocks.map((block) => {
              const isClosed = block.status === "completed" || block.status === "skipped" || assignment.status === "done";

              return (
                <div key={block.id} className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatStudyBlockWindow(block)}</span>
                        <span className="rounded-full border border-border/60 px-2 py-0.5">
                          {studyBlockStatusText[block.status]}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{block.title}</p>
                      {block.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{block.description}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StudyBlockInlineActions
                        assignmentId={assignment.id}
                        assignmentProgress={assignment.progress}
                        blockId={block.id}
                        canUseSavedBlock
                        isAssignmentDone={assignment.status === "done"}
                        isClosed={isClosed}
                        sourcePath={`/assignments/${assignment.id}`}
                        showRestore={block.status === "completed" || block.status === "rescheduled"}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <AssignmentStepPanel
        key={steps.map((step) => `${step.id}:${step.status}:${step.sortOrder}`).join("|")}
        assignment={assignment}
        steps={steps}
      />

      <Card>
        <h3 className="text-sm font-semibold">詳細情報</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <p className="text-sm">
            提出先: <span className="text-muted-foreground">{assignment.submissionTarget ?? "未設定"}</span>
          </p>
          <p className="text-sm">
            推定時間: <span className="text-muted-foreground">{assignment.estimatedHours}h</span>
          </p>
          <p className="text-sm">
            URL: <span className="text-muted-foreground">{assignment.url ?? "なし"}</span>
          </p>
          <p className="text-sm">
            AI信頼度:{" "}
            <span className="text-muted-foreground">
              {assignment.aiConfidence ? `${Math.round(assignment.aiConfidence * 100)}%` : "-"}
            </span>
          </p>
        </div>

        {assignment.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {assignment.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                {ASSIGNMENT_TAG_TEXT[tag]}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">メモ</p>
          <p className="whitespace-pre-wrap rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
            {assignment.memo ?? "メモなし"}
          </p>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Googleカレンダー同期</h3>
          <form action={retryAssignmentCalendarSyncAction}>
            <input type="hidden" name="id" value={assignment.id} />
            <Button variant="outline" size="sm" type="submit">
              <RefreshCw className="h-4 w-4" />
              再同期
            </Button>
          </form>
        </div>
        {calendarState ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>状態: {calendarSyncStatusText[calendarState.syncStatus]}</p>
            <p>イベントID: {calendarState.externalEventId ?? "未作成"}</p>
            <p>最終同期: {calendarState.lastSyncedAt ? formatDateTime(calendarState.lastSyncedAt) : "-"}</p>
            {calendarState.errorMessage ? (
              <div className="rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-danger">
                <p>{formatCalendarSyncErrorMessage(calendarState.errorMessage)}</p>
                <p className="mt-1 text-xs text-muted-foreground">詳細: {calendarState.errorMessage}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">同期レコードなし</p>
        )}
      </Card>
    </div>
  );
}
