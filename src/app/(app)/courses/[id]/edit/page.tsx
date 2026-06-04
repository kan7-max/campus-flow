import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCourses } from "@/lib/repositories/courseRepository";
import { saveCourseAction } from "@/lib/actions/courseActions";
import { CourseForm } from "@/components/courses/course-form";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ResourceNotFound } from "@/components/layout/resource-not-found";

type CourseEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const user = await requireUser();
  const { id } = await params;

  const courses = await listCourses(user.id);
  const course = courses.find((item) => item.id === id);

  if (!course) {
    return (
      <ResourceNotFound
        title="編集する授業が見つかりません"
        description="この授業は削除されたか、デモデータの再起動でIDが変わった可能性があります。授業一覧から現在の授業を選び直してください。"
        primaryHref="/courses"
        primaryLabel="授業一覧へ"
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${course.name} を編集`}
        description="授業情報を更新できます"
        actions={
          <Link href={`/courses/${course.id}`}>
            <Button variant="outline">戻る</Button>
          </Link>
        }
      />

      <CourseForm action={saveCourseAction} initial={course} />
    </div>
  );
}
