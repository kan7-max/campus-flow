import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, upsertCourse } from "@/lib/repositories/courseRepository";
import type { Course, Weekday } from "@/lib/types/domain";

const weekdaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

const candidateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dayOfWeek: weekdaySchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().max(80).optional().nullable(),
  instructor: z.string().trim().max(80).optional().nullable(),
  color: z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/).optional().nullable(),
  memo: z.string().trim().max(240).optional().nullable()
});

const bodySchema = z.object({
  candidates: z.array(candidateSchema).min(1).max(40)
});

const AUTO_CREATED_COURSE_MEMO = "AI入力から自動作成された授業";

type ParsedCandidate = z.infer<typeof candidateSchema>;

type NormalizedCandidate = {
  color: string;
  dayOfWeek: Weekday;
  endTime: string;
  instructor: string | null;
  memo: string | null;
  name: string;
  normalizedName: string;
  room: string | null;
  startTime: string;
};

function normalizeNameKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function toCourseKey(normalizedName: string, dayOfWeek: Weekday, startTime: string, endTime: string) {
  return `${normalizedName}|${dayOfWeek}|${startTime}|${endTime}`;
}

function toCourseKeyFromCourse(course: Course) {
  return toCourseKey(normalizeNameKey(course.name), course.dayOfWeek, course.startTime, course.endTime);
}

function toNormalizedCandidate(candidate: ParsedCandidate): NormalizedCandidate {
  const name = candidate.name.trim().replace(/\s+/g, " ");

  return {
    name,
    normalizedName: normalizeNameKey(name),
    dayOfWeek: candidate.dayOfWeek as Weekday,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    room: normalizeNullableText(candidate.room),
    instructor: normalizeNullableText(candidate.instructor),
    color: (candidate.color ?? "").trim() || "#2563EB",
    memo: normalizeNullableText(candidate.memo)
  };
}

function mergeCandidates(base: NormalizedCandidate, next: NormalizedCandidate): NormalizedCandidate {
  return {
    ...base,
    room: base.room ?? next.room,
    instructor: base.instructor ?? next.instructor,
    memo: base.memo ?? next.memo,
    color: base.color || next.color
  };
}

function isAiAutoCreatedCourse(course: Course) {
  return (course.memo ?? "").includes(AUTO_CREATED_COURSE_MEMO);
}

function buildUpsertInputForExisting(userId: string, existing: Course, candidate: NormalizedCandidate) {
  return {
    id: existing.id,
    userId,
    name: candidate.name,
    dayOfWeek: candidate.dayOfWeek,
    startTime: candidate.startTime,
    endTime: candidate.endTime,
    room: candidate.room ?? existing.room,
    instructor: candidate.instructor ?? existing.instructor,
    color: candidate.color || existing.color,
    memo: candidate.memo ?? existing.memo
  };
}

function hasCourseChanged(existing: Course, candidate: NormalizedCandidate) {
  const merged = buildUpsertInputForExisting(existing.userId, existing, candidate);

  return (
    existing.name !== merged.name
    || existing.dayOfWeek !== merged.dayOfWeek
    || existing.startTime !== merged.startTime
    || existing.endTime !== merged.endTime
    || (existing.room ?? null) !== (merged.room ?? null)
    || (existing.instructor ?? null) !== (merged.instructor ?? null)
    || existing.color !== merged.color
    || (existing.memo ?? null) !== (merged.memo ?? null)
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const dedupedCandidatesByKey = new Map<string, NormalizedCandidate>();
    let skippedWithinRequestCount = 0;

    for (const row of body.candidates) {
      const normalized = toNormalizedCandidate(row);
      const candidateKey = toCourseKey(normalized.normalizedName, normalized.dayOfWeek, normalized.startTime, normalized.endTime);
      const current = dedupedCandidatesByKey.get(candidateKey);

      if (!current) {
        dedupedCandidatesByKey.set(candidateKey, normalized);
        continue;
      }

      dedupedCandidatesByKey.set(candidateKey, mergeCandidates(current, normalized));
      skippedWithinRequestCount += 1;
    }

    const existingCourses = await listCourses(user.id);
    const existingByExactKey = new Map<string, Course[]>();
    const aiAutoCreatedByName = new Map<string, Course[]>();

    for (const course of existingCourses) {
      const key = toCourseKeyFromCourse(course);
      const exactBucket = existingByExactKey.get(key) ?? [];
      exactBucket.push(course);
      existingByExactKey.set(key, exactBucket);

      if (!isAiAutoCreatedCourse(course)) {
        continue;
      }

      const nameKey = normalizeNameKey(course.name);
      const nameBucket = aiAutoCreatedByName.get(nameKey) ?? [];
      nameBucket.push(course);
      aiAutoCreatedByName.set(nameKey, nameBucket);
    }

    const savedCourses: Course[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let skippedNoChangeCount = 0;

    for (const candidate of dedupedCandidatesByKey.values()) {
      const exactKey = toCourseKey(candidate.normalizedName, candidate.dayOfWeek, candidate.startTime, candidate.endTime);
      const exactMatch = existingByExactKey.get(exactKey)?.[0] ?? null;

      if (exactMatch) {
        if (!hasCourseChanged(exactMatch, candidate)) {
          skippedNoChangeCount += 1;
          continue;
        }

        const updated = await upsertCourse(buildUpsertInputForExisting(user.id, exactMatch, candidate));
        savedCourses.push(updated);
        updatedCount += 1;
        continue;
      }

      const autoCreatedBucket = aiAutoCreatedByName.get(candidate.normalizedName) ?? [];
      const autoCreatedTarget = autoCreatedBucket.shift() ?? null;
      aiAutoCreatedByName.set(candidate.normalizedName, autoCreatedBucket);

      if (autoCreatedTarget) {
        const updated = await upsertCourse(buildUpsertInputForExisting(user.id, autoCreatedTarget, candidate));
        savedCourses.push(updated);
        updatedCount += 1;
        continue;
      }

      const created = await upsertCourse({
        userId: user.id,
        name: candidate.name,
        dayOfWeek: candidate.dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        room: candidate.room,
        instructor: candidate.instructor,
        color: candidate.color,
        memo: candidate.memo
      });
      savedCourses.push(created);
      createdCount += 1;
    }

    try {
      revalidatePath("/courses");
      revalidatePath("/dashboard");
      revalidatePath("/assignments");
      revalidatePath("/today");
    } catch (revalidateError) {
      console.error("Course bulk-save revalidate failed", revalidateError);
    }

    const skippedCount = skippedWithinRequestCount + skippedNoChangeCount;

    return NextResponse.json({
      createdCount,
      updatedCount,
      skippedCount,
      savedCount: savedCourses.length,
      courseIds: savedCourses.map((course) => course.id)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "候補データの形式が不正です。入力内容を確認してください。" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "一括保存に失敗しました。" },
      { status: 400 }
    );
  }
}
