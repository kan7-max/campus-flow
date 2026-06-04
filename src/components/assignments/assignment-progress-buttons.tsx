"use client";

import { useState, useTransition } from "react";
import { setAssignmentProgressAction } from "@/lib/actions/assignmentActions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AssignmentProgressButtonsProps = {
  assignmentId: string;
  progress: number;
};

const progressOptions = [0, 25, 50, 75, 100] as const;

export function AssignmentProgressButtons({ assignmentId, progress }: AssignmentProgressButtonsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingProgress, setPendingProgress] = useState<number | null>(null);
  const displayProgress = pendingProgress ?? progress;

  const runProgressUpdate = (nextProgress: number) => {
    setError(null);
    setPendingProgress(nextProgress);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("id", assignmentId);
        formData.set("progress", String(nextProgress));
        await setAssignmentProgressAction(formData);
      } catch (actionError) {
        console.error("Progress update failed", actionError);
        setError("進捗の更新に失敗しました。時間をおいて再試行してください。");
      } finally {
        setPendingProgress(null);
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {progressOptions.map((value) => (
          <Button
            key={value}
            type="button"
            disabled={isPending}
            variant={displayProgress === value ? "default" : "outline"}
            className={cn("min-w-14")}
            onClick={() => runProgressUpdate(value)}
          >
            {value}%
          </Button>
        ))}
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
