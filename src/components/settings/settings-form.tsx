import type { UserSettings } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type SettingsFormProps = {
  settings: UserSettings;
  action: (formData: FormData) => Promise<void>;
};

export function SettingsForm({ settings, action }: SettingsFormProps) {
  return (
    <form action={action} className="space-y-5 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={settings.timezone} />
        </div>
        <div>
          <Label htmlFor="theme">Theme</Label>
          <Select
            id="theme"
            name="theme"
            defaultValue={settings.theme}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="system">System</option>
          </Select>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border/60 p-4">
        <h3 className="text-sm font-semibold">通知設定</h3>

        <label className="flex items-center justify-between text-sm">
          メール通知
          <Switch name="email" defaultChecked={settings.notificationConfig.email} />
        </label>

        <label className="flex items-center justify-between text-sm">
          Web Push通知
          <Switch name="webPush" defaultChecked={settings.notificationConfig.webPush} />
        </label>

        <label className="flex items-center justify-between text-sm">
          1週間前
          <Switch name="oneWeek" defaultChecked={settings.notificationConfig.oneWeek} />
        </label>

        <label className="flex items-center justify-between text-sm">
          3日前
          <Switch name="threeDays" defaultChecked={settings.notificationConfig.threeDays} />
        </label>

        <label className="flex items-center justify-between text-sm">
          前日
          <Switch name="oneDay" defaultChecked={settings.notificationConfig.oneDay} />
        </label>

        <label className="flex items-center justify-between text-sm">
          当日朝
          <Switch name="sameDayMorning" defaultChecked={settings.notificationConfig.sameDayMorning} />
        </label>
      </section>

      <section className="space-y-3 rounded-md border border-border/60 p-4">
        <h3 className="text-sm font-semibold">優先度重み</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="dueSoonWeight">締切重み</Label>
            <Input id="dueSoonWeight" name="dueSoonWeight" type="number" step="0.01" defaultValue={settings.priorityWeights.dueSoonWeight} />
          </div>
          <div>
            <Label htmlFor="assignmentTypeWeight">課題種別重み</Label>
            <Input id="assignmentTypeWeight" name="assignmentTypeWeight" type="number" step="0.01" defaultValue={settings.priorityWeights.assignmentTypeWeight} />
          </div>
          <div>
            <Label htmlFor="heavyWeight">重い課題重み</Label>
            <Input id="heavyWeight" name="heavyWeight" type="number" step="0.01" defaultValue={settings.priorityWeights.heavyWeight} />
          </div>
          <div>
            <Label htmlFor="estimatedHoursWeight">所要時間重み</Label>
            <Input id="estimatedHoursWeight" name="estimatedHoursWeight" type="number" step="0.01" defaultValue={settings.priorityWeights.estimatedHoursWeight} />
          </div>
          <div>
            <Label htmlFor="progressWeight">進捗重み</Label>
            <Input id="progressWeight" name="progressWeight" type="number" step="0.01" defaultValue={settings.priorityWeights.progressWeight} />
          </div>
          <div>
            <Label htmlFor="weakSubjectWeight">苦手科目重み</Label>
            <Input id="weakSubjectWeight" name="weakSubjectWeight" type="number" step="0.01" defaultValue={settings.priorityWeights.weakSubjectWeight} />
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit">設定を保存</Button>
      </div>
    </form>
  );
}
