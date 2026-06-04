import { Badge } from "@/components/ui/badge";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/constants/domain";
import type { AssignmentStatus } from "@/lib/types/domain";

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  const colorClass =
    status === "done"
      ? "border-success/35 bg-success/10 text-success"
      : status === "in_progress"
        ? "border-primary/35 bg-primary/10 text-primary"
        : "border-border bg-muted text-muted-foreground";

  return <Badge className={colorClass}>{ASSIGNMENT_STATUS_LABELS[status]}</Badge>;
}
