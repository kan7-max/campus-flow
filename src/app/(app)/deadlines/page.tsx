import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { requireUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default async function DeadlinesPage() {
  const user = await requireUser();
  const assignments = await listAssignments(user.id, { sortBy: "due", onlyIncomplete: true });

  const closeDeadlines = assignments.filter((assignment) => differenceInCalendarDays(parseISO(assignment.dueAt), new Date()) <= 7);

  return (
    <div>
      <PageHeader title="締切が近い課題" description="7日以内の課題を優先順で確認" />

      {closeDeadlines.length === 0 ? (
        <EmptyState
          title="直近1週間の締切はありません"
          description="余裕のある期間です。新しい課題文が出たらInboxに残して、先の重い課題を崩しておきましょう。"
          actions={
            <Link href="/inbox">
              <Button variant="outline">Inboxを開く</Button>
            </Link>
          }
        />
      ) : (
        <AssignmentList assignments={closeDeadlines} />
      )}
    </div>
  );
}
