import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default async function IncompletePage() {
  const user = await requireUser();
  const assignments = await listAssignments(user.id, { sortBy: "priority", onlyIncomplete: true });

  return (
    <div>
      <PageHeader title="未完了課題一覧" description="未着手・進行中の課題を一覧管理" />
      {assignments.length === 0 ? (
        <EmptyState
          title="未完了課題はありません"
          description="この調子です。新しい課題は課題文を貼るだけでInboxに残せます。"
          actions={
            <Link href="/inbox">
              <Button>課題文を貼る</Button>
            </Link>
          }
        />
      ) : (
        <AssignmentList assignments={assignments} />
      )}
    </div>
  );
}
