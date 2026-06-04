import { requireUser } from "@/lib/auth";
import { getAssignmentById, listSubtasks } from "@/lib/repositories/assignmentRepository";
import { listCourses } from "@/lib/repositories/courseRepository";
import { saveAssignmentAction } from "@/lib/actions/assignmentActions";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { PageHeader } from "@/components/ui/page-header";
import { ResourceNotFound } from "@/components/layout/resource-not-found";

type AssignmentEditProps = {
  params: Promise<{ id: string }>;
};

export default async function AssignmentEditPage({ params }: AssignmentEditProps) {
  const user = await requireUser();
  const { id } = await params;

  const [assignment, courses, subtasks] = await Promise.all([
    getAssignmentById(user.id, id),
    listCourses(user.id),
    listSubtasks(user.id, id)
  ]);

  if (!assignment) {
    return (
      <ResourceNotFound
        title="編集する課題が見つかりません"
        description="この課題は削除されたか、デモデータの再起動でIDが変わった可能性があります。課題一覧から現在の課題を選び直してください。"
        primaryHref="/assignments"
        primaryLabel="課題一覧へ"
      />
    );
  }

  assignment.subtasks = subtasks;

  return (
    <div>
      <PageHeader title="課題編集" description="内容修正後、保存時にGoogleカレンダー同期も再実行されます。" />
      <AssignmentForm assignment={assignment} courses={courses} action={saveAssignmentAction} submitLabel="更新して保存" />
    </div>
  );
}
