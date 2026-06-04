import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { listCourses } from "@/lib/repositories/courseRepository";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { deleteCourseAction, saveCourseAction } from "@/lib/actions/courseActions";
import { CourseForm } from "@/components/courses/course-form";
import { CourseImageImporter } from "@/components/courses/course-image-importer";
import { TimetableGrid } from "@/components/courses/timetable-grid";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function CoursesPage() {
  const user = await requireUser();
  const [courses, assignments] = await Promise.all([
    listCourses(user.id),
    listAssignments(user.id, { sortBy: "due" })
  ]);

  return (
    <div className="space-y-5">
      <PageHeader title="授業別管理" description="授業名、曜日、時限を入れて保存します。" />

      <section className="rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4" id="course-form">
        <div className="mb-3">
          <h3 className="text-base font-semibold">授業を追加</h3>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            入力順は「授業名 → 曜日 → 時限 → 保存」です。あとから編集できます。
          </p>
        </div>
        <CourseForm action={saveCourseAction} />
      </section>

      <CourseImageImporter />

      <section className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="min-w-0">
          <h3 className="mb-3 text-base font-semibold">時間割</h3>
          {courses.length === 0 ? (
            <EmptyState
              title="授業がありません"
              description="授業名だけでも追加しておくと、Inboxから課題化するときに整理しやすくなります。"
              actions={
                <a href="#course-form">
                  <Button variant="outline">授業を保存する</Button>
                </a>
              }
            />
          ) : (
            <TimetableGrid courses={courses} />
          )}
        </Card>

        <Card className="min-w-0">
          <h3 className="mb-3 text-base font-semibold">授業別課題サマリー</h3>
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">授業を追加すると、ここに未完了課題の件数が表示されます。</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {courses.map((course) => {
                const linked = assignments.filter((assignment) => assignment.courseId === course.id);
                return (
                  <div key={course.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="truncate font-medium">{course.name}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          未完了 {linked.filter((item) => item.status !== "done").length} / 全{linked.length}
                        </p>
                      </div>
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: course.color }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{course.dayOfWeek} {course.startTime} - {course.endTime}</p>

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Link href={`/courses/${course.id}/edit`}>
                        <Button type="button" variant="outline" size="sm" className="w-full">
                          編集
                        </Button>
                      </Link>
                      <form action={deleteCourseAction}>
                        <input type="hidden" name="id" value={course.id} />
                        <Button type="submit" variant="outline" size="sm" className="w-full">
                          削除
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
