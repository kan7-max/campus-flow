import OpenAI from "openai";
import type { Weekday } from "@/lib/types/domain";

export type TimetableExtractMode = "fast" | "quality";

export type TimetableCourseCandidate = {
  courseName: string;
  dayOfWeek: Weekday;
  period: number | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
};

type TimetableExtractorOptions = {
  apiKey: string;
  file: File;
  mode: TimetableExtractMode;
  preferredModel?: string;
  fallbackModel?: string;
};

type TimetableExtractorResult = {
  candidates: TimetableCourseCandidate[];
  model: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  };
};

const DAY_ALIASES: Array<{ dayOfWeek: Weekday; aliases: string[] }> = [
  { dayOfWeek: "Mon", aliases: ["mon", "monday", "月", "月曜", "月曜日"] },
  { dayOfWeek: "Tue", aliases: ["tue", "tues", "tuesday", "火", "火曜", "火曜日"] },
  { dayOfWeek: "Wed", aliases: ["wed", "wednesday", "水", "水曜", "水曜日"] },
  { dayOfWeek: "Thu", aliases: ["thu", "thur", "thurs", "thursday", "木", "木曜", "木曜日"] },
  { dayOfWeek: "Fri", aliases: ["fri", "friday", "金", "金曜", "金曜日"] },
  { dayOfWeek: "Sat", aliases: ["sat", "saturday", "土", "土曜", "土曜日"] },
  { dayOfWeek: "Sun", aliases: ["sun", "sunday", "日", "日曜", "日曜日"] }
];

const DAY_ORDER: Record<Weekday, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6
};

const TIMETABLE_PROMPT_BY_MODE: Record<TimetableExtractMode, string> = {
  fast:
    "この画像は大学の時間割です。読み取れた授業だけをJSONで返してください。"
    + " 出力は必ず1つのJSONオブジェクトのみ。Markdownや説明は不要です。"
    + " 細かい文字（開始時刻・終了時刻・教室）も可能な限り読み取ってください。"
    + " 形式: {\"candidates\":[{\"courseName\":\"授業名\",\"day\":\"月曜日\",\"period\":\"1限またはnull\",\"startTime\":\"09:00またはnull\",\"endTime\":\"10:30またはnull\",\"room\":\"教室またはnull\"}]}"
    + " 曜日が不明な行は除外してください。候補がなければ {\"candidates\":[]} を返してください。",
  quality:
    "この時間割画像から授業候補をできるだけ漏れなく抽出し、JSONだけで返してください。"
    + " 出力は必ず1つのJSONオブジェクトのみ。Markdownや説明は不要です。"
    + " 開始時刻・終了時刻・教室などの小さい文字も拡大して読み取ってください。"
    + " 形式: {\"candidates\":[{\"courseName\":\"授業名\",\"day\":\"月曜日\",\"period\":\"1限またはnull\",\"startTime\":\"09:00またはnull\",\"endTime\":\"10:30またはnull\",\"room\":\"教室またはnull\"}]}"
    + " 曜日が不明な行は除外してください。候補がなければ {\"candidates\":[]} を返してください。"
};

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function extractJsonText(raw: string) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
}

function parseKanjiNumber(input: string) {
  const cleaned = input.replace(/第/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const map: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };

  if (map[cleaned]) {
    return map[cleaned];
  }

  if (cleaned.includes("十")) {
    const [left, right] = cleaned.split("十");
    const tens = left ? map[left] ?? 0 : 1;
    const ones = right ? map[right] ?? 0 : 0;
    const value = tens * 10 + ones;
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  return null;
}

function normalizeDayOfWeek(value: unknown): Weekday | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeDigits(value).toLowerCase().replace(/\s+/g, "");
  if (!normalized) {
    return null;
  }

  for (const item of DAY_ALIASES) {
    if (item.aliases.some((alias) => normalized === alias || normalized.includes(alias))) {
      return item.dayOfWeek;
    }
  }

  const combined = normalized.match(/([月火水木金土日]).*?([0-9]+|[一二三四五六七八九十]+)/);
  if (combined?.[1]) {
    return normalizeDayOfWeek(combined[1]);
  }

  return null;
}

function normalizePeriod(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const text = normalizeDigits(String(value)).replace(/\s+/g, "");
  if (!text) {
    return null;
  }

  const directNumber = text.match(/([0-9]{1,2})/);
  if (directNumber) {
    const parsed = Number(directNumber[1]);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
      return parsed;
    }
  }

  const kanjiMatch = text.match(/([一二三四五六七八九十]{1,3})/);
  if (kanjiMatch?.[1]) {
    const parsed = parseKanjiNumber(kanjiMatch[1]);
    if (parsed !== null && parsed >= 1 && parsed <= 12) {
      return parsed;
    }
  }

  return null;
}

function normalizeSingleTime(value: string) {
  const text = normalizeDigits(value).trim().toLowerCase();
  if (!text) {
    return null;
  }

  const ampmMatch = text.match(/\b(am|pm)\b/);
  const hasPm = ampmMatch?.[1] === "pm";
  const hasAm = ampmMatch?.[1] === "am";

  const direct = text.match(/([0-2]?\d)\s*[:：時\.]\s*([0-5]?\d)?/);
  if (direct) {
    let hour = Number(direct[1]);
    const minute = direct[2] ? Number(direct[2]) : 0;

    if (hasPm && hour < 12) {
      hour += 12;
    }
    if (hasAm && hour === 12) {
      hour = 0;
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
  }

  const compact = text.match(/\b([0-2]\d)([0-5]\d)\b/);
  if (compact) {
    const hour = Number(compact[1]);
    const minute = Number(compact[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${compact[1]}:${compact[2]}`;
    }
  }

  const hourOnly = text.match(/([0-2]?\d)\s*時\b/);
  if (hourOnly) {
    let hour = Number(hourOnly[1]);
    if (hasPm && hour < 12) {
      hour += 12;
    }
    if (hasAm && hour === 12) {
      hour = 0;
    }
    if (hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:00`;
    }
  }

  return null;
}

function normalizeTimeRange(value: unknown) {
  if (typeof value !== "string") {
    return { startTime: null, endTime: null };
  }

  const text = normalizeDigits(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return { startTime: null, endTime: null };
  }

  const range = text.match(
    /([0-2]?\d(?:\s*[:：時\.]\s*[0-5]?\d)?(?:\s*時)?(?:\s*(?:am|pm))?)\s*[-~〜–ー−]\s*([0-2]?\d(?:\s*[:：時\.]\s*[0-5]?\d)?(?:\s*時)?(?:\s*(?:am|pm))?)/i
  );

  if (!range) {
    return { startTime: null, endTime: null };
  }

  const startTime = normalizeSingleTime(range[1]);
  const endTime = normalizeSingleTime(range[2]);
  return { startTime, endTime };
}

function normalizeRoom(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const room = value.trim();
  if (!room) {
    return null;
  }

  if (/^(なし|なし|-|不明|null|none)$/i.test(room)) {
    return null;
  }

  return room.slice(0, 80);
}

function normalizeCourseName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.replace(/\s+/g, " ").trim();
  if (!name) {
    return null;
  }

  return name.slice(0, 120);
}

type RawCandidate = {
  className?: unknown;
  course?: unknown;
  courseName?: unknown;
  day?: unknown;
  dayOfWeek?: unknown;
  period?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  time?: unknown;
  timeRange?: unknown;
  room?: unknown;
  slot?: unknown;
  timeSlot?: unknown;
};

function toRawCandidates(payload: unknown): RawCandidate[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.candidates)) {
    return record.candidates as RawCandidate[];
  }

  if (Array.isArray(record.courses)) {
    return record.courses as RawCandidate[];
  }

  if (Array.isArray(payload)) {
    return payload as RawCandidate[];
  }

  return [];
}

function dedupeCandidates(candidates: TimetableCourseCandidate[]) {
  const map = new Map<string, TimetableCourseCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.courseName.toLowerCase(),
      candidate.dayOfWeek,
      String(candidate.period),
      (candidate.room ?? "").toLowerCase()
    ].join("|");

    if (!map.has(key)) {
      map.set(key, candidate);
    }
  }

  return Array.from(map.values()).sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) {
      return DAY_ORDER[left.dayOfWeek] - DAY_ORDER[right.dayOfWeek];
    }
    if (left.startTime && right.startTime && left.startTime !== right.startTime) {
      return left.startTime.localeCompare(right.startTime);
    }
    if (left.period !== right.period) {
      const leftPeriod = left.period ?? 99;
      const rightPeriod = right.period ?? 99;
      return leftPeriod - rightPeriod;
    }
    return left.courseName.localeCompare(right.courseName);
  });
}

function normalizeCandidates(payload: unknown) {
  const rawCandidates = toRawCandidates(payload);
  const normalized: TimetableCourseCandidate[] = [];

  for (const raw of rawCandidates) {
    const courseName = normalizeCourseName(raw.courseName ?? raw.className ?? raw.course);
    const dayOfWeek = normalizeDayOfWeek(raw.dayOfWeek ?? raw.day ?? raw.slot ?? raw.timeSlot);
    const period = normalizePeriod(raw.period ?? raw.slot ?? raw.timeSlot ?? raw.timeRange ?? raw.time);
    const explicitStartTime = normalizeSingleTime(typeof raw.startTime === "string" ? raw.startTime : "");
    const explicitEndTime = normalizeSingleTime(typeof raw.endTime === "string" ? raw.endTime : "");
    const parsedRange = normalizeTimeRange(raw.timeRange ?? raw.timeSlot ?? raw.slot ?? raw.time);
    const startTime = explicitStartTime ?? parsedRange.startTime;
    const endTime = explicitEndTime ?? parsedRange.endTime;
    const room = normalizeRoom(raw.room);

    if (!courseName || !dayOfWeek) {
      continue;
    }

    normalized.push({
      courseName,
      dayOfWeek,
      period,
      startTime,
      endTime,
      room
    });
  }

  return dedupeCandidates(normalized);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}

export async function extractTimetableCandidatesFromImage(
  options: TimetableExtractorOptions
): Promise<TimetableExtractorResult> {
  const baseModelCandidates = options.mode === "fast"
    ? [options.preferredModel, "gpt-4o-mini", options.fallbackModel]
    : [options.preferredModel, "gpt-4o", "gpt-4o-mini", options.fallbackModel];
  const modelCandidates = Array.from(new Set(baseModelCandidates.filter(Boolean))) as string[];
  const timeoutMs = options.mode === "fast" ? 14_000 : 40_000;
  const prompt = TIMETABLE_PROMPT_BY_MODE[options.mode];
  const buffer = Buffer.from(await options.file.arrayBuffer());
  const mime = options.file.type && options.file.type.startsWith("image/") ? options.file.type : "image/png";
  const imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  const client = new OpenAI({ apiKey: options.apiKey, maxRetries: 0 });
  const failures: string[] = [];

  for (const model of modelCandidates) {
    try {
      const response = await withTimeout(
        client.responses.create({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_image",
                  image_url: imageDataUrl,
                  detail: "high"
                },
                {
                  type: "input_text",
                  text: prompt
                }
              ]
            }
          ],
          max_output_tokens: options.mode === "fast" ? 700 : 1800
        }),
        timeoutMs,
        `Timetable OCR (${model})`
      );

      const outputText = normalizeText(response.output_text ?? "");
      if (!outputText) {
        failures.push(`${model}: empty response`);
        continue;
      }

      const jsonText = extractJsonText(outputText);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        failures.push(`${model}: invalid json`);
        continue;
      }

      const candidates = normalizeCandidates(parsed);
      if (candidates.length === 0) {
        failures.push(`${model}: no normalized candidates`);
        continue;
      }

      return {
        candidates,
        model: String(response.model ?? model),
        usage: {
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null
        }
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${reason}`);
    }
  }

  throw new Error(failures.join(" | "));
}

export async function extractTimetableCandidatesFromPdf(
  options: TimetableExtractorOptions
): Promise<TimetableExtractorResult> {
  const baseModelCandidates = options.mode === "fast"
    ? [options.preferredModel, "gpt-4o-mini", options.fallbackModel]
    : [options.preferredModel, "gpt-4o", "gpt-4o-mini", options.fallbackModel];
  const modelCandidates = Array.from(new Set(baseModelCandidates.filter(Boolean))) as string[];
  const timeoutMs = options.mode === "fast" ? 32_000 : 80_000;
  const prompt = TIMETABLE_PROMPT_BY_MODE[options.mode];
  const buffer = Buffer.from(await options.file.arrayBuffer());
  const fileData = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const client = new OpenAI({ apiKey: options.apiKey, maxRetries: 0 });
  const failures: string[] = [];

  for (const model of modelCandidates) {
    try {
      const response = await withTimeout(
        client.responses.create({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_file",
                  filename: options.file.name || "timetable.pdf",
                  file_data: fileData
                },
                {
                  type: "input_text",
                  text: prompt
                }
              ]
            }
          ],
          max_output_tokens: options.mode === "fast" ? 900 : 2400
        }),
        timeoutMs,
        `Timetable PDF (${model})`
      );

      const outputText = normalizeText(response.output_text ?? "");
      if (!outputText) {
        failures.push(`${model}: empty response`);
        continue;
      }

      const jsonText = extractJsonText(outputText);
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        failures.push(`${model}: invalid json`);
        continue;
      }

      const candidates = normalizeCandidates(parsed);
      if (candidates.length === 0) {
        failures.push(`${model}: no normalized candidates`);
        continue;
      }

      return {
        candidates,
        model: String(response.model ?? model),
        usage: {
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null
        }
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${reason}`);
    }
  }

  throw new Error(failures.join(" | "));
}
