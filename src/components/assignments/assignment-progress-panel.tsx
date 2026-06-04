"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { setAssignmentProgressAction } from "@/lib/actions/assignmentActions";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/constants/domain";
import type { AssignmentStatus } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type AssignmentProgressPanelProps = {
  assignmentId: string;
  initialProgress: number;
  initialStatus: AssignmentStatus;
};

const progressOptions = [0, 25, 50, 75, 100] as const;
const progressOptimisticEventName = "taskflow:assignment-progress-optimistic";

function toStatus(progress: number): AssignmentStatus {
  if (progress >= 100) return "done";
  if (progress <= 0) return "todo";
  return "in_progress";
}

export function AssignmentProgressPanel({
  assignmentId,
  initialProgress,
  initialStatus
}: AssignmentProgressPanelProps) {
  const pathname = usePathname();
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState<AssignmentStatus>(initialStatus);

  useEffect(() => {
    function handleOptimisticProgress(event: Event) {
      const detail = (event as CustomEvent<{ assignmentId: string; progress: number }>).detail;
      if (!detail || detail.assignmentId !== assignmentId) {
        return;
      }

      setProgress(detail.progress);
      setStatus(toStatus(detail.progress));
    }

    window.addEventListener(progressOptimisticEventName, handleOptimisticProgress);
    return () => window.removeEventListener(progressOptimisticEventName, handleOptimisticProgress);
  }, [assignmentId]);

  const applyLocalProgress = (nextProgress: number) => {
    setProgress(nextProgress);
    setStatus(toStatus(nextProgress));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/60 p-3">
        <p className="text-xs font-medium text-muted-foreground">進捗</p>
        <div className="mt-2">
          <Progress value={progress} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {progress}% / {ASSIGNMENT_STATUS_LABELS[status]}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {progressOptions.map((value) => (
          <form
            key={value}
            action={setAssignmentProgressAction}
          >
            <input type="hidden" name="id" value={assignmentId} />
            <input type="hidden" name="progress" value={String(value)} />
            <input type="hidden" name="sourcePath" value={pathname} />
            <Button
              type="submit"
              size="sm"
              variant={progress === value ? "default" : "outline"}
              className="min-w-14"
              onClick={() => applyLocalProgress(value)}
            >
              {value}%
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
