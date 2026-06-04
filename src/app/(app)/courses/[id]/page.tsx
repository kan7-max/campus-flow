import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCourses } from "@/lib/repositories/courseRepository";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResourceNotFound } from "@/components/layout/resource-not-found";

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const [courses, assignments] = await Promise.all([
    listCourses(user.id),
    listAssignments(user.id, { sortBy: "due" })
  ]);

  const course = courses.find((item) => item.id === id);

  if (!course) {
    return (
      <ResourceNotFound
        title="授業が見つかりません"
        description="この授業は削除されたか、デモデータの再起動でIDが変わった可能性があります。授業一覧から現在の授業を開き直してください。"
        primaryHref="/courses"
        primaryLabel="授業一覧へ"
      />
    );
  }

  const linkedAssignments = assignments.filter((item) => item.courseId === course.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title={course.name}
        description={`${course.dayOfWeek} ${course.startTime} - ${course.endTime}`}
        actions={
          <div className="flex gap-2">
            <Link href={`/courses/${course.id}/edit`}>
              <Button>編集</Button>
            </Link>
            <Link href="/courses">
              <Button variant="outline">授業一覧へ戻る</Button>
            </Link>
          </div>
        }
      />

      <Card>
        <div className="space-y-2 text-sm">
          <p>教室: {course.room ?? "-"}</p>
          <p>教員: {course.instructor ?? "-"}</p>
          <p>メモ: {course.memo ?? "-"}</p>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold">この授業の課題</h3>
        {linkedAssignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">この授業に紐づく課題はまだありません。</p>
        ) : (
          <div className="space-y-3">
            {linkedAssignments.map((assignment) => (
              <Link
                key={assignment.id}
                href={`/assignments/${assignment.id}`}
                className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:bg-accent"
              >
                <p className="font-medium">{assignment.title}</p>
                <p className="text-xs text-muted-foreground">締切: {assignment.dueAt}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
