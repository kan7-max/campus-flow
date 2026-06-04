import Link from "next/link";
import { AlertTriangle, Coins, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { resolveAdminAccess } from "@/lib/adminAccess";
import { listAdminCreditRows } from "@/lib/services/adminOperationsService";
import { updateAdminCreditsAction } from "@/lib/actions/adminActions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeWithSeconds } from "@/lib/utils";

type CreditsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type StatusTone = "success" | "warning" | "danger";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusMessage(status: string | undefined): { tone: StatusTone; text: string } | null {
  switch (status) {
    case "updated":
      return { tone: "success", text: "クレジット設定を更新しました。" };
    case "invalid_input":
      return { tone: "danger", text: "入力値が不正です。対象ユーザー・対象月・理由を確認してください。" };
    case "audit_log_missing":
      return {
        tone: "warning",
        text: "監査ログテーブルが未適用です。安全運用のため、クレジット更新は停止しています。"
      };
    case "balance_table_missing":
      return {
        tone: "warning",
        text: "ai_credit_balances テーブルが未適用です。SQL適用後に再試行してください。"
      };
    case "admin_client_unavailable":
      return { tone: "warning", text: "Supabase管理クライアント未設定のため更新できません。" };
    case "forbidden":
      return { tone: "danger", text: "管理者権限がないため変更できません。" };
    case "unknown_error":
      return { tone: "danger", text: "更新に失敗しました。Vercelログを確認してください。" };
    default:
      return null;
  }
}

function toneClass(tone: StatusTone) {
  if (tone === "success") {
    return "border-success/40 bg-success/10 text-success";
  }
  if (tone === "warning") {
    return "border-warning/40 bg-warning/10 text-warning";
  }
  return "border-danger/40 bg-danger/10 text-danger";
}

function AccessDenied() {
  return (
    <div className="space-y-5">
      <PageHeader title="クレジット管理" description="管理者権限があるアカウントのみ変更できます。" />
      <Card className="border-danger/35 bg-danger/10">
        <div className="flex items-start gap-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-2">
            <p>このアカウントにはクレジット管理権限がありません。</p>
            <Link href="/admin" className="inline-flex">
              <Button variant="outline">運営ダッシュボードへ戻る</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default async function AdminCreditsPage({ searchParams }: CreditsPageProps) {
  const user = await requireUser();
  const access = resolveAdminAccess(user);
  if (!access.isAdmin) {
    return <AccessDenied />;
  }

  const params = await searchParams;
  const query = firstParam(params.q)?.trim() ?? "";
  const status = statusMessage(firstParam(params.status));
  const rows = await listAdminCreditRows({ query, limit: 200 });

  return (
    <div className="space-y-5">
      <PageHeader
        title="クレジット管理（最小）"
        description="β運営向け。変更理由つきでクレジットと月間上限・プランを更新できます。"
        actions={
          <Link href="/admin">
            <Button variant="outline">/admin に戻る</Button>
          </Link>
        }
      />

      {status ? (
        <Card className={toneClass(status.tone)}>
          <p className="text-sm">{status.text}</p>
        </Card>
      ) : null}

      <Card className="border-warning/40 bg-warning/10">
        <p className="text-sm text-warning">
          この画面では秘密値（APIキー実値など）を表示しません。`/admin` 系はサーバー側で管理者判定し、未許可アカウントを遮断します。
        </p>
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex flex-wrap items-end gap-2" action="/admin/credits" method="get">
            <div className="space-y-1">
              <label htmlFor="q" className="text-xs text-muted-foreground">ユーザー検索（email / user_id）</label>
              <Input id="q" name="q" defaultValue={query} className="w-[280px]" />
            </div>
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4" />
              検索
            </Button>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">
          監査ログテーブル（`ai_credit_admin_logs`）未適用時は、更新を拒否します。先に docs のSQL案を適用してください。
        </p>
        <p className="text-xs text-muted-foreground">表示件数: {rows.length} 件（最大 200 件）</p>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">対象ユーザーのクレジット情報がありません。AI利用後に表示されます。</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={`${row.userId}-${row.monthKey}`} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{row.email ?? row.userId}</p>
                {row.isTestUser ? <Badge className="border-warning/40 bg-warning/10 text-warning">テストユーザー</Badge> : null}
                <Badge>{row.monthKey}</Badge>
                <Badge>{row.plan.toUpperCase()}</Badge>
              </div>

              <div className="grid gap-2 text-sm sm:grid-cols-4">
                <p>残り: <span className="font-semibold">{row.creditsRemaining}</span></p>
                <p>使用: <span className="font-semibold">{row.creditsUsed}</span></p>
                <p>上限: <span className="font-semibold">{row.monthlyLimit}</span></p>
                <p>更新: <span className="font-semibold">{formatDateTimeWithSeconds(row.updatedAt)}</span></p>
              </div>

              <form action={updateAdminCreditsAction} className="grid gap-2 md:grid-cols-4">
                <input type="hidden" name="targetUserId" value={row.userId} />
                <input type="hidden" name="monthKey" value={row.monthKey} />
                <input type="hidden" name="returnTo" value="/admin/credits" />

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`plan-${row.userId}-${row.monthKey}`}>プラン</label>
                  <Select id={`plan-${row.userId}-${row.monthKey}`} name="plan" defaultValue={row.plan}>
                    <option value="free">free</option>
                    <option value="plus">plus</option>
                    <option value="pro">pro</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`limit-${row.userId}-${row.monthKey}`}>月間上限</label>
                  <Input id={`limit-${row.userId}-${row.monthKey}`} name="monthlyLimit" type="number" min={0} defaultValue={row.monthlyLimit} />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor={`delta-${row.userId}-${row.monthKey}`}>残量調整 (+/-)</label>
                  <Input id={`delta-${row.userId}-${row.monthKey}`} name="remainingDelta" type="number" defaultValue={0} />
                </div>

                <div className="space-y-1 md:col-span-4">
                  <label className="text-xs text-muted-foreground" htmlFor={`reason-${row.userId}-${row.monthKey}`}>変更理由（必須）</label>
                  <Input id={`reason-${row.userId}-${row.monthKey}`} name="reason" required placeholder="例: βテスト補填 / 運営テスト / 問い合わせ対応" />
                </div>

                <div className="md:col-span-4">
                  <Button type="submit">保存（監査ログ必須）</Button>
                </div>
              </form>
            </Card>
          ))}
        </div>
      )}

      <Card className="space-y-2">
        <h3 className="text-base font-semibold">監査ログ用SQL（未適用なら必要）</h3>
        <p className="text-sm text-muted-foreground">
          本番Supabaseへは自動適用しません。SQL Editor で手動適用してください。
        </p>
        <Link
          href="https://github.com/kan7-max/New-project/blob/main/docs/admin-operations-runbook.md"
          target="_blank"
          rel="noreferrer"
          className="inline-flex"
        >
          <Button variant="outline">SQL案を確認</Button>
        </Link>
      </Card>
    </div>
  );
}
