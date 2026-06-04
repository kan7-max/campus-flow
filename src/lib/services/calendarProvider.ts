import type { Assignment } from "@/lib/types/domain";

export type CalendarSyncMode = "create_or_update" | "delete";

export type CalendarSyncResult = {
  externalEventId?: string | null;
  synced: boolean;
  error?: string;
};

export interface CalendarProvider {
  syncAssignment(params: {
    assignment: Assignment;
    mode: CalendarSyncMode;
    existingEventId?: string | null;
    timezone: string;
  }): Promise<CalendarSyncResult>;
}
