"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import type { Assignment } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarBoardProps = {
  assignments: Assignment[];
};

export function CalendarBoard({ assignments }: CalendarBoardProps) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [current, setCurrent] = useState(new Date());

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const monthGridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthGridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const monthDays = useMemo(() => eachDayOfInterval({ start: monthGridStart, end: monthGridEnd }), [monthGridStart, monthGridEnd]);
  const currentMonthDays = useMemo(() => monthDays.filter((day) => isSameMonth(day, current)), [current, monthDays]);

  const weekStart = startOfWeek(current, { weekStartsOn: 1 });
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)),
    [weekStart]
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrent((prev) => subMonths(prev, 1))}>
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrent(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrent((prev) => addMonths(prev, 1))}>
            Next
          </Button>
          <h3 className="ml-2 text-sm font-semibold">{format(current, "yyyy年 M月")}</h3>
        </div>

        <div className="flex gap-2">
          <Button variant={mode === "month" ? "default" : "outline"} size="sm" onClick={() => setMode("month") }>
            月
          </Button>
          <Button variant={mode === "week" ? "default" : "outline"} size="sm" onClick={() => setMode("week") }>
            週
          </Button>
        </div>
      </div>

      {mode === "month" ? (
        <>
          <div className="space-y-2 sm:hidden">
            {currentMonthDays.map((day) => {
              const dayItems = assignments.filter((item) => isSameDay(new Date(item.dueAt), day));
              return (
                <div key={day.toISOString()} className="rounded-md border border-border bg-card p-3">
                  <p className="text-sm font-medium">{format(day, "M/d (EEE)")}</p>
                  {dayItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">課題なし</p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {dayItems.map((item) => (
                        <Link
                          key={item.id}
                          href={`/assignments/${item.id}`}
                          className="block rounded-md bg-primary/10 px-2 py-1 text-sm text-primary hover:bg-primary/15"
                        >
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden grid-cols-7 gap-2 sm:grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <div key={label} className="px-2 text-xs text-muted-foreground">
                {label}
              </div>
            ))}

            {monthDays.map((day) => {
              const dayItems = assignments.filter((item) => isSameDay(new Date(item.dueAt), day));
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[110px] rounded-md border border-border bg-card p-2",
                    !isSameMonth(day, current) && "opacity-40"
                  )}
                >
                  <p className="text-xs text-muted-foreground">{format(day, "d")}</p>
                  <div className="mt-1 space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        href={`/assignments/${item.id}`}
                        className="block truncate rounded bg-primary/10 px-1.5 py-1 text-[11px] text-primary hover:bg-primary/15"
                      >
                        {item.title}
                      </Link>
                    ))}
                    {dayItems.length > 3 ? (
                      <p className="text-[11px] text-muted-foreground">+{dayItems.length - 3} more</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {weekDays.map((day) => {
            const dayItems = assignments.filter((item) => isSameDay(new Date(item.dueAt), day));
            return (
              <div key={day.toISOString()} className="rounded-md border border-border bg-card p-3">
                <p className="text-sm font-medium">{format(day, "M/d (EEE)")}</p>
                {dayItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">課題なし</p>
                ) : (
                  <div className="mt-2 space-y-1">
                    {dayItems.map((item) => (
                      <Link
                        href={`/assignments/${item.id}`}
                        key={item.id}
                        className="block rounded-md bg-primary/10 px-2 py-1 text-sm text-primary hover:bg-primary/15"
                      >
                        {item.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
