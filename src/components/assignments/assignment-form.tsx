"use client";

import { useMemo } from "react";
import { ASSIGNMENT_TAG_TEXT, ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPES, PROGRESS_VALUES } from "@/lib/constants/domain";
import type { Assignment, Course } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type AssignmentFormProps = {
  assignment?: Assignment | null;
  courses: Course[];
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
};

export function AssignmentForm({ assignment, courses, action, submitLabel }: AssignmentFormProps) {
  const assignmentDueAt = assignment?.dueAt;
  const dueDefault = useMemo(() => {
    if (!assignmentDueAt) {
      return "";
    }

    const date = new Date(assignmentDueAt);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }, [assignmentDueAt]);

  return (
    <form action={action} className="space-y-6 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      {assignment?.id ? <input type="hidden" name="id" value={assignment.id} /> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="title">課題名</Label>
          <Input id="title" name="title" defaultValue={assignment?.title ?? ""} required />
        </div>

        <div>
          <Label htmlFor="courseId">授業</Label>
          <Select id="courseId" name="courseId" defaultValue={assignment?.courseId ?? ""}>
            <option value="">未設定</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="assignmentType">課題タイプ</Label>
          <Select id="assignmentType" name="assignmentType" defaultValue={assignment?.assignmentType ?? "report"}>
            {ASSIGNMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {ASSIGNMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="dueAt">締切日時</Label>
          <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={dueDefault} required />
        </div>

        <div>
          <Label htmlFor="submissionTarget">提出先</Label>
          <Input id="submissionTarget" name="submissionTarget" defaultValue={assignment?.submissionTarget ?? ""} />
        </div>

        <div>
          <Label htmlFor="estimatedHours">推定所要時間 (h)</Label>
          <Input
            id="estimatedHours"
            name="estimatedHours"
            type="number"
            min={1}
            max={24}
            defaultValue={assignment?.estimatedHours ?? 2}
          />
        </div>

        <div>
          <Label htmlFor="progress">進捗率</Label>
          <Select id="progress" name="progress" defaultValue={String(assignment?.progress ?? 0)}>
            {PROGRESS_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}%
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="status">ステータス</Label>
          <Select id="status" name="status" defaultValue={assignment?.status ?? "todo"}>
            <option value="todo">未着手</option>
            <option value="in_progress">進行中</option>
            <option value="done">完了</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="url">関連URL</Label>
          <Input id="url" name="url" type="url" defaultValue={assignment?.url ?? ""} placeholder="https://" />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="memo">メモ</Label>
          <Textarea id="memo" name="memo" defaultValue={assignment?.memo ?? ""} placeholder="課題条件、注意点など" />
        </div>

        <div>
          <Label htmlFor="suggestedSubtasks">小タスク (1行1タスク)</Label>
          <Textarea
            id="suggestedSubtasks"
            name="suggestedSubtasks"
            defaultValue={assignment?.subtasks?.map((task) => task.title).join("\n") ?? ""}
            placeholder="要件確認\nドラフト作成\n提出前チェック"
            className="min-h-[96px]"
          />
        </div>

        <div>
          <Label htmlFor="attachment">添付ファイル (任意)</Label>
          <Input id="attachment" name="attachment" type="file" />
          <p className="mt-1 text-xs text-muted-foreground">
            TODO: Supabase Storageへの保存実装は `/src/lib/services/attachmentService.ts` で差し替え可能な構造にする予定。
          </p>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-muted p-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="isHeavy" defaultChecked={assignment?.isHeavy ?? false} />
          {ASSIGNMENT_TAG_TEXT.heavy}として扱う
        </label>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="tagQuick" defaultChecked={assignment?.tags?.includes("quick") ?? false} />
          {ASSIGNMENT_TAG_TEXT.quick}タグ
        </label>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
