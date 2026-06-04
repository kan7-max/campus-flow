import { format, formatDistanceToNowStrict, isToday, parseISO } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function parseDateValue(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = parseDateValue(value);
  if (!date) {
    return "-";
  }

  return format(date, "yyyy/MM/dd HH:mm");
}

export function formatDateTimeWithSeconds(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = parseDateValue(value);
  if (!date) {
    return "-";
  }

  return format(date, "yyyy/MM/dd HH:mm:ss");
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = parseDateValue(value);
  if (!date) {
    return "-";
  }

  return format(date, "yyyy/MM/dd");
}

export function dueInText(dueDateIso: string) {
  const due = parseDateValue(dueDateIso);
  if (!due) {
    return "Unknown due date";
  }

  if (isToday(due)) {
    return "Today";
  }

  return formatDistanceToNowStrict(due, { addSuffix: true });
}

export function toInt(value: string | number | null | undefined, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return fallback;
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
