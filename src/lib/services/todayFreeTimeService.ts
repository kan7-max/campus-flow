export type TodayFreeTimeWindow = {
  end: string;
  start: string;
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const legacyFreeTimeRanges: Record<string, TodayFreeTimeWindow> = {
  朝: { start: "07:30", end: "08:30" },
  昼休み: { start: "12:10", end: "13:00" },
  空きコマ: { start: "14:00", end: "15:30" },
  授業後: { start: "17:30", end: "18:30" },
  帰宅後: { start: "19:30", end: "20:30" },
  夜: { start: "21:00", end: "22:00" }
};

function normalizeTime(value: string | null | undefined) {
  const time = value?.trim() ?? "";
  return timePattern.test(time) ? time : null;
}

function minutesOfDay(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function normalizeTodayFreeTimeWindow(
  start: string | null | undefined,
  end: string | null | undefined
): TodayFreeTimeWindow | null {
  const normalizedStart = normalizeTime(start);
  const normalizedEnd = normalizeTime(end);

  if (!normalizedStart || !normalizedEnd || minutesOfDay(normalizedStart) >= minutesOfDay(normalizedEnd)) {
    return null;
  }

  return {
    start: normalizedStart,
    end: normalizedEnd
  };
}

export function getLegacyTodayFreeTimeWindow(note: string | null | undefined): TodayFreeTimeWindow | null {
  if (!note) {
    return null;
  }

  return legacyFreeTimeRanges[note] ?? null;
}

export function readTodayFreeTimeWindow(config: unknown): TodayFreeTimeWindow | null {
  if (!config || typeof config !== "object") {
    return null;
  }

  const values = config as Record<string, unknown>;
  const start = typeof values.todayFreeTimeStart === "string" ? values.todayFreeTimeStart : null;
  const end = typeof values.todayFreeTimeEnd === "string" ? values.todayFreeTimeEnd : null;
  const explicitWindow = normalizeTodayFreeTimeWindow(start, end);

  if (explicitWindow) {
    return explicitWindow;
  }

  const legacyNote = typeof values.todayFreeTimeNote === "string" ? values.todayFreeTimeNote : null;
  return getLegacyTodayFreeTimeWindow(legacyNote);
}

export function formatTodayFreeTimeWindow(window: TodayFreeTimeWindow) {
  return `${window.start}-${window.end}`;
}
