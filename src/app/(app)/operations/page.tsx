import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { resolveAdminAccess } from "@/lib/adminAccess";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function OperationsPage() {
  const user = await requireUser();
  const access = resolveAdminAccess(user);

  if (!access.isAdmin) {
    return (
      <div className="space-y-5">
        <PageHeader title="運営ページ" description="管理者権限があるアカウントのみ閲覧できます。" />
        <Card className="border-danger/35 bg-danger/10 text-sm text-danger">
          管理者権限がありません。`ADMIN_EMAILS` にこのアカウントを追加してください。
        </Card>
      </div>
    );
  }

  const restrictionDisabled = access.configuredEmails.length === 0 && access.isDemoUser;

  return (
    <div className="space-y-5">
      <PageHeader
        title="運営ページ"
        description="指標の見方・確認頻度・障害時の確認手順を運営向けに整理"
      />

      {restrictionDisabled ? (
        <Card className="border-warning/40 bg-warning/10">
          <div className="flex items-start gap-3 text-sm text-warning">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              この環境は demo-user として閲覧中です。`ADMIN_EMAILS` が未設定の場合でも demo-user のみ運営画面に入れます。
            </p>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h3 className="text-base font-semibold">最初から毎日見る指標</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>登録ユーザー数 / ログインユーザー数 / アクティブユーザー数</li>
          <li>AI抽出回数 / 成功率 / 失敗率</li>
          <li>課題保存数（手動/AI起点の内訳）</li>
          <li>`/today` 利用状況</li>
          <li>Google Calendar同期失敗数</li>
          <li>エラー件数 / 問い合わせ件数</li>
        </ul>
      </Card>

      <Card className="space-y-3">
        <h3 className="text-base font-semibold">運営ドキュメント</h3>
        <div className="flex flex-wrap gap-2">
          <Link href="https://github.com/kan7-max/New-project/blob/main/docs/operations-metrics-policy.md" target="_blank" rel="noreferrer">
            <Button variant="outline">
              Metrics Policy
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="https://github.com/kan7-max/New-project/blob/main/docs/operations-runbook.md" target="_blank" rel="noreferrer">
            <Button variant="outline">
              Operations Runbook
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          このページは確認導線のみです。管理画面や課金処理などの運営機能は実装していません。
        </p>
      </Card>
    </div>
  );
}
