import { addMinutes, formatISO } from "date-fns";
import { env } from "@/lib/env";
import type { Assignment } from "@/lib/types/domain";
import type { CalendarProvider, CalendarSyncMode, CalendarSyncResult } from "@/lib/services/calendarProvider";

type GoogleCalendarProviderOptions = {
  accessToken: string | null;
};

export class GoogleCalendarProvider implements CalendarProvider {
  private accessToken: string | null;

  constructor(options: GoogleCalendarProviderOptions) {
    this.accessToken = options.accessToken;
  }

  async syncAssignment(params: {
    assignment: Assignment;
    mode: CalendarSyncMode;
    existingEventId?: string | null;
    timezone: string;
  }): Promise<CalendarSyncResult> {
    const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID ?? "primary");
    const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

    if (params.mode === "delete") {
      if (!params.existingEventId) {
        return { synced: true };
      }

      if (!this.accessToken) {
        return {
          synced: false,
          error: "Google Calendar token not connected"
        };
      }

      const deleteRes = await fetch(`${base}/${encodeURIComponent(params.existingEventId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      if (!deleteRes.ok && deleteRes.status !== 404) {
        const text = await deleteRes.text();
        return { synced: false, error: `Google Calendar delete failed: ${text}` };
      }

      return { synced: true };
    }

    if (!this.accessToken) {
      return {
        synced: false,
        error: "Google Calendar token not connected"
      };
    }

    const start = params.assignment.dueAt;
    const end = formatISO(addMinutes(new Date(start), 30));

    const payload = {
      summary: `[課題] ${params.assignment.title}`,
      description: [
        `授業: ${params.assignment.course?.name ?? "未設定"}`,
        `提出先: ${params.assignment.submissionTarget ?? "未設定"}`,
        `種別: ${params.assignment.assignmentType}`,
        `メモ: ${params.assignment.memo ?? "-"}`,
        `TaskFlow ID: ${params.assignment.id}`
      ].join("\n"),
      start: {
        dateTime: start,
        timeZone: params.timezone
      },
      end: {
        dateTime: end,
        timeZone: params.timezone
      }
    };

    const targetUrl = params.existingEventId
      ? `${base}/${encodeURIComponent(params.existingEventId)}`
      : base;

    const method = params.existingEventId ? "PATCH" : "POST";

    const syncRes = await fetch(targetUrl, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!syncRes.ok) {
      const text = await syncRes.text();
      return {
        synced: false,
        error: `Google Calendar ${method} failed: ${text}`
      };
    }

    const json = (await syncRes.json()) as { id?: string };

    return {
      synced: true,
      externalEventId: json.id ?? params.existingEventId ?? null
    };
  }
}
