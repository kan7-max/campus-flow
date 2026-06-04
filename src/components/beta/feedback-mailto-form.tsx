"use client";

import { useMemo, useState } from "react";
import { Send } from "lucide-react";
import {
  BETA_BROWSER_OPTIONS,
  BETA_CONTACT_MAILTO,
  BETA_DEVICE_OPTIONS,
  BETA_FEEDBACK_TYPES,
  BETA_SCREEN_OPTIONS,
  isBetaScreenOption
} from "@/lib/betaInfo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FeedbackMailtoFormProps = {
  defaultScreen?: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function FeedbackMailtoForm({ defaultScreen = "/ai" }: FeedbackMailtoFormProps) {
  const [category, setCategory] = useState<(typeof BETA_FEEDBACK_TYPES)[number]>("不具合");
  const [screen, setScreen] = useState(() => (isBetaScreenOption(defaultScreen) ? defaultScreen : "/ai"));
  const [device, setDevice] = useState<(typeof BETA_DEVICE_OPTIONS)[number]>("iPhone");
  const [browser, setBrowser] = useState<(typeof BETA_BROWSER_OPTIONS)[number]>("Safari");
  const [content, setContent] = useState("");
  const [replyEmail, setReplyEmail] = useState("");

  const mailtoHref = useMemo(() => {
    const subject = `[Campus Flow β] ${category} / ${screen}`;
    const bodyLines = [
      `報告種別: ${category}`,
      `発生画面: ${screen}`,
      `端末: ${device}`,
      `ブラウザ: ${browser}`,
      `返信希望メール: ${replyEmail || "(不要)"}`,
      `報告時刻: ${nowIso()}`,
      "",
      "内容:",
      content || "(未入力)"
    ];
    const body = bodyLines.join("\n");
    return `${BETA_CONTACT_MAILTO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [browser, category, content, device, replyEmail, screen]);

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        window.location.href = mailtoHref;
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="feedback-category" className="text-xs text-muted-foreground">報告種別</label>
          <Select id="feedback-category" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            {BETA_FEEDBACK_TYPES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="feedback-screen" className="text-xs text-muted-foreground">発生した画面</label>
          <Select
            id="feedback-screen"
            value={screen}
            onChange={(event) => {
              const selected = event.target.value;
              setScreen(isBetaScreenOption(selected) ? selected : "その他");
            }}
          >
            {BETA_SCREEN_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="feedback-device" className="text-xs text-muted-foreground">端末</label>
          <Select id="feedback-device" value={device} onChange={(event) => setDevice(event.target.value as typeof device)}>
            {BETA_DEVICE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="feedback-browser" className="text-xs text-muted-foreground">ブラウザ</label>
          <Select id="feedback-browser" value={browser} onChange={(event) => setBrowser(event.target.value as typeof browser)}>
            {BETA_BROWSER_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="feedback-content" className="text-xs text-muted-foreground">内容</label>
        <Textarea
          id="feedback-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="どの操作で起きたか、期待した動き、実際に起きた動きを短く書いてください。"
          required
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="feedback-reply-email" className="text-xs text-muted-foreground">返信希望メール（任意）</label>
        <Input
          id="feedback-reply-email"
          type="email"
          value={replyEmail}
          onChange={(event) => setReplyEmail(event.target.value)}
          placeholder="必要な場合のみ入力してください"
        />
      </div>

      <Button type="submit" className="w-full sm:w-auto">
        <Send className="h-4 w-4" />
        メールアプリで送信する
      </Button>
    </form>
  );
}
