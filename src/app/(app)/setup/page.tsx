import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getUserSettings } from "@/lib/repositories/settingsRepository";
import { InitialSetupForm } from "@/components/setup/initial-setup-form";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

type SetupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function setupNotice(code: string | undefined) {
  switch (code) {
    case "db_missing":
      return {
        className: "border-warning/35 bg-warning/10 text-warning",
        text: "本番DBの一部項目が未適用の可能性があります。現在は互換保存に対応したので、もう一度保存を試してください。"
      };
    case "failed":
      return {
        className: "border-danger/35 bg-danger/10 text-danger",
        text: "セットアップを保存できませんでした。入力内容を確認してもう一度試してください。"
      };
    default:
      return null;
  }
}

export default async function SetupPage({ searchParams }: SetupPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getUserSettings(user.id);
  const notice = setupNotice(toSingle(params.setup));

  return (
    <div className="space-y-5">
      <PageHeader
        title="初回セットアップ"
        description="今日の作業時間・通知・AI整理の使い方を最初に決める"
        actions={
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        }
      />

      {notice ? <div className={`rounded-lg border px-4 py-3 text-sm ${notice.className}`}>{notice.text}</div> : null}

      <InitialSetupForm settings={settings} />
    </div>
  );
}
