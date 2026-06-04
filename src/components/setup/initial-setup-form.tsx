import Link from "next/link";
import { Bot, CalendarDays, Clock3, GraduationCap, UserRound } from "lucide-react";
import { saveInitialSetupAction } from "@/lib/actions/settingsActions";
import type { UserSettings } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type InitialSetupFormProps = {
  settings: UserSettings;
};

const availableMinuteOptions = [
  { label: "15分", value: 15 },
  { label: "30分", value: 30 },
  { label: "1時間", value: 60 },
  { label: "2時間", value: 120 },
  { label: "3時間以上", value: 180 }
] as const;

const modeOptions = [
  { label: "通常", value: "normal" },
  { label: "忙しい日", value: "busy" },
  { label: "やる気ない日", value: "low_energy" },
  { label: "試験前", value: "exam" }
] as const;

export function InitialSetupForm({ settings }: InitialSetupFormProps) {
  return (
    <form action={saveInitialSetupAction} className="space-y-4">
      <Card className="rounded-lg">
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">プロフィール</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="displayName">表示名</Label>
            <Input id="displayName" name="displayName" defaultValue={settings.displayName ?? ""} placeholder="例: かじ" />
          </div>
          <div>
            <Label htmlFor="timezone">タイムゾーン</Label>
            <Input id="timezone" name="timezone" defaultValue={settings.timezone} />
          </div>
        </div>
      </Card>

      <Card className="rounded-lg">
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">今日の作戦</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="preferredAvailableMinutes">普段使える作業時間</Label>
            <Select
              id="preferredAvailableMinutes"
              name="preferredAvailableMinutes"
              defaultValue={String(settings.preferredAvailableMinutes)}
            >
              {availableMinuteOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">/today の「現在の作戦」に反映されます。</p>
          </div>
          <div>
            <Label htmlFor="preferredTodayMode">普段のモード</Label>
            <Select id="preferredTodayMode" name="preferredTodayMode" defaultValue={settings.preferredTodayMode}>
              {modeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">忙しい日・試験前などで今日やる課題の出し方を変えます。</p>
          </div>
        </div>
      </Card>

      <Card className="rounded-lg">
        <div className="mb-4 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">よく使う授業名</h2>
        </div>
        <Label htmlFor="setupCourseNames">授業名</Label>
        <Textarea
          id="setupCourseNames"
          name="setupCourseNames"
          className="min-h-[112px]"
          defaultValue={settings.setupCourseNames.join("\n")}
          placeholder={"物理実験\n英語プレゼン\n応用数学"}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          AI抽出後の授業名確認を楽にするためのメモです。未入力でも使えます。
        </p>
      </Card>

      <Card className="rounded-lg">
        <div className="mb-4 flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">補助機能</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
            通知
            <Switch name="notificationsEnabled" defaultChecked={settings.notificationConfig.webPush || settings.notificationConfig.email} />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
            AI整理
            <Switch name="aiEnabled" defaultChecked={settings.aiEnabled} />
          </label>
        </div>
      </Card>

      <Card className="rounded-lg border-primary/20 bg-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Google Calendar連携</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Google Calendarは初回セットアップ保存後、設定画面からOAuth接続します。スイッチだけで接続済みにはしません。
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              課題保存が成功することを優先し、Calendar同期に失敗しても課題データは残ります。
            </p>
          </div>
          <Link href="/settings">
            <Button type="button" variant="outline">
              設定で接続
            </Button>
          </Link>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Button type="submit" className="w-full sm:w-auto">セットアップを保存</Button>
      </div>
    </form>
  );
}
