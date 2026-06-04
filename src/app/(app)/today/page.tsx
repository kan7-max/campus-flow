import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/repositories/settingsRepository";
import { TodayCommandCenterCompact } from "@/components/dashboard/today-command-center-compact";
import {
  getTodayCommandCenter,
  type TodayAvailableMinutes,
  type TodayCommandPreferences,
  type TodayMode
} from "@/lib/services/todayCommandService";
import {
  getLegacyTodayFreeTimeWindow,
  normalizeTodayFreeTimeWindow,
  readTodayFreeTimeWindow,
  type TodayFreeTimeWindow
} from "@/lib/services/todayFreeTimeService";
import type { TimelineItem } from "@/lib/services/timelineService";

type TodayPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const availableMinutes: TodayAvailableMinutes[] = [15, 30, 60, 120, 180];
const modes: TodayMode[] = ["normal", "busy", "low_energy", "exam"];

function toSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePreferences(params: Record<string, string | string[] | undefined>): Partial<TodayCommandPreferences> {
  const minutes = Number(toSingle(params.availableMinutes));
  const mode = toSingle(params.mode);

  return {
    availableMinutes: availableMinutes.includes(minutes as TodayAvailableMinutes)
      ? (minutes as TodayAvailableMinutes)
      : undefined,
    mode: modes.includes(mode as TodayMode) ? (mode as TodayMode) : undefined
  };
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

function combineTodayAndTime(date: Date, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(date);
  value.setHours(hour, minute, 0, 0);
  return value.toISOString();
}

function readFreeTimeWindow(
  params: Record<string, string | string[] | undefined>,
  config: unknown
): TodayFreeTimeWindow | null {
  const paramStart = toSingle(params.freeTimeStart);
  const paramEnd = toSingle(params.freeTimeEnd);

  if (paramStart !== undefined || paramEnd !== undefined) {
    return normalizeTodayFreeTimeWindow(paramStart, paramEnd);
  }

  const legacyParamNote = toSingle(params.freeTimeNote);
  if (legacyParamNote !== undefined) {
    return getLegacyTodayFreeTimeWindow(legacyParamNote);
  }

  return readTodayFreeTimeWindow(config);
}

function buildFreeTimeItem(freeTimeWindow: TodayFreeTimeWindow | null): TimelineItem | null {
  if (!freeTimeWindow) {
    return null;
  }

  const today = new Date();
  return {
    id: `selected-free-time-${freeTimeWindow.start}-${freeTimeWindow.end}`,
    kind: "free_time",
    title: "今日の空き時間",
    startAt: combineTodayAndTime(today, freeTimeWindow.start),
    endAt: combineTodayAndTime(today, freeTimeWindow.end),
    status: "scheduled",
    source: "manual",
    notes: "時刻で設定した空いてる時間"
  };
}

function addFreeTimeToTimeline(items: TimelineItem[], freeTimeWindow: TodayFreeTimeWindow | null) {
  const freeTimeItem = buildFreeTimeItem(freeTimeWindow);
  if (!freeTimeItem) {
    return items;
  }

  return [...items.filter((item) => item.kind !== "free_time"), freeTimeItem].sort((a, b) => {
    if (!a.startAt && !b.startAt) return a.title.localeCompare(b.title);
    if (!a.startAt) return 1;
    if (!b.startAt) return -1;
    return a.startAt.localeCompare(b.startAt);
  });
}

export default async function TodayPage({ searchParams }: TodayPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getUserSettings(user.id).catch((error) => {
    console.error("Failed to load user settings for today page", error);
    return null;
  });
  const explicitPreferences = parsePreferences(params);
  const selectedAvailableMinutes = explicitPreferences.availableMinutes ?? settings?.preferredAvailableMinutes ?? 60;
  const selectedMode = explicitPreferences.mode ?? settings?.preferredTodayMode ?? "normal";
  const freeTimeWindow = readFreeTimeWindow(params, settings?.notificationConfig);
  const command = await getTodayCommandCenter(user.id, {
    availableMinutes: selectedAvailableMinutes,
    mode: selectedMode
  }).catch((error) => {
    console.error("Failed to load today command center", error);
    return null;
  });
  const notice = getTodayNotice(params);

  if (!command) {
    return (
      <div className="space-y-5">
        {notice ? <section className={`rounded-lg border px-4 py-3 text-sm ${notice.className}`}>{notice.message}</section> : null}
        <section className="rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          今日の表示を読み込めませんでした。少し待ってから再読み込みしてください。
        </section>
      </div>
    );
  }

  const commandWithFreeTime = {
    ...command,
    timelineItems: addFreeTimeToTimeline(command.timelineItems, freeTimeWindow)
  };

  return (
    <div className="space-y-5">
      {notice ? <section className={`rounded-lg border px-4 py-3 text-sm ${notice.className}`}>{notice.message}</section> : null}
      <TodayCommandCenterCompact
        command={commandWithFreeTime}
        freeTimeWindow={freeTimeWindow}
        title="今日やること"
        description="今日の課題・すき間時間・リスクだけに集中"
      />
    </div>
  );
}
