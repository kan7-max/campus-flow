import { Badge } from "@/components/ui/badge";
import type { PriorityLabel } from "@/lib/types/domain";
import { PRIORITY_TEXT } from "@/lib/constants/domain";

export function PriorityBadge({ label, score }: { label: PriorityLabel; score?: number }) {
  const colorClass =
    label === "high"
      ? "border-danger/35 bg-danger/10 text-danger"
      : label === "medium"
        ? "border-warning/35 bg-warning/10 text-warning"
        : "border-success/35 bg-success/10 text-success";

  return (
    <Badge className={colorClass}>
      優先度 {PRIORITY_TEXT[label]}
      {typeof score === "number" ? ` (${score})` : ""}
    </Badge>
  );
}
