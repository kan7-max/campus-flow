"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { deleteCourse, upsertCourse } from "@/lib/repositories/courseRepository";
import type { Weekday } from "@/lib/types/domain";

const courseSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  dayOfWeek: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  room: z.string().nullable(),
  instructor: z.string().nullable(),
  color: z.string().nullable(),
  memo: z.string().nullable()
});

export async function saveCourseAction(formData: FormData) {
  const user = await requireUser();

  const parsed = courseSchema.parse({
    id: formData.get("id")?.toString() || undefined,
    name: formData.get("name")?.toString() ?? "",
    dayOfWeek: formData.get("dayOfWeek")?.toString() ?? "Mon",
    startTime: formData.get("startTime")?.toString() ?? "09:00",
    endTime: formData.get("endTime")?.toString() ?? "10:30",
    room: formData.get("room")?.toString() || null,
    instructor: formData.get("instructor")?.toString() || null,
    color: formData.get("color")?.toString() || null,
    memo: formData.get("memo")?.toString() || null
  });

  await upsertCourse({
    id: parsed.id,
    userId: user.id,
    name: parsed.name,
    dayOfWeek: parsed.dayOfWeek as Weekday,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    room: parsed.room,
    instructor: parsed.instructor,
    color: parsed.color ?? "#38bdf8",
    memo: parsed.memo
  });

  revalidatePath("/courses");
  revalidatePath("/dashboard");
  revalidatePath("/assignments");
}

export async function deleteCourseAction(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id")?.toString();
  if (!id) {
    throw new Error("Course ID is required");
  }

  await deleteCourse(user.id, id);

  revalidatePath("/courses");
  revalidatePath("/assignments");
}
