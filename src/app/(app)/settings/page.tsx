import { requireUser } from "@/lib/auth";
import Link from "next/link";
import { BellRing, CalendarCheck2, Coins, RefreshCw, Settings2, Unlink } from "lucide-react";
import { resolveAdminAccess } from "@/lib/adminAccess";
import { isGoogleCalendarOAuthEnabled } from "@/lib/env";
import { getOrCreateAiCreditBalance } from "@/lib/repositories/aiCreditRepository";
import { listRecentNotifications } from "@/lib/repositories/notificationRepository";
import { getUserSettings } from "@/lib/repositories/settingsRepository";
import { listRecentSyncOutboxJobs } from "@/lib/repositories/syncOutboxRepository";
import {
  disconnectGoogleCalendarAction,
  saveGoogleCalendarTokenAction,
  syncIncompleteAssignmentsToCalendarAction,
  updateSettingsAction
} from "@/lib/actions/settingsActions";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PushSubscribeButton } from "@/components/settings/push-subscribe-button";
import { PwaInstallPanel } from "@/components/settings/pwa-install-panel";
import { formatCalendarSyncErrorMessage } from "@/lib/calendarSyncError";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function toSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function googleStatusMessage(status: string | undefined, params: Record<string, string | string[] | undefined>) {
  switch (status) {
    case "connected":
      return { tone: "success", text: "Googleカレンダー連携を保存しました。今後の課題保存時に同期を試行します。" };
    case "disconnected":
      return { tone: "success", text: "Googleカレンダー連携を解除しました。" };
    case "not_connected":
      return { tone: "warning", text: "Googleカレンダーに接続してから同期してください。" };
    case "not_configured":
      return { tone: "warning", text: "GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定するとOAuth接続を開始できます。" };
    case "state_error":
      return { tone: "danger", text: "Google連携の確認情報が一致しませんでした。もう一度接続を開始してください。" };
    case "auth_error":
      return { tone: "danger", text: "ログイン状態を確認できませんでした。ログインし直してからGoogle連携をやり直してください。" };
    case "storage_error":
      return { tone: "danger", text: "Google連携情報の保存に失敗しました。時間をおいて再実行してください。" };
    case "token_error":
      return { tone: "danger", text: "Googleからトークンを取得できませんでした。OAuth設定、redirect URI、テストユーザー設定を確認してください。" };
    case "access_denied":
      return { tone: "warning", text: "Google側でアクセスが拒否されました。OAuth同意画面のTest usersに使用中のGoogleアカウントを追加してください。" };
    case "sync_done": {
      const picked = toSingle(params.picked) ?? "0";
      const queued = toSingle(params.queued) ?? "0";
      const synced = toSingle(params.synced) ?? "0";
      const failed = toSingle(params.failed) ?? "0";
      const tone = failed === "0" && queued === "0" ? "success" : "warning";
      return {
        tone,
        text: `既存課題の同期キュー投入を実行しました。対象${picked}件 / キュー${queued}件 / 成功${synced}件 / 失敗${failed}件。`
      };
    }
    default:
      return null;
  }
}

function syncJobStatusText(status: string) {
  switch (status) {
    case "pending":
      return "待機中";
    case "processing":
      return "処理中";
    case "synced":
      return "同期済み";
    case "failed":
      return "失敗";
    default:
      return status;
  }
}

function notificationStatusText(status: string) {
  switch (status) {
    case "queued":
      return "待機中";
    case "sent":
      return "送信済み";
    case "failed":
      return "送信失敗";
    default:
      return status;
  }
}

function notificationChannelText(channel: string) {
  switch (channel) {
    case "email":
      return "メール";
    case "web_push":
      return "Web Push";
    default:
      return channel;
  }
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const adminAccess = resolveAdminAccess(user);
  const params = await searchParams;
  const [settings, syncJobs, recentNotifications, aiCreditBalance] = await Promise.all([
    getUserSettings(user.id),
    listRecentSyncOutboxJobs(user.id),
    listRecentNotifications(user.id),
    getOrCreateAiCreditBalance(user.id)
  ]);
  const googleStatus = googleStatusMessage(toSingle(params.google), params);
  const isGoogleConnected = settings.googleCalendarEnabled;

  return (
    <div className="space-y-5">
      <PageHeader
        title="設定"
        description="通知・表示・Google連携・エクスポートを管理"
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">初回セットアップ</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              作業時間・通知・AI整理の初期設定を見直します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminAccess.isAdmin ? (
              <Link href="/admin">
                <Button variant="outline">運営ページ</Button>
              </Link>
            ) : null}
            <Link href="/setup">
              <Button variant="outline">
                <Settings2 className="h-4 w-4" />
                開く
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-base font-semibold">AI credits</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {aiCreditBalance
                  ? `${aiCreditBalance.monthKey} の利用状況`
                  : "AI credit DB未適用時は、利用ログだけ記録します。"}
              </p>
            </div>
          </div>
          {aiCreditBalance ? (
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-tight">{aiCreditBalance.creditsRemaining}</p>
              <p className="text-xs text-muted-foreground">残り / {aiCreditBalance.monthlyLimit} credits</p>
            </div>
          ) : null}
        </div>
      </Card>

      <SettingsForm settings={settings} action={updateSettingsAction} />

      <PwaInstallPanel />

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Googleカレンダー連携</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Google OAuthで接続すると、課題作成・編集・削除時にGoogleカレンダー同期を試行します。
            </p>
          </div>
          <div
            className={
              isGoogleConnected
                ? "rounded-full border border-success/35 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                : "rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
            }
          >
            {isGoogleConnected ? "接続済み" : "未接続"}
          </div>
        </div>

        {googleStatus ? (
          <div
            className={
              googleStatus.tone === "success"
                ? "mb-3 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"
                : googleStatus.tone === "warning"
                  ? "mb-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
                  : "mb-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
            }
          >
            {googleStatus.text}
          </div>
        ) : null}

        <div className="mb-4 rounded-lg border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">同期の動き</p>
          <p className="mt-1">
            課題保存は常に優先されます。Google Calendar同期に失敗しても、課題データは保存されたままになります。
          </p>
        </div>

        {isGoogleCalendarOAuthEnabled && !isGoogleConnected ? (
          <div className="mb-4 rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
            Google CloudのOAuth同意画面がテスト中の場合、Test usersに campusflow.official@gmail.com と実際にログインするGoogleアカウントを追加してください。
          </div>
        ) : null}

        <div className="mb-5 flex flex-wrap items-center gap-2">
          {isGoogleCalendarOAuthEnabled ? (
            <a
              href="/api/google-calendar/connect"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <CalendarCheck2 className="mr-2 h-4 w-4" />
              {isGoogleConnected ? "Googleカレンダーを再接続" : "Googleカレンダーに接続"}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Google OAuth未設定です。Google CloudでClient ID/Secretを作成してから接続できます。
            </p>
          )}

          <form action={syncIncompleteAssignmentsToCalendarAction}>
            <Button type="submit" variant="outline" disabled={!isGoogleConnected}>
              <RefreshCw className="h-4 w-4" />
              既存課題を同期
            </Button>
          </form>

          {isGoogleConnected ? (
            <form action={disconnectGoogleCalendarAction}>
              <Button type="submit" variant="outline">
                <Unlink className="h-4 w-4" />
                連携解除
              </Button>
            </form>
          ) : null}
        </div>

        <details className="rounded-lg border border-border bg-muted p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">開発者向け: トークンを手動入力</summary>
          <p className="mt-3 text-xs text-muted-foreground">
            通常はOAuth接続だけ使います。検証時だけ手動入力してください。
          </p>

          <form action={saveGoogleCalendarTokenAction} className="mt-3 grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="googleAccessToken">Access Token</Label>
              <Input id="googleAccessToken" name="googleAccessToken" />
            </div>
            <div>
              <Label htmlFor="googleRefreshToken">Refresh Token</Label>
              <Input id="googleRefreshToken" name="googleRefreshToken" />
            </div>
            <div>
              <Label htmlFor="googleTokenExpiry">Token Expiry (ISO)</Label>
              <Input id="googleTokenExpiry" name="googleTokenExpiry" placeholder="2026-04-18T20:00:00+09:00" />
            </div>
            <div className="flex justify-end md:col-span-3">
              <Button type="submit">連携情報を保存</Button>
            </div>
          </form>
        </details>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Google同期キュー</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              課題保存とは別にGoogle Calendar同期を追跡します。失敗しても課題データは残ります。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/google-calendar/dispatch?limit=30" className="inline-flex">
              <Button variant="outline">
                <RefreshCw className="h-4 w-4" />
                待機ジョブを実行
              </Button>
            </a>
            <a href="/api/google-calendar/dispatch?limit=30&retryFailed=1&retryFailedLimit=30" className="inline-flex">
              <Button variant="outline">失敗を再試行して実行</Button>
            </a>
          </div>
        </div>

        {syncJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">同期ジョブはまだありません。</p>
        ) : (
          <div className="space-y-2">
            {syncJobs.map((job) => (
              <div key={job.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {job.operation === "delete" ? "削除同期" : "作成・更新同期"} / {syncJobStatusText(job.status)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(job.updatedAt)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">試行回数: {job.attempts}回</p>
                {job.lastError ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-xs text-danger">{formatCalendarSyncErrorMessage(job.lastError)}</p>
                    <p className="text-xs text-muted-foreground">詳細: {job.lastError}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <BellRing className="h-4 w-4 text-primary" />
              通知送信キュー
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              通知は課題保存とは別で処理されます。送信失敗時は再キューして再実行できます。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/api/notifications/dispatch?limit=50&drain=1" className="inline-flex">
              <Button variant="outline">
                <RefreshCw className="h-4 w-4" />
                待機通知を送信
              </Button>
            </a>
            <a href="/api/notifications/dispatch?limit=50&drain=1&retryFailed=1&retryFailedLimit=50" className="inline-flex">
              <Button variant="outline">失敗通知を再試行</Button>
            </a>
          </div>
        </div>

        {recentNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">通知キューはまだありません。</p>
        ) : (
          <div className="space-y-2">
            {recentNotifications.map((notification) => (
              <div key={notification.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {notificationChannelText(notification.channel)} / {notificationStatusText(notification.status)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(notification.updatedAt)}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  送信予定: {formatDateTime(notification.notifyAt)}
                  {notification.deliveredAt ? ` / 送信完了: ${formatDateTime(notification.deliveredAt)}` : ""}
                </p>
                {notification.errorMessage ? (
                  <p className="mt-1 text-xs text-danger">{notification.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="mb-3 text-base font-semibold">データ出力</h3>
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/csv" className="inline-flex">
              <Button variant="outline">CSV出力</Button>
            </a>
            <a href="/api/export/pdf" className="inline-flex">
              <Button variant="outline">PDF出力</Button>
            </a>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          <PushSubscribeButton />
        </div>
      </Card>
    </div>
  );
}
