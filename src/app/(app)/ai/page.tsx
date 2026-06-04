import { Coins } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getOrCreateAiCreditBalance } from "@/lib/repositories/aiCreditRepository";
import { AiWorkspace } from "@/components/ai/ai-workspace";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function AiPage() {
  const user = await requireUser();
  let balance = null;

  try {
    balance = await getOrCreateAiCreditBalance(user.id);
  } catch (error) {
    console.error("Failed to load AI credit balance", error);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="AIチャット入力"
        description="最優先入力導線。抽出プレビューで確認・修正してから保存"
      />

      <Card className="rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold">AI credits</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {balance
                  ? `${balance.monthKey} / ${balance.plan.toUpperCase()}`
                  : "AI credit DB未適用時は、利用ログだけ記録します。"}
              </p>
            </div>
          </div>
          {balance ? (
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-tight">{balance.creditsRemaining}</p>
              <p className="text-xs text-muted-foreground">残り / {balance.monthlyLimit} credits</p>
            </div>
          ) : null}
        </div>
      </Card>

      <AiWorkspace />
    </div>
  );
}
