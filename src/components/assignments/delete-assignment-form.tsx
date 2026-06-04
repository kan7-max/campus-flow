"use client";

import { useMemo, useState } from "react";
import { deleteAssignmentAction } from "@/lib/actions/assignmentActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeleteAssignmentFormProps = {
  assignmentId: string;
  assignmentTitle: string;
};

export function DeleteAssignmentForm({ assignmentId, assignmentTitle }: DeleteAssignmentFormProps) {
  const [confirmation, setConfirmation] = useState("");
  const canSubmit = confirmation.trim() === "削除";
  const confirmMessage = useMemo(
    () => `課題「${assignmentTitle}」を削除します。Googleカレンダーイベントも削除同期を試みます。続行しますか？`,
    [assignmentTitle]
  );

  return (
    <form
      action={deleteAssignmentAction}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        if (!canSubmit || !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={assignmentId} />
      <Input
        aria-label="削除確認"
        className="h-10 w-24"
        onChange={(event) => setConfirmation(event.target.value)}
        placeholder="削除"
        value={confirmation}
      />
      <Button disabled={!canSubmit} type="submit" variant="danger">
        削除
      </Button>
    </form>
  );
}
