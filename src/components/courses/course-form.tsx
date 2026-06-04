"use client";

import { useMemo, useState } from "react";
import { WEEKDAYS } from "@/lib/constants/domain";
import type { Course } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CourseFormProps = {
  action: (formData: FormData) => Promise<void>;
  initial?: Course | null;
};

const WEEKDAY_LABELS = {
  Mon: "月",
  Tue: "火",
  Wed: "水",
  Thu: "木",
  Fri: "金",
  Sat: "土",
  Sun: "日"
} as const;

function isEndAfterStart(startTime: string, endTime: string) {
  return !startTime || !endTime || endTime > startTime;
}

export function CourseForm({ action, initial }: CourseFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "10:30");
  const nameError = name.trim() ? null : "授業名を入力してください。例: 線形代数学";
  const timeError = isEndAfterStart(startTime, endTime) ? null : "終了時刻は開始時刻より後にしてください。";
  const hasBlockingError = Boolean(nameError || timeError);
  const submitLabel = initial ? "授業を更新" : "授業を保存";
  const requiredHelp = useMemo(() => "必須", []);

  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-3 shadow-card sm:p-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid gap-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label htmlFor="name" className="mb-0 text-sm text-foreground">授業名</Label>
            <span className="text-xs font-medium text-danger">{requiredHelp}</span>
          </div>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            aria-describedby="course-name-help course-name-error"
            aria-invalid={Boolean(nameError)}
            placeholder="例: 線形代数学"
          />
          <p id="course-name-help" className="mt-1 text-xs text-muted-foreground">LMSや時間割で見える授業名をそのまま入れます。</p>
          {nameError ? <p id="course-name-error" className="mt-1 text-xs text-danger">{nameError}</p> : null}
        </div>

        <div>
          <Label htmlFor="dayOfWeek" className="text-sm text-foreground">曜日</Label>
          <Select id="dayOfWeek" name="dayOfWeek" defaultValue={initial?.dayOfWeek ?? "Mon"}>
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day]}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">授業がある曜日を選びます。</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="startTime" className="text-sm text-foreground">開始時刻</Label>
            <Input
              id="startTime"
              name="startTime"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              aria-describedby={timeError ? "course-time-error" : undefined}
              aria-invalid={Boolean(timeError)}
            />
          </div>

          <div>
            <Label htmlFor="endTime" className="text-sm text-foreground">終了時刻</Label>
            <Input
              id="endTime"
              name="endTime"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              aria-describedby={timeError ? "course-time-error" : undefined}
              aria-invalid={Boolean(timeError)}
            />
          </div>
        </div>
        {timeError ? <p id="course-time-error" className="-mt-2 text-xs text-danger">{timeError}</p> : null}

        <div>
          <Label htmlFor="room" className="text-sm text-foreground">教室</Label>
          <Input id="room" name="room" defaultValue={initial?.room ?? ""} placeholder="例: 1号館101" />
        </div>

        <div>
          <Label htmlFor="instructor" className="text-sm text-foreground">教員</Label>
          <Input id="instructor" name="instructor" defaultValue={initial?.instructor ?? ""} placeholder="任意" />
        </div>

        <div>
          <Label htmlFor="color" className="text-sm text-foreground">色</Label>
          <Input id="color" name="color" type="color" defaultValue={initial?.color ?? "#2563EB"} className="h-11 p-1" />
        </div>

        <div>
          <Label htmlFor="memo" className="text-sm text-foreground">メモ</Label>
          <Textarea id="memo" name="memo" defaultValue={initial?.memo ?? ""} className="min-h-[72px]" placeholder="任意: LMS名、教室メモなど" />
        </div>
      </div>

      <div className="sticky bottom-0 -mx-3 border-t border-border bg-card/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Button type="submit" className="w-full sm:w-auto" disabled={hasBlockingError}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
