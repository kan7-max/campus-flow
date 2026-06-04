import { requireUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PageHeader } from "@/components/ui/page-header";

export default async function CalendarPage() {
  const user = await requireUser();
  const assignments = await listAssignments(user.id, { sortBy: "due", onlyIncomplete: true });

  return (
    <div>
      <PageHeader title="カレンダー" description="月表示/週表示で締切と発表日を俯瞰" />
      <CalendarBoard assignments={assignments} />
    </div>
  );
}
