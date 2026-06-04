import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { Course, CourseUpsertInput } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database";

type CourseRow = Database["public"]["Tables"]["courses"]["Row"];

type CourseInsert = Database["public"]["Tables"]["courses"]["Insert"];
type CourseUpdate = Database["public"]["Tables"]["courses"]["Update"];

function mapCourse(row: CourseRow): Course {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    dayOfWeek: row.day_of_week as Course["dayOfWeek"],
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    instructor: row.instructor,
    color: row.color,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toInsertPayload(input: CourseUpsertInput): CourseInsert {
  return {
    user_id: input.userId,
    name: input.name,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    room: input.room ?? null,
    instructor: input.instructor ?? null,
    color: input.color ?? "#38bdf8",
    memo: input.memo ?? null
  };
}

function toUpdatePayload(input: CourseUpsertInput): CourseUpdate {
  return {
    name: input.name,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    room: input.room ?? null,
    instructor: input.instructor ?? null,
    color: input.color ?? "#38bdf8",
    memo: input.memo ?? null,
    updated_at: new Date().toISOString()
  };
}

export async function listCourses(userId: string): Promise<Course[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.courses.filter((course) => course.userId === userId);
  }

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`Failed to list courses: ${error.message}`);
  }

  return (data as CourseRow[]).map(mapCourse);
}

export async function getCourseById(userId: string, id: string): Promise<Course | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    return store.courses.find((course) => course.userId === userId && course.id === id) ?? null;
  }

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch course: ${error.message}`);
  }

  return data ? mapCourse(data as CourseRow) : null;
}

export async function upsertCourse(input: CourseUpsertInput): Promise<Course> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();

    if (input.id) {
      const current = store.courses.find((course) => course.id === input.id && course.userId === input.userId);
      if (!current) {
        throw new Error("Course not found");
      }

      current.name = input.name;
      current.dayOfWeek = input.dayOfWeek;
      current.startTime = input.startTime;
      current.endTime = input.endTime;
      current.room = input.room ?? null;
      current.instructor = input.instructor ?? null;
      current.color = input.color ?? "#38bdf8";
      current.memo = input.memo ?? null;
      current.updatedAt = new Date().toISOString();
      persistMockStore(store);
      return current;
    }

    const now = new Date().toISOString();
    const created: Course = {
      id: crypto.randomUUID(),
      userId: input.userId,
      name: input.name,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room ?? null,
      instructor: input.instructor ?? null,
      color: input.color ?? "#38bdf8",
      memo: input.memo ?? null,
      createdAt: now,
      updatedAt: now
    };
    store.courses.push(created);
    persistMockStore(store);
    return created;
  }

  if (input.id) {
    const { data, error } = await supabase
      .from("courses")
      .update(toUpdatePayload(input))
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update course: ${error.message}`);
    }

    return mapCourse(data as CourseRow);
  }

  const { data, error } = await supabase.from("courses").insert(toInsertPayload(input)).select("*").single();
  if (error) {
    throw new Error(`Failed to create course: ${error.message}`);
  }

  return mapCourse(data as CourseRow);
}

export async function deleteCourse(userId: string, courseId: string) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    store.courses = store.courses.filter((course) => !(course.id === courseId && course.userId === userId));
    persistMockStore(store);
    return;
  }

  const { error } = await supabase.from("courses").delete().eq("id", courseId).eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete course: ${error.message}`);
  }
}
