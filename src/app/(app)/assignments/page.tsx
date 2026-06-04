import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { listCourses } from "@/lib/repositories/courseRepository";
import { restoreDeletedAssignmentAction } from "@/lib/actions/assignmentActions";
import type { AssignmentFilter } from "@/lib/types/domain";
import { AssignmentFilters } from "@/components/assignments/assignment-filters";
import { AssignmentList } from "@/components/assignments/assignment-list";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type AssignmentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(params: Record<string, string | string[] | undefined>): AssignmentFilter {
  return {
    q: toSingle(params.q) || undefined,
    courseId: toSingle(params.courseId) || undefined,
    onlyIncomplete: toSingle(params.onlyIncomplete) === "on",
    assignmentType: (toSingle(params.assignmentType) as AssignmentFilter["assignmentType"]) || "all",
    tag: (toSingle(params.tag) as AssignmentFilter["tag"]) || "all",
    dueDate: toSingle(params.dueDate) || undefined,
    sortBy: (toSingle(params.sortBy) as AssignmentFilter["sortBy"]) || "due"
  };
}

function assignmentNotice(params: Record<string, string | string[] | undefined>) {
  const deletedId = toSingle(params.deleted);
  if (deletedId) {
    return {
      tone: "success" as const,
      text: "課題を削除しました。",
      deletedId
    };
  }

  if (toSingle(params.restore) === "not_found") {
    return {
      tone: "warning" as const,
      text: "復元する課題を見つけられませんでした。",
      deletedId: null
    };
  }

  return null;
}

export default async function AssignmentsPage({ searchParams }: AssignmentsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = parseFilter(params);
  const notice = assignmentNotice(params);
  let loadFailed = false;
  let courses = [] as Awaited<ReturnType<typeof listCourses>>;
  let assignments = [] as Awaited<ReturnType<typeof listAssignments>>;

  try {
    [courses, assignments] = await Promise.all([
      listCourses(user.id),
      listAssignments(user.id, filter)
    ]);
  } catch (error) {
    loadFailed = true;
    console.error("Failed to load assignments page data", error);
  }

  return (
    <div>
      <PageHeader
        title="課題一覧"
        description="検索・ソート・フィルタで課題を高速に整理"
        actions={
          <Link href="/assignments/new">
            <Button>新規課題</Button>
          </Link>
        }
      />

      <AssignmentFilters courses={courses} filter={filter} />

      {loadFailed ? (
        <div className="mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          課題一覧の読み込みに失敗しました。しばらく待って再読み込みしてください。
        </div>
      ) : null}

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/35 bg-success/10 px-4 py-3 text-sm text-success"
              : "mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning"
          }
        >
          <span>{notice.text}</span>
          {notice.deletedId ? (
            <form action={restoreDeletedAssignmentAction}>
              <input type="hidden" name="id" value={notice.deletedId} />
              <Button size="sm" type="submit" variant="outline">
                取り消す
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      {assignments.length === 0 ? (
        <EmptyState
          title="最初の課題を登録してみましょう"
          description="課題文をそのまま貼るだけでもOKです。Inboxに残してから、あとで締切やチェックリストを整えられます。"
          actions={
            <>
              <Link href="/inbox">
                <Button>課題文を貼る</Button>
              </Link>
              <Link href="/assignments/new">
                <Button variant="outline">手入力で作成</Button>
              </Link>
            </>
          }
        />
      ) : (
        <AssignmentList assignments={assignments} />
      )}
    </div>
  );
}
