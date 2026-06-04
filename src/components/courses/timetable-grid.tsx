"use client";

import Link from "next/link";
import type { Course } from "@/lib/types/domain";

type TimetableGridProps = {
  courses: Course[];
};

const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const dayLabel: Record<(typeof dayOrder)[number], string> = {
  Mon: "月",
  Tue: "火",
  Wed: "水",
  Thu: "木",
  Fri: "金",
  Sat: "土",
  Sun: "日"
};

export function TimetableGrid({ courses }: TimetableGridProps) {
  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border border-border bg-card shadow-card">
      <table className="min-w-[680px] text-sm sm:min-w-[720px]">
        <thead>
          <tr className="border-b border-border bg-muted text-left text-xs font-semibold text-muted-foreground">
            <th className="px-4 py-3">曜日</th>
            <th className="px-4 py-3">授業</th>
            <th className="px-4 py-3">時間</th>
            <th className="px-4 py-3">教室</th>
            <th className="px-4 py-3">教員</th>
          </tr>
        </thead>
        <tbody>
          {dayOrder.map((day) => {
            const dayCourses = courses.filter((course) => course.dayOfWeek === day);
            return dayCourses.length > 0 ? (
              dayCourses.map((course, idx) => (
                <tr key={course.id} className="border-b border-border/60 transition hover:bg-accent">
                  <td className="px-4 py-3 text-muted-foreground">{idx === 0 ? dayLabel[day] : ""}</td>
                  <td className="px-4 py-3">
                    <Link href={`/courses/${course.id}`} className="inline-flex items-center gap-2 hover:text-primary">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: course.color }} />
                      {course.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{course.startTime} - {course.endTime}</td>
                  <td className="px-4 py-3">{course.room ?? "-"}</td>
                  <td className="px-4 py-3">{course.instructor ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr key={day} className="border-b border-border/45 text-muted-foreground">
                <td className="px-4 py-3">{dayLabel[day]}</td>
                <td className="px-4 py-3" colSpan={4}>
                  授業なし
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
