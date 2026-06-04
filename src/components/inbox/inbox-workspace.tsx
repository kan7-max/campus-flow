import Link from "next/link";
import { Archive, ArrowRight, CheckCircle2, ClipboardPaste, Inbox, RotateCcw, Sparkles } from "lucide-react";
import { ASSIGNMENT_TYPE_LABELS, ASSIGNMENT_TYPES } from "@/lib/constants/domain";
import {
  ignoreInboxItemAction,
  keepInboxItemAsMemoAction,
  parseExistingInboxItemAction,
  restoreInboxItemAction,
  saveAndParseInboxTextAction,
  saveInboxItemAsAssignmentAction,
  saveInboxTextAction
} from "@/lib/actions/inboxActions";
import type {
  Course,
  InboxAssignmentCandidate,
  InboxAssignmentCandidateOption,
  InboxItem,
  InboxSourceType,
  InboxStatus
} from "@/lib/types/domain";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type InboxWorkspaceProps = {
  courses: Course[];
  items: InboxItem[];
  notice: {
    actionHref?: string;
    actionLabel?: string;
    text: string;
    tone: "danger" | "success" | "warning";
  } | null;
};

const sourceLabels: Record<InboxSourceType, string> = {
  manual_text: "手入力",
  webclass_text: "WebClass",
  screenshot: "スクショ",
  pdf: "PDF",
  file: "ファイル",
  ai_input: "AI入力"
};

const statusLabels: Record<InboxStatus, string> = {
  unprocessed: "未整理",
  parsed: "候補あり",
  saved: "課題化済み",
  ignored: "無視",
  failed: "要確認"
};

const statusClassNames: Record<InboxStatus, string> = {
  unprocessed: "border-border bg-muted text-muted-foreground",
  parsed: "border-primary/35 bg-primary/10 text-primary",
  saved: "border-success/35 bg-success/10 text-success",
  ignored: "border-border bg-muted text-muted-foreground",
  failed: "border-warning/35 bg-warning/10 text-warning"
};

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getCourseDefault(candidate: InboxAssignmentCandidateOption | null, courses: Course[]) {
  if (!candidate?.courseName) {
    return "";
  }

  const normalized = candidate.courseName.toLowerCase();
  return courses.find((course) => course.name.toLowerCase().includes(normalized))?.id ?? "";
}

function StatusBadge({ status }: { status: InboxStatus }) {
  return <Badge className={statusClassNames[status]}>{statusLabels[status]}</Badge>;
}

function Notice({
  notice
}: {
  notice: {
    actionHref?: string;
    actionLabel?: string;
    text: string;
    tone: "danger" | "success" | "warning";
  };
}) {
  const className = {
    danger: "border-danger/35 bg-danger/10 text-danger",
    success: "border-success/35 bg-success/10 text-success",
    warning: "border-warning/35 bg-warning/10 text-warning"
  }[notice.tone];

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{notice.text}</p>
        {notice.actionHref && notice.actionLabel ? (
          <Link href={notice.actionHref} className="shrink-0">
            <Button size="sm" variant="outline" className="w-full bg-card sm:w-auto">
              {notice.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function SourceSelect({ defaultValue = "manual_text" }: { defaultValue?: InboxSourceType }) {
  return (
    <Select id="sourceType" name="sourceType" defaultValue={defaultValue}>
      {Object.entries(sourceLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}

function NewInboxForm() {
  return (
    <Card className="rounded-lg">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardPaste className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-base font-semibold">課題文・授業メモ</h2>
          <p className="mt-1 text-xs text-muted-foreground">まずInboxに残して、あとから課題にします。</p>
        </div>
      </div>

      <form action={saveInboxTextAction} className="space-y-4">
        <div>
          <Label htmlFor="rawText">貼り付け内容</Label>
          <Textarea
            id="rawText"
            name="rawText"
            required
            className="min-h-[180px]"
            placeholder="物理実験レポート 来週月曜まで グラフと考察必要"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-end">
          <div>
            <Label htmlFor="sourceType">種別</Label>
            <SourceSelect />
          </div>
          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <Archive className="h-4 w-4" />
              メモとして保存
            </Button>
            <button
              type="submit"
              formAction={saveAndParseInboxTextAction}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:w-auto"
            >
              <Sparkles className="h-4 w-4" />
              課題候補に整理
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function getInboxCandidates(candidate: InboxAssignmentCandidate | null): InboxAssignmentCandidateOption[] {
  if (!candidate) {
    return [];
  }

  return [candidate, ...(candidate.alternativeCandidates ?? [])];
}

function countSavedCandidates(
  savedCandidateAssignmentIds: InboxAssignmentCandidate["savedCandidateAssignmentIds"] | undefined,
  candidateTotal: number
) {
  return Array.from({ length: candidateTotal }, (_, index) => savedCandidateAssignmentIds?.[index]).filter(Boolean).length;
}

function formatCandidateDue(value: string | null) {
  if (!value) {
    return "締切未設定";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "締切要確認";
  }

  return formatDateTime(date);
}

function CandidateSummary({
  candidate,
  candidateIndex,
  candidateTotal,
  tone
}: {
  candidate: InboxAssignmentCandidateOption;
  candidateIndex: number;
  candidateTotal: number;
  tone: "primary" | "success";
}) {
  const toneClassName =
    tone === "success"
      ? "border-success/35 bg-success/10 text-success"
      : "border-primary/35 bg-primary/10 text-primary";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={cn("text-xs font-medium", tone === "success" ? "text-success" : "text-primary")}>
          課題候補 {candidateTotal > 1 ? `${candidateIndex + 1}/${candidateTotal}` : ""}
        </p>
        <h3 className="mt-1 truncate text-base font-semibold text-foreground">{candidate.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {candidate.courseName ?? "授業未設定"} / {formatCandidateDue(candidate.dueAt)}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Badge className={toneClassName}>{ASSIGNMENT_TYPE_LABELS[candidate.assignmentType]}</Badge>
        <Badge className="border-border bg-muted text-muted-foreground">信頼度 {Math.round(candidate.confidence * 100)}%</Badge>
        {candidate.warnings.length > 0 ? (
          <Badge className="border-warning/35 bg-warning/10 text-warning">要確認</Badge>
        ) : null}
      </div>
    </div>
  );
}

function CandidateWarnings({ candidate }: { candidate: InboxAssignmentCandidateOption }) {
  if (candidate.warnings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
      {candidate.warnings.join(" / ")}
    </div>
  );
}

function CandidateForm({
  candidate,
  candidateIndex,
  candidateTotal,
  courses,
  defaultOpen,
  item
}: {
  candidate: InboxAssignmentCandidateOption;
  candidateIndex: number;
  candidateTotal: number;
  courses: Course[];
  defaultOpen: boolean;
  item: InboxItem;
}) {
  const courseDefault = getCourseDefault(candidate, courses);
  const subtasksDefault = candidate.suggestedSubtasks.join("\n");
  const formKey = `${item.id}-${candidateIndex}`;

  return (
    <details open={defaultOpen} className="mt-4 rounded-lg border border-primary/30 bg-primary/10">
      <summary className="cursor-pointer list-none p-4 transition hover:bg-primary/5">
        <CandidateSummary candidate={candidate} candidateIndex={candidateIndex} candidateTotal={candidateTotal} tone="primary" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge className="border-primary/35 bg-primary/10 text-primary">未保存</Badge>
          <p className="text-xs text-muted-foreground">保存前に締切と授業だけ確認してください。</p>
        </div>
      </summary>

      <form action={saveInboxItemAsAssignmentAction} className="space-y-3 border-t border-primary/20 p-4 pt-3">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="candidateIndex" value={candidateIndex} />
        <CandidateWarnings candidate={candidate} />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor={`title-${formKey}`}>課題名</Label>
            <Input id={`title-${formKey}`} name="title" defaultValue={candidate.title} required />
          </div>

          <div>
            <Label htmlFor={`course-${formKey}`}>授業</Label>
            <Select id={`course-${formKey}`} name="courseId" defaultValue={courseDefault}>
              <option value="">未設定</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </Select>
            {candidate.courseName ? (
              <p className="mt-1 text-xs text-muted-foreground">読み取り: {candidate.courseName}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor={`type-${formKey}`}>課題タイプ</Label>
            <Select id={`type-${formKey}`} name="assignmentType" defaultValue={candidate.assignmentType}>
              {ASSIGNMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ASSIGNMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`due-${formKey}`}>締切日時</Label>
            <Input id={`due-${formKey}`} name="dueAt" type="datetime-local" defaultValue={toDateTimeLocal(candidate.dueAt)} required />
          </div>

          <div>
            <Label htmlFor={`target-${formKey}`}>提出先</Label>
            <Input id={`target-${formKey}`} name="submissionTarget" defaultValue={candidate.submissionTarget ?? ""} />
          </div>

          <div>
            <Label htmlFor={`hours-${formKey}`}>推定所要時間 (h)</Label>
            <Input
              id={`hours-${formKey}`}
              name="estimatedHours"
              type="number"
              min={1}
              max={24}
              defaultValue={candidate.estimatedHours}
            />
          </div>

          <div className="flex flex-wrap items-end gap-4 rounded-md border border-border bg-muted px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isHeavy" defaultChecked={candidate.isHeavy} className="h-4 w-4 accent-primary" />
              重い課題
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tagQuick"
                defaultChecked={candidate.tags.includes("quick")}
                className="h-4 w-4 accent-primary"
              />
              すぐ終わる
            </label>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor={`memo-${formKey}`}>メモ</Label>
            <Textarea id={`memo-${formKey}`} name="memo" defaultValue={candidate.memo ?? item.rawText} className="min-h-[96px]" />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor={`subtasks-${formKey}`}>作業チェックリスト候補</Label>
            <Textarea
              id={`subtasks-${formKey}`}
              name="suggestedSubtasks"
              defaultValue={subtasksDefault}
              className="min-h-[92px]"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button type="submit" className="w-full sm:w-auto">
            <CheckCircle2 className="h-4 w-4" />
            候補{candidateTotal > 1 ? candidateIndex + 1 : ""}を保存
          </Button>
        </div>
      </form>
    </details>
  );
}

function SavedCandidate({
  assignmentId,
  candidate,
  candidateIndex,
  candidateTotal
}: {
  assignmentId: string;
  candidate: InboxAssignmentCandidateOption;
  candidateIndex: number;
  candidateTotal: number;
}) {
  return (
    <div className="mt-4 rounded-lg border border-success/35 bg-success/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CandidateSummary candidate={candidate} candidateIndex={candidateIndex} candidateTotal={candidateTotal} tone="success" />
          <Badge className="mt-2 border-success/35 bg-success/10 text-success">課題化済み</Badge>
        </div>
        <Link href={`/assignments/${assignmentId}`} className="w-full sm:w-auto">
          <Button size="sm" variant="outline" className="w-full sm:w-auto">
            課題詳細
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function InboxItemCard({ courses, item }: { courses: Course[]; item: InboxItem }) {
  const isResolved = item.status === "saved" || item.status === "ignored";
  const candidates = getInboxCandidates(item.parsedPayload);
  const savedCandidateAssignmentIds = item.parsedPayload?.savedCandidateAssignmentIds ?? {};
  const candidateTotal = candidates.length;
  const savedCandidateCount = countSavedCandidates(savedCandidateAssignmentIds, candidateTotal);
  const unsavedCandidateCount = Math.max(0, candidateTotal - savedCandidateCount);
  const firstUnsavedCandidateIndex = candidates.findIndex((_, index) => !savedCandidateAssignmentIds[index]);

  return (
    <Card className={cn("rounded-lg", isResolved && "bg-muted")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <Badge className="border-border/60 bg-muted text-muted-foreground">{sourceLabels[item.sourceType]}</Badge>
            {candidateTotal > 1 ? (
              <Badge className="border-primary/35 bg-primary/10 text-primary">候補 {candidateTotal}件</Badge>
            ) : null}
            {savedCandidateCount > 0 ? (
              <Badge className="border-success/35 bg-success/10 text-success">保存済み {savedCandidateCount}/{candidateTotal}</Badge>
            ) : null}
            {unsavedCandidateCount > 0 && savedCandidateCount > 0 ? (
              <Badge className="border-warning/35 bg-warning/10 text-warning">未保存 {unsavedCandidateCount}件</Badge>
            ) : null}
            <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
          </div>
          <p className="line-clamp-2 text-sm text-muted-foreground">{item.rawText}</p>
        </div>

        {item.createdAssignmentId ? (
          <Link href={`/assignments/${item.createdAssignmentId}`} className="w-full sm:w-auto">
            <Button size="sm" variant="outline" className="w-full sm:w-auto">
              課題詳細
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        ) : null}

        {item.status === "ignored" ? (
          <form action={restoreInboxItemAction} className="w-full sm:w-auto">
            <input type="hidden" name="itemId" value={item.id} />
            <Button size="sm" variant="outline" className="w-full sm:w-auto">
              <RotateCcw className="h-4 w-4" />
              戻す
            </Button>
          </form>
        ) : null}
      </div>

      {item.errorMessage ? (
        <div className="mt-3 rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-sm text-warning">
          {item.errorMessage}
        </div>
      ) : null}

      {isResolved ? (
        <details className="mt-3 rounded-md border border-border bg-card px-3 py-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
            元メモを確認
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.rawText}</p>
        </details>
      ) : null}

      {candidateTotal > 0 ? (
        <div className="space-y-3">
          {candidates.map((candidate, index) => {
            const savedAssignmentId = savedCandidateAssignmentIds[index];
            if (savedAssignmentId) {
              return (
                <SavedCandidate
                  key={`${item.id}-${index}-saved`}
                  assignmentId={savedAssignmentId}
                  candidate={candidate}
                  candidateIndex={index}
                  candidateTotal={candidateTotal}
                />
              );
            }

            if (isResolved) {
              return null;
            }

            return (
              <CandidateForm
                key={`${item.id}-${index}`}
                candidate={candidate}
                candidateIndex={index}
                candidateTotal={candidateTotal}
                courses={courses}
                defaultOpen={candidateTotal === 1 || index === firstUnsavedCandidateIndex}
                item={item}
              />
            );
          })}
        </div>
      ) : null}

      {!isResolved ? (
        <div className="mt-4 grid gap-3">
          <form action={parseExistingInboxItemAction} className="space-y-3">
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="sourceType" value={item.sourceType} />
            <div>
              <Label htmlFor={`raw-${item.id}`}>元メモ</Label>
              <Textarea id={`raw-${item.id}`} name="rawText" defaultValue={item.rawText} className="min-h-[112px]" />
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                整理し直す
              </Button>
            </div>
          </form>

          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            {item.parsedPayload ? (
              <form action={keepInboxItemAsMemoAction} className="w-full sm:w-auto">
                <input type="hidden" name="itemId" value={item.id} />
                <Button type="submit" variant="outline" className="w-full sm:w-auto">
                  <Archive className="h-4 w-4" />
                  メモとして残す
                </Button>
              </form>
            ) : null}

            <form action={ignoreInboxItemAction} className="w-full sm:w-auto">
              <input type="hidden" name="itemId" value={item.id} />
              <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                無視
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function InboxSection({ courses, items, title }: { courses: Course[]; items: InboxItem[]; title: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Inbox className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <InboxItemCard key={item.id} courses={courses} item={item} />
        ))}
      </div>
    </section>
  );
}

export function InboxWorkspace({ courses, items, notice }: InboxWorkspaceProps) {
  const openItems = items.filter((item) => item.status !== "saved" && item.status !== "ignored");
  const resolvedItems = items.filter((item) => item.status === "saved" || item.status === "ignored");

  return (
    <div className="space-y-5">
      {notice ? <Notice notice={notice} /> : null}

      <NewInboxForm />

      {items.length === 0 ? (
        <EmptyState
          title="まだ未整理のメモはありません"
          description="課題文や授業メモを貼ると、あとから課題として保存できます。例: 物理レポート 来週月曜まで グラフと考察必要"
        />
      ) : (
        <>
          <InboxSection title="未整理のメモ" courses={courses} items={openItems} />
          <InboxSection title="処理済み" courses={courses} items={resolvedItems} />
        </>
      )}
    </div>
  );
}
