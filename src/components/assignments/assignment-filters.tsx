"use client";

import { ASSIGNMENT_TAG_TEXT, ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPES } from "@/lib/constants/domain";
import type { AssignmentFilter, Course } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type AssignmentFiltersProps = {
  courses: Course[];
  filter: AssignmentFilter;
};

export function AssignmentFilters({ courses, filter }: AssignmentFiltersProps) {
  const hasActiveFilter = Boolean(
    filter.q ||
      (filter.courseId && filter.courseId !== "all") ||
      filter.onlyIncomplete ||
      (filter.assignmentType && filter.assignmentType !== "all") ||
      (filter.tag && filter.tag !== "all") ||
      filter.dueDate ||
      (filter.sortBy && filter.sortBy !== "due")
  );

  return (
    <form className="mb-4 rounded-lg border border-border bg-card shadow-card">
      <details className="group" open={hasActiveFilter || undefined}>
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <span>検索・並び替え</span>
          <span className="text-xs">開く</span>
        </summary>

        <div className="grid gap-3 border-t border-border/60 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_auto_auto] md:items-end">
          <div>
            <Label htmlFor="q">検索</Label>
            <Input id="q" name="q" defaultValue={filter.q ?? ""} placeholder="課題名・授業名" />
          </div>

          <div>
            <Label htmlFor="sortBy">並び替え</Label>
            <Select id="sortBy" name="sortBy" defaultValue={filter.sortBy ?? "due"}>
              <option value="due">締切順</option>
              <option value="priority">優先度順</option>
              <option value="updated">更新順</option>
            </Select>
          </div>

          <Button type="submit">適用</Button>
          <Button type="button" variant="outline" onClick={() => (window.location.search = "") }>
            リセット
          </Button>
        </div>

        <div className="grid gap-3 border-t border-border/60 px-4 pb-4 pt-3 md:grid-cols-5">
          <div>
            <Label htmlFor="courseId">授業</Label>
            <Select id="courseId" name="courseId" defaultValue={filter.courseId ?? "all"}>
              <option value="all">すべて</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="dueDate">締切日</Label>
            <Input id="dueDate" name="dueDate" type="date" defaultValue={filter.dueDate ?? ""} />
          </div>

          <div>
            <Label htmlFor="assignmentType">課題種別</Label>
            <Select id="assignmentType" name="assignmentType" defaultValue={filter.assignmentType ?? "all"}>
              <option value="all">すべて</option>
              {ASSIGNMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSIGNMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="tag">タグ</Label>
            <Select id="tag" name="tag" defaultValue={filter.tag ?? "all"}>
              <option value="all">すべて</option>
              <option value="heavy">{ASSIGNMENT_TAG_TEXT.heavy}</option>
              <option value="quick">{ASSIGNMENT_TAG_TEXT.quick}</option>
            </Select>
          </div>

          <div className="flex items-end">
            <label className="flex min-h-10 w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              <input type="checkbox" name="onlyIncomplete" defaultChecked={filter.onlyIncomplete ?? false} />
              未完了のみ
            </label>
          </div>
        </div>
      </details>
    </form>
  );
}
