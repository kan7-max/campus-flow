import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock3,
  Flame,
  Inbox,
  ListChecks,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Target,
  Timer
} from "lucide-react";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants/domain";
import type {
  TodayAvailableMinutes,
  TodayCommandCenterData,
  TodayMode
} from "@/lib/services/todayCommandService";
import type { TimelineItem, TimelineItemKind, TimelineItemStatus } from "@/lib/services/timelineService";
import type { StudyBlockWithAssignment } from "@/lib/services/studyBlockPlanningService";
import { regenerateTodayStudyBlocksAction } from "@/lib/actions/assignmentActions";
import { updateTodayPreferencesAction } from "@/lib/actions/settingsActions";
import { AssignmentMinimalCard } from "@/components/assignments/assignment-minimal-card";
import { StudyBlockInlineActions } from "@/components/assignments/study-block-inline-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

type TodayCommandCenterProps = {
  command: TodayCommandCenterData;
  description?: string;
  showTaskNextAction?: boolean;
  title?: string;
};

const availableMinuteLabels: Record<TodayAvailableMinutes, string> = {
  15: "15分",
  30: "30分",
  60: "1時間",
  120: "2時間",
  180: "3時間+"
};

const modeLabels: Record<TodayMode, string> = {
  normal: "通常",
  busy: "忙しい日",
  low_energy: "やる気ない日",
  exam: "試験前"
};

const availableMinuteOptions = [15, 30, 60, 120, 180] satisfies TodayAvailableMinutes[];
const modeOptions = ["normal", "busy", "low_energy", "exam"] satisfies TodayMode[];

const timelineKindLabels: Record<TimelineItemKind, string> = {
  assignment_due: "締切",
  break: "休憩",
  class: "授業",
  club: "サークル",
  commute: "移動",
  event: "予定",
  exam: "試験",
  free_time: "空き時間",
  meal: "食事",
  preparation: "予習",
  presentation: "発表",
  routine: "習慣",
  sleep: "睡眠",
  study_block: "作業",
  work: "バイト"
};

const timelineKindClassName: Record<TimelineItemKind, string> = {
  assignment_due: "border-warning/35 bg-warning/10 text-warning",
  break: "border-border bg-muted text-muted-foreground",
  class: "border-primary/35 bg-primary/10 text-primary",
  club: "border-primary/35 bg-primary/10 text-primary",
  commute: "border-border bg-muted text-muted-foreground",
  event: "border-border bg-muted text-muted-foreground",
  exam: "border-danger/35 bg-danger/10 text-danger",
  free_time: "border-border bg-muted text-muted-foreground",
  meal: "border-border bg-muted text-muted-foreground",
  preparation: "border-primary/35 bg-primary/10 text-primary",
  presentation: "border-success/35 bg-success/10 text-success",
  routine: "border-border bg-muted text-muted-foreground",
  sleep: "border-border bg-muted text-muted-foreground",
  study_block: "border-success/35 bg-success/10 text-success",
  work: "border-primary/35 bg-primary/10 text-primary"
};

const timelineStatusLabels: Record<TimelineItemStatus, string> = {
  done: "完了",
  failed: "失敗",
  in_progress: "進行中",
  needs_confirmation: "要確認",
  scheduled: "予定",
  skipped: "スキップ"
};

function CollapsiblePanel({
  children,
  defaultOpen = false,
  description,
  icon: Icon,
  title
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  description: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition hover:border-primary/35 hover:bg-muted/60">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground transition group-open:border-primary/45 group-open:bg-primary/10 group-open:text-primary">
          表示
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition group-open:rotate-180 group-open:text-primary" />
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function formatTimelineTime(value: string | null) {
  if (!value) {
    return "時刻未定";
  }

  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) {
    return "時刻未定";
  }

  return format(date, "HH:mm");
}

function formatTimelineWindow(item: TimelineItem) {
  if (!item.startAt) {
    return "時刻未定";
  }

  if (!item.endAt) {
    return formatTimelineTime(item.startAt);
  }

  return `${formatTimelineTime(item.startAt)} - ${formatTimelineTime(item.endAt)}`;
}

function getNextDeadline(command: TodayCommandCenterData) {
  const toEpoch = (value: string | null) => {
    if (!value) return Number.POSITIVE_INFINITY;
    const date = parseISO(value);
    return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
  };

  return command.timelineItems
    .filter((item) => item.kind === "assignment_due" && item.startAt)
    .sort((a, b) => toEpoch(a.startAt) - toEpoch(b.startAt))[0];
}

function StatusSummaryBar({ command }: { command: TodayCommandCenterData }) {
  const nextDeadline = getNextDeadline(command);
  const nextDeadlineText = (() => {
    if (!nextDeadline?.startAt) {
      return `今日締切 ${command.stats.dueToday}`;
    }
    const date = parseISO(nextDeadline.startAt);
    if (Number.isNaN(date.getTime())) {
      return nextDeadline.title;
    }
    return `${format(date, "MM/dd HH:mm")} ${nextDeadline.title}`;
  })();

  const items = [
    {
      icon: CalendarDays,
      label: "次の締切",
      tone: "warning",
      value: nextDeadlineText
    },
    {
      icon: AlertTriangle,
      label: "期限超過",
      tone: "danger",
      value: command.stats.overdue
    },
    {
      icon: ListChecks,
      label: "未完了",
      tone: "neutral",
      value: command.stats.incomplete
    },
    {
      icon: Inbox,
      label: "未整理メモ",
      tone: "warning",
      value: command.stats.inboxOpen
    }
  ] as const;

  const toneClassName = {
    danger: "border-danger/35 bg-danger/10 text-danger",
    neutral: "border-border bg-card text-foreground",
    warning: "border-warning/35 bg-warning/10 text-warning"
  } as const;

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ icon: Icon, label, tone, value }) => (
        <div key={label} className={`rounded-lg border px-3 py-2 ${toneClassName[tone]}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon className="h-4 w-4" />
            {label}
          </div>
          <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{value}</p>
        </div>
      ))}
    </section>
  );
}

function ConfirmationSection({ command }: { command: TodayCommandCenterData }) {
  if (command.confirmationItems.length === 0) {
    return null;
  }

  const visibleItems = command.confirmationItems.slice(0, 3);
  const remainingCount = command.confirmationItems.length - visibleItems.length;

  return (
    <Card className="rounded-lg border-warning/35 bg-warning/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-warning">要確認</h3>
          <p className="mt-1 text-xs text-muted-foreground">締切や提出先だけ確認</p>
        </div>
        <AlertTriangle className="h-5 w-5 text-warning" />
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => (
          <Link
            key={item.assignment.id}
            href={`/assignments/${item.assignment.id}`}
            className="block rounded-lg border border-warning/25 bg-card px-3 py-2 transition hover:border-warning/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{item.assignment.title}</p>
              <Badge className="border-warning/35 bg-warning/10 text-warning">要確認</Badge>
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.reason}</p>
          </Link>
        ))}
        {remainingCount > 0 ? (
          <p className="px-1 text-xs text-muted-foreground">ほか{remainingCount}件は課題一覧で確認できます。</p>
        ) : null}
      </div>
    </Card>
  );
}

function TodayTimelineSection({ command }: { command: TodayCommandCenterData }) {
  const timedItems = command.timelineItems.filter((item) => item.startAt);
  const undatedItems = command.timelineItems.filter((item) => !item.startAt);
  const orderedItems = [...timedItems, ...undatedItems];
  const primaryItems = orderedItems.slice(0, 3);
  const secondaryItems = orderedItems.slice(3, 5);
  const visibleItems = [...primaryItems, ...secondaryItems];
  const remainingCount = orderedItems.length - visibleItems.length;

  return (
    <Card className="rounded-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">今日のタイムライン</h3>
          <p className="mt-1 text-xs text-muted-foreground">次の予定と締切だけ確認</p>
        </div>
        <CalendarDays className="h-5 w-5 text-primary" />
      </div>

      {command.timelineItems.length === 0 ? (
        <div className="grid gap-2 rounded-lg border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground sm:grid-cols-2">
          <Link href="/ai" className="hover:text-primary">
            AIで課題を抽出する
          </Link>
          <Link href="/assignments/new" className="hover:text-primary">
            課題を手動追加する
          </Link>
          <Link href="/courses" className="hover:text-primary">
            授業予定を設定する
          </Link>
          <Link href="/settings" className="hover:text-primary">
            Google Calendar連携を設定する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {primaryItems.map((item) => {
            const content = (
              <div className="rounded-lg border border-border bg-card px-3 py-2 transition hover:border-primary/45">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-24 text-sm font-semibold text-foreground">{formatTimelineWindow(item)}</span>
                  <Badge className={timelineKindClassName[item.kind]}>{timelineKindLabels[item.kind]}</Badge>
                  {item.status ? (
                    <Badge className="border-border/60 bg-muted text-muted-foreground">{timelineStatusLabels[item.status]}</Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium">{item.title}</p>
                {item.notes ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.notes}</p> : null}
              </div>
            );

            return item.relatedAssignmentId ? (
              <Link key={item.id} href={`/assignments/${item.relatedAssignmentId}`} className="block">
                {content}
              </Link>
            ) : item.relatedCourseId ? (
              <Link key={item.id} href={`/courses/${item.relatedCourseId}`} className="block">
                {content}
              </Link>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
          {secondaryItems.length > 0 ? (
            <div className="space-y-2 border-t border-border pt-2">
              {secondaryItems.map((item) => {
                const content = (
                  <div className="rounded-md border border-border/70 bg-muted/60 px-3 py-2 transition hover:border-primary/35 hover:bg-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-20 text-xs font-semibold text-muted-foreground">{formatTimelineWindow(item)}</span>
                      <Badge className={timelineKindClassName[item.kind]}>{timelineKindLabels[item.kind]}</Badge>
                      {item.status ? (
                        <Badge className="border-border/60 bg-card text-muted-foreground">{timelineStatusLabels[item.status]}</Badge>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.title}</span>
                    </div>
                  </div>
                );

                return item.relatedAssignmentId ? (
                  <Link key={item.id} href={`/assignments/${item.relatedAssignmentId}`} className="block">
                    {content}
                  </Link>
                ) : item.relatedCourseId ? (
                  <Link key={item.id} href={`/courses/${item.relatedCourseId}`} className="block">
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })}
            </div>
          ) : null}
          {remainingCount > 0 ? <p className="px-1 text-xs text-muted-foreground">ほか{remainingCount}件は課題一覧や詳細で確認できます。</p> : null}
        </div>
      )}
    </Card>
  );
}

function TodayModeControls({ command, redirectTo }: { command: TodayCommandCenterData; redirectTo: "/dashboard" | "/today" }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-3 py-2 transition hover:bg-muted/70">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-primary">現在の作戦</span>
            <Badge className="border-primary/35 bg-primary/5 text-primary">
              <Clock3 className="h-3.5 w-3.5" />
              {availableMinuteLabels[command.preferences.availableMinutes]}
            </Badge>
            <Badge className="border-primary/35 bg-primary/5 text-primary">
              <Target className="h-3.5 w-3.5" />
              {modeLabels[command.preferences.mode]}
            </Badge>
            <span className="hidden text-xs text-muted-foreground sm:inline">選択済み</span>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground transition group-open:border-primary/45 group-open:bg-primary/10 group-open:text-primary">
            変更
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition group-open:rotate-180 group-open:text-primary" />
          </span>
        </summary>

        <form action={updateTodayPreferencesAction} className="grid gap-4 border-t border-border px-3 pb-3 pt-3 xl:grid-cols-[1fr_1.2fr_auto] xl:items-end">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="h-4 w-4 text-primary" />
              今日使える時間
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {availableMinuteOptions.map((minutes) => (
                <label key={minutes} className="relative">
                  <input
                    type="radio"
                    name="availableMinutes"
                    value={minutes}
                    defaultChecked={command.preferences.availableMinutes === minutes}
                    className="peer sr-only"
                  />
                  <span className="flex h-9 items-center justify-center rounded-md border border-border bg-card px-2 text-xs font-medium text-muted-foreground transition peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:text-primary">
                    {availableMinuteLabels[minutes]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" />
              今日のモード
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {modeOptions.map((mode) => (
                <label key={mode} className="relative">
                  <input
                    type="radio"
                    name="mode"
                    value={mode}
                    defaultChecked={command.preferences.mode === mode}
                    className="peer sr-only"
                  />
                  <span className="flex h-9 items-center justify-center rounded-md border border-border bg-card px-2 text-xs font-medium text-muted-foreground transition peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:text-primary">
                    {modeLabels[mode]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" variant="outline">
            反映して閉じる
          </Button>
        </form>
      </details>
    </section>
  );
}

const studyBlockStatusText: Record<StudyBlockWithAssignment["status"], string> = {
  planned: "予定",
  started: "作業中",
  completed: "完了",
  skipped: "スキップ",
  rescheduled: "延期"
};

const studyBlockStatusClassName: Record<StudyBlockWithAssignment["status"], string> = {
  planned: "border-primary/35 bg-primary/10 text-primary",
  started: "border-warning/35 bg-warning/10 text-warning",
  completed: "border-success/35 bg-success/10 text-success",
  skipped: "border-border/60 bg-muted text-muted-foreground",
  rescheduled: "border-border/60 bg-muted text-muted-foreground"
};

function StudyBlockStatusBadge({ status }: { status: StudyBlockWithAssignment["status"] }) {
  return <Badge className={studyBlockStatusClassName[status]}>{studyBlockStatusText[status]}</Badge>;
}

function formatStudyBlockWindow(block: StudyBlockWithAssignment) {
  if (!block.startTime || !block.endTime) {
    return `${block.durationMinutes}分`;
  }

  return `${block.startTime.slice(0, 5)} - ${block.endTime.slice(0, 5)}`;
}

function StudyBlockActions({
  block,
  compact = false,
  sourcePath
}: {
  block: StudyBlockWithAssignment;
  compact?: boolean;
  sourcePath: "/dashboard" | "/today";
}) {
  const assignmentId = block.assignment?.id ?? block.assignmentId ?? "";
  const isClosed = block.status === "completed" || block.status === "skipped" || block.assignment?.status === "done";
  const canUseSavedBlock = !block.id.startsWith("volatile-");
  const showRestore = block.status === "completed" || block.status === "rescheduled" || block.status === "skipped";

  return (
    <StudyBlockInlineActions
      assignmentId={assignmentId || null}
      assignmentProgress={block.assignment?.progress ?? null}
      blockId={canUseSavedBlock ? block.id : null}
      canUseSavedBlock={canUseSavedBlock}
      compact={compact}
      detailHref={assignmentId ? `/assignments/${assignmentId}` : null}
      isAssignmentDone={block.assignment?.status === "done"}
      isClosed={isClosed}
      sourcePath={sourcePath}
      showRestore={showRestore}
    />
  );
}

function NextStudyBlockPanel({
  block,
  sourcePath
}: {
  block: StudyBlockWithAssignment | null;
  sourcePath: "/dashboard" | "/today";
}) {
  if (!block) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Target className="h-4 w-4" />
          今はこれだけ
        </div>
        <p className="mt-3 text-lg font-semibold">今日の作業ブロックは落ち着いています。</p>
        <p className="mt-1 text-sm text-muted-foreground">未完了課題がない場合は、授業メモの整理や次の締切確認に使えます。</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-primary/25 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="border-primary/35 bg-primary/10 text-primary">今はこれだけ</Badge>
            <StudyBlockStatusBadge status={block.status} />
            <Badge className="border-border/60 bg-muted text-muted-foreground">{formatStudyBlockWindow(block)}</Badge>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{block.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {block.course?.name ?? "授業未設定"}
            {block.assignment ? ` · ${ASSIGNMENT_TYPE_LABELS[block.assignment.assignmentType]}` : ""}
          </p>
          {block.description ? <p className="mt-3 line-clamp-2 max-w-3xl text-sm text-muted-foreground">{block.description}</p> : null}
        </div>

        <StudyBlockActions block={block} sourcePath={sourcePath} />
      </div>
    </section>
  );
}

function StudyBlockPlanItem({ block, sourcePath }: { block: StudyBlockWithAssignment; sourcePath: "/dashboard" | "/today" }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="border-border/60 bg-muted text-muted-foreground">{formatStudyBlockWindow(block)}</Badge>
            <StudyBlockStatusBadge status={block.status} />
          </div>
          {block.assignment ? (
            <Link href={`/assignments/${block.assignment.id}`} className="font-medium hover:text-primary">
              {block.title}
            </Link>
          ) : (
            <p className="font-medium">{block.title}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{block.course?.name ?? "授業未設定"}</p>
          {block.description ? <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{block.description}</p> : null}
        </div>
        <StudyBlockActions block={block} compact sourcePath={sourcePath} />
      </div>
    </div>
  );
}

function getVisibleStudyBlocks(blocks: StudyBlockWithAssignment[], availableMinutes: TodayAvailableMinutes) {
  const visible: StudyBlockWithAssignment[] = [];
  let total = 0;

  for (const block of blocks) {
    if (block.status === "completed" || block.status === "skipped") {
      continue;
    }

    if (visible.length === 0 || total + block.durationMinutes <= availableMinutes) {
      visible.push(block);
      total += block.durationMinutes;
    }
  }

  return visible;
}

function FocusQueueCard({
  command,
  showTaskNextAction
}: {
  command: TodayCommandCenterData;
  showTaskNextAction: boolean;
}) {
  return (
    <Card className="rounded-lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">
            {command.focusQueue.length > 0 ? `今日やる${command.focusQueue.length}件` : "今日やること"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">課題名・締切・次の作業だけ表示</p>
        </div>
        <Timer className="h-5 w-5 text-primary" />
      </div>

      {command.focusQueue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
          未完了課題はありません。課題文や授業メモがあればAI入力から整理できます。
        </div>
      ) : (
        <div className="space-y-3">
          {command.focusQueue.map((item) => (
            <AssignmentMinimalCard
              key={item.assignment.id}
              assignment={item.assignment}
              nextAction={showTaskNextAction ? item.nextAction : undefined}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function RecentCaptureSection({
  command,
  showTaskNextAction
}: {
  command: TodayCommandCenterData;
  showTaskNextAction: boolean;
}) {
  const focusIds = new Set(command.focusQueue.map((item) => item.assignment.id));
  const visibleItems = command.recentCaptures.filter((item) => !focusIds.has(item.assignment.id)).slice(0, 2);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">新しく整理した課題</h3>
          <p className="mt-1 text-xs text-muted-foreground">保存した直近締切だけ、見逃さないように表示</p>
        </div>
        <Link href="/assignments">
          <Button size="sm" variant="outline">
            課題一覧
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {visibleItems.map((item) => (
          <AssignmentMinimalCard
            key={item.assignment.id}
            assignment={item.assignment}
            nextAction={showTaskNextAction ? item.nextAction : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function HeaderActions({ showTaskNextAction }: { showTaskNextAction: boolean }) {
  if (showTaskNextAction) {
    return (
      <>
        <Link href="/ai">
          <Button>
            <Sparkles className="h-4 w-4" />
            AI入力
          </Button>
        </Link>
        <Link href="/inbox">
          <Button variant="outline">
            <Inbox className="h-4 w-4" />
            Inbox
          </Button>
        </Link>
        <Link href="/assignments/new">
          <Button variant="outline">
            <PlusCircle className="h-4 w-4" />
            課題追加
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/assignments/new">
        <Button>
          <PlusCircle className="h-4 w-4" />
          課題追加
        </Button>
      </Link>
      <Link href="/inbox">
        <Button variant="outline">
          <Inbox className="h-4 w-4" />
          Inbox
        </Button>
      </Link>
      <Link href="/ai">
        <Button variant="outline">
          <Sparkles className="h-4 w-4" />
          AI入力
        </Button>
      </Link>
    </>
  );
}

export function TodayCommandCenter({
  command,
  description = "締切・進捗・残作業から、今日の動きを決める",
  showTaskNextAction = false,
  title = "今日の司令塔"
}: TodayCommandCenterProps) {
  const visibleStudyBlocks = getVisibleStudyBlocks(command.studyPlan.blocks, command.preferences.availableMinutes);
  const showSecondaryBuckets = !showTaskNextAction;
  const sourcePath: "/dashboard" | "/today" = showTaskNextAction ? "/today" : "/dashboard";

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={<HeaderActions showTaskNextAction={showTaskNextAction} />}
      />

      {showTaskNextAction ? (
        <>
          <TodayModeControls command={command} redirectTo="/today" />
          <NextStudyBlockPanel block={command.studyPlan.nextBlock} sourcePath={sourcePath} />
          <TodayTimelineSection command={command} />
          <CollapsiblePanel
            title="状況サマリー"
            description="期限超過・未整理メモなどを必要な時だけ確認"
            icon={ListChecks}
          >
            <StatusSummaryBar command={command} />
          </CollapsiblePanel>
        </>
      ) : null}

      {showTaskNextAction ? (
        <>
          <FocusQueueCard command={command} showTaskNextAction={showTaskNextAction} />
          <RecentCaptureSection command={command} showTaskNextAction={showTaskNextAction} />
        </>
      ) : (
        <>
          <NextStudyBlockPanel block={command.studyPlan.nextBlock} sourcePath={sourcePath} />
          <FocusQueueCard command={command} showTaskNextAction={showTaskNextAction} />
          <RecentCaptureSection command={command} showTaskNextAction={showTaskNextAction} />
        </>
      )}

      {!showTaskNextAction ? (
        <CollapsiblePanel
          title="状況サマリー"
          description="次の締切・期限超過・未整理メモをまとめて確認"
          icon={ListChecks}
        >
          <StatusSummaryBar command={command} />
        </CollapsiblePanel>
      ) : null}

      {command.stats.inboxOpen > 0 ? (
        <section className="rounded-lg border border-warning/35 bg-warning/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-warning">
              <Inbox className="h-4 w-4" />
              未整理のメモが{command.stats.inboxOpen}件あります
            </div>
            <Link href="/inbox">
              <Button variant="outline" size="sm">
                課題に変換する
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      ) : null}

      <ConfirmationSection command={command} />

      <CollapsiblePanel title="今日の判断" description="詳しい作戦文と優先度順への導線" icon={Target}>
        <section className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="line-clamp-3 max-w-4xl text-sm text-muted-foreground">{command.briefing}</p>
            <Link href="/assignments?sortBy=priority">
              <Button variant="outline" size="sm">
                優先度順
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </CollapsiblePanel>

      {!showTaskNextAction ? <TodayModeControls command={command} redirectTo="/dashboard" /> : null}

      <CollapsiblePanel
        title={showTaskNextAction ? "作業プラン詳細" : "詳しい作戦と補助パネル"}
        description={
          showTaskNextAction
            ? "作業ブロックの一覧や再生成は必要な時だけ確認"
            : "今日の作戦・すぐ片付くもの・重い課題・授業をまとめて確認"
        }
        icon={CalendarDays}
      >
        <section className={showSecondaryBuckets ? "grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]" : "space-y-4"}>
          <div className="space-y-4">
            <Card className="rounded-lg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="text-base font-semibold">今日の作戦</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {command.studyPlan.generatedInMemory
                      ? "DB未適用時の一時プラン"
                      : `表示 ${visibleStudyBlocks.reduce((sum, block) => sum + block.durationMinutes, 0)}分 / 保存済み ${command.studyPlan.totalMinutes}分`}
                  </p>
                </div>
              </div>
              <form action={regenerateTodayStudyBlocksAction}>
                <Button size="sm" type="submit" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                  再生成
                </Button>
              </form>
            </div>

            {visibleStudyBlocks.length > 0 ? (
              <div className="space-y-3">
                {visibleStudyBlocks.map((block) => (
                  <StudyBlockPlanItem key={block.id} block={block} sourcePath={sourcePath} />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-3">
                {command.planSlots.map((slot) => (
                  <div key={slot.label} className="rounded-lg border border-border bg-muted p-3">
                    <p className="text-xs font-medium text-primary">{slot.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{slot.detail}</p>
                    {slot.item ? (
                      <Link
                        href={`/assignments/${slot.item.assignment.id}`}
                        className="mt-3 block truncate text-sm font-medium hover:text-primary"
                      >
                        {slot.item.assignment.title}
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            </Card>
          </div>

          {showSecondaryBuckets ? (
            <div className="space-y-4">
            <Card className="rounded-lg">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">すぐ片付くもの</h3>
                <CheckSquare className="h-5 w-5 text-success" />
              </div>
              {command.quickWins.length === 0 ? (
                <p className="text-sm text-muted-foreground">短時間で進められる課題は今のところありません。</p>
              ) : (
                <div className="space-y-2">
                  {command.quickWins.slice(0, 3).map((item) => (
                    <AssignmentMinimalCard key={item.assignment.id} assignment={item.assignment} />
                  ))}
                  {command.quickWins.length > 3 ? <p className="text-xs text-muted-foreground">ほか{command.quickWins.length - 3}件</p> : null}
                </div>
              )}
            </Card>

            <Card className="rounded-lg">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">重い課題</h3>
                <Flame className="h-5 w-5 text-warning" />
              </div>
              {command.heavyLifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">大きめの課題は落ち着いています。</p>
              ) : (
                <div className="space-y-2">
                  {command.heavyLifts.slice(0, 3).map((item) => (
                    <AssignmentMinimalCard key={item.assignment.id} assignment={item.assignment} />
                  ))}
                  {command.heavyLifts.length > 3 ? <p className="text-xs text-muted-foreground">ほか{command.heavyLifts.length - 3}件</p> : null}
                </div>
              )}
            </Card>

            <Card className="rounded-lg">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold">今日の授業</h3>
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              {command.todaysCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">今日登録されている授業はありません。</p>
              ) : (
                <div className="space-y-2">
                  {command.todaysCourses.slice(0, 3).map((course) => (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      className="block rounded-md border border-border bg-card px-3 py-2 transition hover:border-primary/50 hover:bg-accent"
                    >
                      <p className="text-sm font-medium">{course.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {course.startTime} - {course.endTime}
                        {course.room ? ` · ${course.room}` : ""}
                      </p>
                    </Link>
                  ))}
                  {command.todaysCourses.length > 3 ? <p className="text-xs text-muted-foreground">ほか{command.todaysCourses.length - 3}件</p> : null}
                </div>
              )}
            </Card>
            </div>
          ) : null}
        </section>
      </CollapsiblePanel>
    </div>
  );
}
