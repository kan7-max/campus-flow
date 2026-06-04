"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, CheckSquare, ChevronDown, Sparkles } from "lucide-react";
import { ASSIGNMENT_TYPE_LABELS } from "@/lib/constants/domain";
import type { AiExtractionCandidate } from "@/lib/types/domain";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CandidateWithMeta = AiExtractionCandidate & {
  _saved: boolean;
  _selected: boolean;
};

type AiChatPanelProps = {
  initialText?: string;
};

type SavedAssignmentLink = {
  id: string;
  title: string;
};

function formatCandidateDue(value: string | null) {
  if (!value) {
    return "締切未設定";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "締切要確認";
  }

  return formatDateTime(date);
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function getCandidateWarningLabels(candidate: AiExtractionCandidate) {
  const warnings: string[] = [];

  if (!candidate.dueAt) {
    warnings.push("締切要確認");
  }

  if (!candidate.courseName) {
    warnings.push("授業要確認");
  }

  if (candidate.confidence < 0.6) {
    warnings.push("読み取り要確認");
  }

  return warnings;
}

function shouldSelectCandidateByDefault(candidate: AiExtractionCandidate) {
  return Boolean(candidate.dueAt && candidate.courseName && candidate.confidence >= 0.7);
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const raw = await res.text();
    if (!raw.trim()) {
      return fallback;
    }

    try {
      const json = JSON.parse(raw) as { error?: string };
      if (typeof json.error === "string" && json.error.trim()) {
        return json.error;
      }
    } catch {
      // Ignore JSON parse errors and fall back to generic message.
    }
  } catch {
    // Ignore body read errors and fall back to generic message.
  }

  return fallback;
}

export function AiChatPanel({ initialText = "" }: AiChatPanelProps) {
  const router = useRouter();
  const [inputText, setInputText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [creditNotice, setCreditNotice] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"chat" | "pdf" | "image">("chat");
  const [candidates, setCandidates] = useState<CandidateWithMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [savedAssignments, setSavedAssignments] = useState<SavedAssignmentLink[]>([]);
  const [saveNavigationToken, setSaveNavigationToken] = useState<string | null>(null);
  const [lastSavedCount, setLastSavedCount] = useState(0);

  const selectedCount = useMemo(() => candidates.filter((item) => item._selected && !item._saved).length, [candidates]);
  const savedCount = useMemo(() => candidates.filter((item) => item._saved).length, [candidates]);

  const runExtract = async () => {
    if (!inputText.trim()) {
      setError("課題文か授業メモを入力してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setCreditNotice(null);
    setSaveResult(null);
    setSavedAssignments([]);
    setSaveNavigationToken(null);
    setLastSavedCount(0);

    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: inputText, sourceType })
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "抽出に失敗しました"));
      }

      const data = (await res.json()) as {
        aiCredits?: {
          creditsRemaining: number;
          creditsUsed: number;
          monthlyLimit: number;
        } | null;
        summary: string;
        candidates: AiExtractionCandidate[];
      };

      setSummary(data.summary);
      if (data.aiCredits) {
        setCreditNotice(`AI credits: 残り ${data.aiCredits.creditsRemaining} / ${data.aiCredits.monthlyLimit}`);
      }
      setCandidates(
        data.candidates.map((candidate) => ({
          ...candidate,
          _saved: false,
          _selected: shouldSelectCandidateByDefault(candidate)
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "抽出中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const saveCandidates = async () => {
    const selectedEntries = candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter((entry) => entry.candidate._selected && !entry.candidate._saved);

    if (selectedEntries.length === 0) {
      setError("保存対象を1件以上選択してください");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveResult(null);
    setSavedAssignments([]);
    setSaveNavigationToken(null);
    setLastSavedCount(0);

    try {
      const payloadCandidates = selectedEntries.map((entry) => ({
        title: entry.candidate.title,
        courseName: entry.candidate.courseName,
        dueAt: entry.candidate.dueAt,
        submissionTarget: entry.candidate.submissionTarget,
        assignmentType: entry.candidate.assignmentType,
        memo: entry.candidate.memo,
        priorityLabel: entry.candidate.priorityLabel,
        estimatedHours: entry.candidate.estimatedHours,
        isHeavy: entry.candidate.isHeavy,
        tags: entry.candidate.tags,
        confidence: entry.candidate.confidence,
        suggestedSubtasks: entry.candidate.suggestedSubtasks,
        studyPlan: entry.candidate.studyPlan
      }));

      const res = await fetch("/api/ai/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sourceType, sourceText: inputText, candidates: payloadCandidates })
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "保存に失敗しました"));
      }

      const data = (await res.json()) as {
        failedCount?: number;
        failures?: Array<{ reason: string; title: string }>;
        savedAssignments?: SavedAssignmentLink[];
        savedIndexes?: number[];
        savedCount: number;
        skippedIndexes?: number[];
        skippedCount: number;
      };
      const failedText = data.failedCount ? ` / 保存失敗 ${data.failedCount}件` : "";
      const navigationToken = Date.now().toString();
      setSaveResult(
        `保存完了: ${data.savedCount}件。課題一覧に保存しました。締切が近いものは今日の画面にも表示されます。（締切未指定スキップ ${data.skippedCount}件${failedText}）`
      );
      setLastSavedCount(data.savedCount);
      setSavedAssignments(data.savedAssignments ?? []);
      setSaveNavigationToken(navigationToken);
      if (data.savedCount > 0) {
        router.prefetch(`/assignments?savedAt=${navigationToken}`);
        router.prefetch(`/today?savedAt=${navigationToken}`);
      }
      if (data.savedIndexes?.length) {
        const savedOriginalIndexes = new Set<number>();
        for (const selectedIndex of data.savedIndexes) {
          const originalIndex = selectedEntries[selectedIndex]?.index;
          if (originalIndex !== undefined) {
            savedOriginalIndexes.add(originalIndex);
          }
        }
        setCandidates((prev) =>
          prev.map((candidate, index) =>
            savedOriginalIndexes.has(index)
              ? {
                  ...candidate,
                  _saved: true,
                  _selected: false
                }
              : candidate
          )
        );
      }
      if (data.savedCount === 0 && data.failedCount) {
        setError(data.failures?.[0]?.reason ?? "課題化に失敗しました。入力内容は画面に残っています。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const updateCandidate = (index: number, patch: Partial<CandidateWithMeta>) => {
    setCandidates((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        ...patch
      };
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              AI課題抽出
            </h3>
            <p className="text-sm text-muted-foreground">WebClassやLMSの長文、PDF文字起こし、画像OCR文をまとめて抽出</p>
          </div>
          <Select value={sourceType} onChange={(event) => setSourceType(event.target.value as "chat" | "pdf" | "image")} className="w-[160px]">
            <option value="chat">チャット入力</option>
            <option value="pdf">PDF抽出文</option>
            <option value="image">画像抽出文</option>
          </Select>
        </div>

        <div>
          <Label htmlFor="ai-source-text" className="text-sm text-foreground">課題文・授業メモ</Label>
          <Textarea
            id="ai-source-text"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            aria-describedby="ai-source-help ai-source-error"
            aria-invalid={Boolean(error && !inputText.trim())}
            placeholder={`例:
物理実験
課題名: オームの法則 実験レポート
締切: 5/10 23:59
提出先: LMS

英語
Unit 3 の問題を金曜までにGoogle Classroomへ提出。`}
            className="min-h-[220px]"
          />
          <p id="ai-source-help" className="mt-1 text-xs text-muted-foreground">WebClassやLMSの文章を貼り、抽出プレビューで確認してから保存します。</p>
          {error && !inputText.trim() ? <p id="ai-source-error" className="mt-1 text-xs text-danger">{error}</p> : null}
        </div>

        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button onClick={runExtract} disabled={loading} className="w-full sm:w-auto">
            {loading ? "抽出中..." : "抽出プレビューを作成"}
          </Button>
          <Button variant="outline" onClick={() => setInputText("") } disabled={loading || saving} className="w-full sm:w-auto">
            クリア
          </Button>
        </div>

        {summary ? <p className="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">{summary}</p> : null}
        {creditNotice ? (
          <p className="rounded-md border border-success/35 bg-success/10 p-3 text-sm text-success">{creditNotice}</p>
        ) : null}
        {error && inputText.trim() ? <p className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p> : null}
        {saveResult ? (
          <div className="rounded-md border border-success/35 bg-success/10 p-3 text-sm text-success">
            <p>{saveResult}</p>
            {lastSavedCount > 0 ? (
              <div className="mt-3 space-y-3">
                {savedAssignments.length > 0 ? (
                  <div className="rounded-md border border-success/25 bg-card p-3">
                    <p className="text-xs font-semibold text-success">保存した課題</p>
                    <div className="mt-2 grid gap-2">
                      {savedAssignments.map((assignment) => (
                        <Link
                          key={assignment.id}
                          href={`/assignments/${assignment.id}`}
                          prefetch={false}
                          className="inline-flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary/45 hover:bg-accent hover:text-primary"
                        >
                          <span className="min-w-0 truncate">{assignment.title}</span>
                          <ArrowRight className="h-4 w-4 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Link
                  href={saveNavigationToken ? `/assignments?savedAt=${saveNavigationToken}` : "/assignments"}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold leading-none text-foreground transition hover:border-primary/45 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <CheckSquare className="h-4 w-4" />
                  課題一覧を見る
                </Link>
                <Link
                  href={saveNavigationToken ? `/today?savedAt=${saveNavigationToken}` : "/today"}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold leading-none text-foreground transition hover:border-primary/45 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  今日を見る
                  <ArrowRight className="h-4 w-4" />
                </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      {candidates.length > 0 ? (
        <Card className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-base font-semibold">抽出プレビュー</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className="border-primary/35 bg-primary/10 text-primary">候補 {candidates.length}件</Badge>
                <Badge className="border-border bg-muted text-muted-foreground">選択中 {selectedCount}件</Badge>
                {savedCount > 0 ? (
                  <Badge className="border-success/35 bg-success/10 text-success">保存済み {savedCount}/{candidates.length}</Badge>
                ) : null}
              </div>
            </div>
            <Button onClick={saveCandidates} disabled={saving} className="w-full sm:w-auto">
              {saving ? "保存中..." : `選択候補を保存 (${selectedCount})`}
            </Button>
          </div>

          <div className="space-y-4">
            {candidates.map((candidate, index) => {
              const warningLabels = getCandidateWarningLabels(candidate);
              const cardClassName = candidate._saved
                ? "border-success/35 bg-success/10"
                : candidate._selected
                  ? "border-primary/35 bg-primary/10"
                  : "border-border bg-card";

              return (
                <details key={`${candidate.title}-${index}`} open={candidate._selected && !candidate._saved} className={`rounded-lg border ${cardClassName}`}>
                  <summary className="cursor-pointer list-none p-4 transition hover:bg-primary/5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={candidate._saved ? "text-xs font-medium text-success" : "text-xs font-medium text-primary"}>
                          課題候補 {index + 1}/{candidates.length}
                        </p>
                        <h5 className="mt-1 truncate text-base font-semibold text-foreground">{candidate.title || "無題の課題"}</h5>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {candidate.courseName || "授業未設定"} / {formatCandidateDue(candidate.dueAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <label
                          className="flex items-center gap-2 text-sm text-foreground"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={candidate._selected}
                            disabled={candidate._saved}
                            onChange={(event) => updateCandidate(index, { _selected: event.target.checked })}
                            className="h-4 w-4 accent-primary"
                          />
                          {candidate._saved ? "保存済み" : "保存対象にする"}
                        </label>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                      {candidate._saved ? (
                        <Badge className="border-success/35 bg-success/10 text-success">保存済み</Badge>
                      ) : (
                        <Badge className="border-primary/35 bg-primary/10 text-primary">未保存</Badge>
                      )}
                      {candidate._selected && !candidate._saved ? (
                        <Badge className="border-primary/35 bg-primary/10 text-primary">保存対象</Badge>
                      ) : null}
                      <Badge className="border-primary/35 bg-primary/10 text-primary">
                        {ASSIGNMENT_TYPE_LABELS[candidate.assignmentType]}
                      </Badge>
                      <Badge className="border-border bg-muted text-muted-foreground">
                        信頼度 {Math.round(candidate.confidence * 100)}%
                      </Badge>
                      {warningLabels.length > 0 ? (
                        <Badge className="border-warning/35 bg-warning/10 text-warning">要確認</Badge>
                      ) : null}
                    </div>

                    {!candidate._saved ? (
                      <p className="mt-2 text-xs text-muted-foreground">保存前に締切と授業だけ確認してください。</p>
                    ) : null}
                  </summary>

                  <div className="space-y-3 border-t border-border/70 p-4 pt-3">
                    {warningLabels.length > 0 ? (
                      <div className="rounded-md border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning">
                        {warningLabels.join(" / ")}
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <Label>課題名</Label>
                        <Input value={candidate.title} onChange={(event) => updateCandidate(index, { title: event.target.value })} />
                      </div>

                      <div>
                        <Label>授業名</Label>
                        <Input
                          value={candidate.courseName ?? ""}
                          onChange={(event) => updateCandidate(index, { courseName: event.target.value || null })}
                        />
                      </div>

                      <div>
                        <Label>締切</Label>
                        <Input
                          type="datetime-local"
                          value={toDateTimeLocal(candidate.dueAt)}
                          onChange={(event) => updateCandidate(index, { dueAt: fromDateTimeLocal(event.target.value) })}
                        />
                      </div>

                      <div>
                        <Label>提出先</Label>
                        <Input
                          value={candidate.submissionTarget ?? ""}
                          onChange={(event) => updateCandidate(index, { submissionTarget: event.target.value || null })}
                        />
                      </div>

                      <div>
                        <Label>課題タイプ</Label>
                        <Select
                          value={candidate.assignmentType}
                          onChange={(event) =>
                            updateCandidate(index, {
                              assignmentType: event.target.value as CandidateWithMeta["assignmentType"]
                            })
                          }
                        >
                          {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <Label>推定所要時間</Label>
                        <Input
                          type="number"
                          min={1}
                          max={24}
                          value={candidate.estimatedHours}
                          onChange={(event) => updateCandidate(index, { estimatedHours: Number(event.target.value) || 1 })}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>メモ</Label>
                      <Textarea
                        className="min-h-[90px]"
                        value={candidate.memo ?? ""}
                        onChange={(event) => updateCandidate(index, { memo: event.target.value || null })}
                      />
                    </div>

                    <div className="rounded-md border border-border bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground">AI提案 学習プラン</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                        {candidate.studyPlan.slice(0, 3).map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                      {candidate.studyPlan.length > 3 ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          ほか{candidate.studyPlan.length - 3}ステップは保存後の詳細で確認できます。
                        </p>
                      ) : null}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
