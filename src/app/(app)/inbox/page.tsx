import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listCourses } from "@/lib/repositories/courseRepository";
import { listInboxItems } from "@/lib/repositories/inboxItemRepository";
import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

type InboxPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function inboxNotice(code: string | undefined, assignmentId?: string) {
  switch (code) {
    case "saved":
      return { tone: "success" as const, text: "Inboxに保存しました。" };
    case "parsed":
      return { tone: "success" as const, text: "課題候補を作りました。保存前に内容を確認してください。" };
    case "assignment_saved":
      return {
        actionHref: assignmentId ? `/assignments/${assignmentId}` : undefined,
        actionLabel: assignmentId ? "保存した課題を見る" : undefined,
        tone: "success" as const,
        text: "課題として保存しました。課題一覧に反映済みです。今日やることには締切や優先度が高いものだけ表示されます。"
      };
    case "assignment_saved_partial":
      return {
        actionHref: assignmentId ? `/assignments/${assignmentId}` : undefined,
        actionLabel: assignmentId ? "保存した課題を見る" : undefined,
        tone: "success" as const,
        text: "候補を1件保存しました。未保存の候補はInboxに残っています。"
      };
    case "kept":
      return { tone: "success" as const, text: "メモとして残しました。" };
    case "ignored":
      return { tone: "success" as const, text: "Inbox itemを無視しました。" };
    case "restored":
      return { tone: "success" as const, text: "Inbox itemを戻しました。" };
    case "parse_failed":
      return { tone: "warning" as const, text: "うまく整理できませんでした。入力内容はInboxに残っています。" };
    case "assignment_failed":
      return { tone: "warning" as const, text: "課題化に失敗しましたが、入力内容はInboxに残っています。" };
    case "db_missing":
      return {
        tone: "warning" as const,
        text: "Inbox用のDBテーブルがまだ準備されていません。migration適用後に保存できます。"
      };
    case "not_found":
      return { tone: "danger" as const, text: "対象のInbox itemを見つけられませんでした。" };
    case "candidate_not_found":
      return { tone: "danger" as const, text: "保存する課題候補を見つけられませんでした。もう一度整理してください。" };
    default:
      return null;
  }
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const [courses, items] = await Promise.all([
    listCourses(user.id),
    listInboxItems(user.id)
  ]);

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="課題文や授業メモを一時保存して、あとから課題に変換"
        actions={
          <Link href="/assignments">
            <Button variant="outline">
              <CheckSquare className="h-4 w-4" />
              課題一覧
            </Button>
          </Link>
        }
      />

      <InboxWorkspace courses={courses} items={items} notice={inboxNotice(toSingle(params.inbox), toSingle(params.assignmentId))} />
    </div>
  );
}
