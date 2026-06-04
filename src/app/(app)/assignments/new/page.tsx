import { requireUser } from "@/lib/auth";
import { listCourses } from "@/lib/repositories/courseRepository";
import { saveAssignmentAction } from "@/lib/actions/assignmentActions";
import { AssignmentForm } from "@/components/assignments/assignment-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewAssignmentPage() {
  const user = await requireUser();
  const courses = await listCourses(user.id);

  return (
    <div>
      <PageHeader
        title="課題作成"
        description="スマホでは最上部入力だけでクイック作成、詳細はあとで編集可能"
      />
      <AssignmentForm courses={courses} action={saveAssignmentAction} submitLabel="課題を作成" />
    </div>
  );
}
