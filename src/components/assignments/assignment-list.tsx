"use client";

import { useMemo } from "react";
import type { Assignment } from "@/lib/types/domain";
import { AssignmentMinimalCard } from "@/components/assignments/assignment-minimal-card";

type AssignmentListProps = {
  assignments: Assignment[];
};

export function AssignmentList({ assignments }: AssignmentListProps) {
  const sorted = useMemo(
    () => [...assignments].sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [assignments]
  );

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {sorted.map((assignment) => (
        <AssignmentMinimalCard key={assignment.id} assignment={assignment} />
      ))}
    </div>
  );
}
