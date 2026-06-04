import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronDown, Clock3, Inbox, PlusCircle, Sparkles, Target, Timer } from "lucide-react";
import { updateTodayPreferencesAction } from "@/lib/actions/settingsActions";
import type { TodayAvailableMinutes, TodayCommandCenterData, TodayMode } from "@/lib/services/todayCommandService";
import { formatTodayFreeTimeWindow, type TodayFreeTimeWindow } from "@/lib/services/todayFreeTimeService";
import type { TimelineItem } from "@/lib/services/timelineService";
import { AssignmentMinimalCard } from "@/components/assignments/assignment-minimal-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

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

function formatTime(value: string | null) {
  if (!value) return "時刻未定";
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return "時刻未定";
  return format(date, "HH:mm");
}

function formatTimeWindow(item: TimelineItem) {
  if (!item.startAt) return "時刻未定";
  if (!item.endAt) return formatTime(item.startAt);
  return `${formatTime(item.startAt)}-${formatTime(item.endAt)}`;
}

function compareTimelineItems(a: TimelineItem, b: TimelineItem) {
  if (!a.startAt && !b.startAt) return a.title.localeCompare(b.title);
  if (!a.startAt) return 1;
  if (!b.startAt) return -1;
  return a.startAt.localeCompare(b.startAt);
}

function parseTimelineDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (60 * 1000)));
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

function combineTodayAndClock(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  const value = new Date();
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

function freeTimeItemFromWindow(freeTimeWindow: TodayFreeTimeWindow | null) {
  if (!freeTimeWindow) {
    return null;
  }

  const startAt = combineTodayAndClock(freeTimeWindow.start);
  const endAt = combineTodayAndClock(freeTimeWindow.end);
  if (!startAt || !endAt) {
    return null;
  }

  return {
    id: `selected-free-time-${freeTimeWindow.start}-${freeTimeWindow.end}`,
    kind: "free_time",
    title: "今日の空き時間",
    startAt,
    endAt,
    status: "scheduled",
    source: "manual",
    notes: "時刻で設定した空いてる時間"
  } satisfies TimelineItem;
}

function durationByAssignment(items: TimelineItem[]) {
  const durations = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== "study_block" || !item.relatedAssignmentId || durations.has(item.relatedAssignmentId)) {
      continue;
    }
    const start = parseTimelineDate(item.startAt);
    const end = parseTimelineDate(item.endAt);
    if (!start || !end) {
      continue;
    }
    const duration = minutesBetween(start, end);
    if (duration > 0) {
      durations.set(item.relatedAssignmentId, duration);
    }
  }
  return durations;
}

function buildFlowInsideFreeTime(
  command: TodayCommandCenterData,
  freeTimeItem: TimelineItem | null,
  freeTimeWindow: TodayFreeTimeWindow | null
) {
  const baseFreeTimeItem = freeTimeItem ?? freeTimeItemFromWindow(freeTimeWindow);
  if (!baseFreeTimeItem?.startAt || !baseFreeTimeItem.endAt) {
    return null;
  }

  const freeStart = parseTimelineDate(baseFreeTimeItem.startAt);
  const freeEnd = parseTimelineDate(baseFreeTimeItem.endAt);
  if (!freeStart || !freeEnd || freeStart >= freeEnd) {
    return null;
  }

  const windowMinutes = minutesBetween(freeStart, freeEnd);
  if (windowMinutes <= 0) {
    return null;
  }

  const durationMap = durationByAssignment(command.timelineItems);
  const budgetMinutes = Math.min(windowMinutes, command.preferences.availableMinutes);
  const budgetEnd = addMinutes(freeStart, budgetMinutes);
  const slots: TimelineItem[] = [];
  let cursor = freeStart;

  for (const item of command.focusQueue) {
    if (cursor >= budgetEnd) {
      break;
    }

    const remaining = minutesBetween(cursor, budgetEnd);
    if (remaining < 10) {
      break;
    }

    const preferredDuration = durationMap.get(item.assignment.id) ?? 25;
    const slotMinutes = Math.min(preferredDuration, remaining);
    const slotEnd = addMinutes(cursor, slotMinutes);

    slots.push({
      id: `free-window-${item.assignment.id}-${slots.length + 1}`,
      kind: "study_block",
      title: `${item.assignment.title}: ${item.nextAction}`,
      startAt: cursor.toISOString(),
      endAt: slotEnd.toISOString(),
      relatedAssignmentId: item.assignment.id,
      relatedCourseId: item.assignment.courseId,
      status: "scheduled",
      source: "manual",
      notes: "選択した空き時間内で進める作業順"
    });

    cursor = slotEnd;
  }

  return {
    items: [baseFreeTimeItem, ...slots],
    usedMinutes: budgetMinutes,
    windowMinutes
  };
}

function timelineKindLabel(item: TimelineItem) {
  if (item.kind === "assignment_due") return "締切";
  if (item.kind === "class") return "授業";
  if (item.kind === "study_block") return "作業";
  if (item.kind === "free_time") return "空き時間";
  return "予定";
}

function TodayStrategyControls({
  command,
  freeTimeWindow
}: {
  command: TodayCommandCenterData;
  freeTimeWindow: TodayFreeTimeWindow | null;
}) {
  const freeTimeLabel = freeTimeWindow ? formatTodayFreeTimeWindow(freeTimeWindow) : "";

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
            {freeTimeLabel ? (
              <Badge className="border-success/35 bg-success/10 text-success">空き: {freeTimeLabel}</Badge>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground transition group-open:border-primary/45 group-open:bg-primary/10 group-open:text-primary">
            変更
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition group-open:rotate-180 group-open:text-primary" />
          </span>
        </summary>

        <form action={updateTodayPreferencesAction} className="space-y-4 border-t border-border px-3 pb-3 pt-3">
          <input type="hidden" name="redirectTo" value="/today" />

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
                  <span className="flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-muted-foreground transition peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:text-primary">
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
                  <span className="flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-muted-foreground transition peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:text-primary">
                    {modeLabels[mode]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              空いてる時間
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">開始</span>
                <input
                  type="time"
                  name="freeTimeStart"
                  defaultValue={freeTimeWindow?.start ?? ""}
                  className="min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <span className="hidden pb-3 text-xs font-semibold text-muted-foreground sm:inline">から</span>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">終了</span>
                <input
                  type="time"
                  name="freeTimeEnd"
                  defaultValue={freeTimeWindow?.end ?? ""}
                  className="min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              例: 13:20 から 14:50。空欄で保存すると空き時間は非表示になります。
            </p>
          </div>

          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            反映して閉じる
          </Button>
        </form>
      </details>
    </section>
  );
}

function NextBlock({ command }: { command: TodayCommandCenterData }) {
  const block = command.studyPlan.nextBlock;
  if (!block) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-primary">今はこれだけ</p>
        <p className="mt-2 text-base font-semibold">今日の作業ブロックは落ち着いています。</p>
        <p className="mt-1 text-xs text-muted-foreground">新しい課題があればAI入力から追加できます。</p>
      </section>
    );
  }

  return (
    <Link href={block.assignmentId ? `/assignments/${block.assignmentId}` : "/today"} className="block rounded-lg border border-primary/25 bg-primary/5 p-4 transition hover:border-primary/45">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge className="border-primary/35 bg-primary/10 text-primary">今はこれだけ</Badge>
        <Badge className="border-border bg-card text-muted-foreground">{block.durationMinutes}分</Badge>
      </div>
      <h2 className="line-clamp-2 text-lg font-semibold text-foreground">{block.title}</h2>
      {block.description ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{block.description}</p> : null}
    </Link>
  );
}

function FocusQueue({ command }: { command: TodayCommandCenterData }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{command.focusQueue.length > 0 ? `今日やる${command.focusQueue.length}件` : "今日やること"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">課題名・締切・次の作業だけ表示</p>
        </div>
        <Timer className="h-5 w-5 text-primary" />
      </div>
      {command.focusQueue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">未完了課題はありません。</p>
      ) : (
        <div className="space-y-3">
          {command.focusQueue.map((item) => (
            <AssignmentMinimalCard key={item.assignment.id} assignment={item.assignment} nextAction={item.nextAction} />
          ))}
        </div>
      )}
    </section>
  );
}

function CompactTimeline({
  command,
  freeTimeWindow
}: {
  command: TodayCommandCenterData;
  freeTimeWindow: TodayFreeTimeWindow | null;
}) {
  const freeTimeItems = command.timelineItems.filter((item) => item.kind === "free_time");
  const selectedFreeTimeItem = freeTimeItems[0] ?? freeTimeItemFromWindow(freeTimeWindow);
  const inWindowFlow = buildFlowInsideFreeTime(command, selectedFreeTimeItem, freeTimeWindow);

  if (inWindowFlow) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">今日の流れ</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              空き時間 {inWindowFlow.usedMinutes}分の中でやる順に表示
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-2">
          {inWindowFlow.items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{formatTimeWindow(item)}</span>
                <span>{timelineKindLabel(item)}</span>
              </div>
              <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const baseItems = command.timelineItems.slice(0, 5);
  const orderedItems = [...baseItems, ...freeTimeItems, ...(selectedFreeTimeItem ? [selectedFreeTimeItem] : [])]
    .filter((item, index, source) => source.findIndex((candidate) => candidate.id === item.id) === index)
    .sort(compareTimelineItems);
  const firstFiveItems = orderedItems.slice(0, 5);
  const shouldForceSelectedFreeTime =
    selectedFreeTimeItem !== null && !firstFiveItems.some((item) => item.kind === "free_time");
  const items = shouldForceSelectedFreeTime
    ? [...firstFiveItems.slice(0, 4), selectedFreeTimeItem].sort(compareTimelineItems)
    : firstFiveItems;
  if (items.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">今日の流れ</h3>
          <p className="mt-1 text-xs text-muted-foreground">選んだ空き時間と近い予定を表示</p>
        </div>
        <CalendarDays className="h-5 w-5 text-primary" />
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-border bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{formatTimeWindow(item)}</span>
              <span>{timelineKindLabel(item)}</span>
            </div>
            <p className="mt-1 line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HeaderActions() {
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

export function TodayCommandCenterCompact({
  command,
  freeTimeWindow,
  title = "今日やること",
  description = "今日の課題・すき間時間・リスクだけに集中"
}: {
  command: TodayCommandCenterData;
  description?: string;
  freeTimeWindow: TodayFreeTimeWindow | null;
  title?: string;
}) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={<HeaderActions />} />
      <TodayStrategyControls command={command} freeTimeWindow={freeTimeWindow} />
      <NextBlock command={command} />
      <CompactTimeline command={command} freeTimeWindow={freeTimeWindow} />
      <FocusQueue command={command} />
    </div>
  );
}
