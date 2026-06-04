"use client";

import { ArrowDown, ArrowUp, CheckCircle2, Circle, ListChecks, PlusCircle, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addAssignmentStepAction,
  generateAssignmentStepsAction,
  moveAssignmentStepAction,
  toggleAssignmentStepAction
} from "@/lib/actions/assignmentActions";
import type { Assignment, AssignmentStep } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type AssignmentStepPanelProps = {
  assignment: Assignment;
  steps: AssignmentStep[];
};

const estimateOptions = [10, 15, 25, 40, 60];

function stepProgressFromCounts(doneCount: number, totalCount: number) {
  if (totalCount <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round((doneCount / totalCount) * 4) * 25));
}

export function AssignmentStepPanel({ assignment, steps }: AssignmentStepPanelProps) {
  const sourcePath = `/assignments/${assignment.id}`;
  const [optimisticDoneById, setOptimisticDoneById] = useState<Record<string, boolean>>({});

  const resolvedSteps = useMemo(
    () =>
      steps.map((step) => {
        const optimisticDone = optimisticDoneById[step.id];
        if (typeof optimisticDone !== "boolean") {
          return step;
        }
        return {
          ...step,
          status: optimisticDone ? "done" : "todo"
        };
      }),
    [optimisticDoneById, steps]
  );

  const doneCount = resolvedSteps.filter((step) => step.status === "done").length;
  const isAssignmentDone = assignment.status === "done" || assignment.progress >= 100;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">作業チェックリスト</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {steps.length > 0 ? `${doneCount}/${steps.length} 完了` : "未作成"}
          </p>
        </div>
        <form action={generateAssignmentStepsAction}>
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input type="hidden" name="sourcePath" value={sourcePath} />
          <Button disabled={isAssignmentDone} size="sm" type="submit" variant="outline">
            <WandSparkles className="h-4 w-4" />
            テンプレ生成
          </Button>
        </form>
      </div>

      <form action={addAssignmentStepAction} className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_auto]">
        <input type="hidden" name="assignmentId" value={assignment.id} />
        <input type="hidden" name="sourcePath" value={sourcePath} />
        <Input name="title" placeholder="次にやる作業" required disabled={isAssignmentDone} />
        <Select name="estimatedMinutes" defaultValue="25" disabled={isAssignmentDone}>
          {estimateOptions.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes}分
            </option>
          ))}
        </Select>
        <Button disabled={isAssignmentDone} type="submit">
          <PlusCircle className="h-4 w-4" />
          追加
        </Button>
      </form>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
          作業ステップはまだありません。
        </div>
      ) : (
        <div className="space-y-2">
          {resolvedSteps.map((step, index) => {
            const done = step.status === "done";
            const isLegacy = step.id.startsWith("legacy-");
            const reorderDisabled = isAssignmentDone || isLegacy;
            const nextDoneCount = done ? Math.max(0, doneCount - 1) : doneCount + 1;
            const nextProgress = stepProgressFromCounts(nextDoneCount, resolvedSteps.length);

            return (
              <div key={step.id} className="rounded-md border border-border bg-card px-3 py-3">
                <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
                  <form action={toggleAssignmentStepAction}>
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input type="hidden" name="stepId" value={step.id} />
                    <input type="hidden" name="done" value={done ? "0" : "1"} />
                    <input type="hidden" name="sourcePath" value={sourcePath} />
                    <input type="hidden" name="nextProgress" value={nextProgress ?? ""} />
                    <Button
                      aria-label={done ? "未完了に戻す" : "完了にする"}
                      className="h-8 w-8 px-0"
                      disabled={isAssignmentDone}
                      size="sm"
                      type="submit"
                      variant="ghost"
                      onClick={() =>
                        setOptimisticDoneById((current) => ({
                          ...current,
                          [step.id]: !done
                        }))
                      }
                    >
                      {done ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5" />}
                    </Button>
                  </form>

                  <div className="min-w-0">
                    <p className={done ? "text-sm font-medium text-muted-foreground line-through" : "text-sm font-medium"}>
                      {step.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      目安 {step.estimatedMinutes}分
                      {isLegacy ? " · 旧小タスク" : ""}
                    </p>
                    {step.description ? <p className="mt-2 text-xs text-muted-foreground">{step.description}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-1 md:justify-end">
                    {done ? (
                      <form action={toggleAssignmentStepAction}>
                        <input type="hidden" name="assignmentId" value={assignment.id} />
                        <input type="hidden" name="stepId" value={step.id} />
                        <input type="hidden" name="done" value="0" />
                        <input type="hidden" name="sourcePath" value={sourcePath} />
                        <input type="hidden" name="nextProgress" value={nextProgress ?? ""} />
                        <Button
                          disabled={isAssignmentDone}
                          size="sm"
                          type="submit"
                          variant="outline"
                          onClick={() =>
                            setOptimisticDoneById((current) => ({
                              ...current,
                              [step.id]: false
                            }))
                          }
                        >
                          戻す
                        </Button>
                      </form>
                    ) : null}
                    <form action={moveAssignmentStepAction}>
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="stepId" value={step.id} />
                      <input type="hidden" name="direction" value="up" />
                      <input type="hidden" name="sourcePath" value={sourcePath} />
                      <Button
                        aria-label="上に移動"
                        className="h-8 w-8 px-0"
                        disabled={reorderDisabled || index === 0}
                        size="sm"
                        type="submit"
                        variant="outline"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                    </form>
                    <form action={moveAssignmentStepAction}>
                      <input type="hidden" name="assignmentId" value={assignment.id} />
                      <input type="hidden" name="stepId" value={step.id} />
                      <input type="hidden" name="direction" value="down" />
                      <input type="hidden" name="sourcePath" value={sourcePath} />
                      <Button
                        aria-label="下に移動"
                        className="h-8 w-8 px-0"
                        disabled={reorderDisabled || index === resolvedSteps.length - 1}
                        size="sm"
                        type="submit"
                        variant="outline"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
