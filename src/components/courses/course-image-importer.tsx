"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Loader2, Plus, Rows4, Save, Trash2 } from "lucide-react";
import { WEEKDAYS } from "@/lib/constants/domain";
import type { Weekday } from "@/lib/types/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TimetableExtractMode = "fast" | "quality";

type ExtractedTimetableCandidate = {
  courseName: string;
  dayOfWeek: Weekday;
  period: number | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
};

type EditableCourseCandidate = {
  id: string;
  name: string;
  dayOfWeek: Weekday;
  startTime: string;
  endTime: string;
  room: string;
  instructor: string;
  color: string;
  memo: string;
};

type ExtractResponse = {
  candidates: ExtractedTimetableCandidate[];
  fallbackReason: string | null;
};

type BulkSaveResponse = {
  savedCount: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount?: number;
};

const DAY_LABELS: Record<Weekday, string> = {
  Mon: "月",
  Tue: "火",
  Wed: "水",
  Thu: "木",
  Fri: "金",
  Sat: "土",
  Sun: "日"
};

const COLOR_PALETTE = ["#2563EB", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6", "#0EA5E9", "#14B8A6"];

const PERIOD_TIME_MAP: Record<number, { startTime: string; endTime: string }> = {
  1: { startTime: "09:00", endTime: "10:30" },
  2: { startTime: "10:40", endTime: "12:10" },
  3: { startTime: "13:00", endTime: "14:30" },
  4: { startTime: "14:40", endTime: "16:10" },
  5: { startTime: "16:20", endTime: "17:50" },
  6: { startTime: "18:00", endTime: "19:30" },
  7: { startTime: "19:40", endTime: "21:10" }
};

function periodToTimes(period: number) {
  return PERIOD_TIME_MAP[period] ?? { startTime: "09:00", endTime: "10:30" };
}

function toCandidateId(index: number) {
  return `candidate-${Date.now()}-${index}`;
}

function toEditableCandidate(candidate: ExtractedTimetableCandidate, index: number): EditableCourseCandidate {
  const timesFromPeriod = periodToTimes(candidate.period ?? 1);
  const startTime = candidate.startTime ?? timesFromPeriod.startTime;
  const endTime = candidate.endTime ?? timesFromPeriod.endTime;
  const slotMemo = [
    candidate.period ? `${candidate.period}限` : null,
    candidate.startTime && candidate.endTime ? `${candidate.startTime}-${candidate.endTime}` : null
  ].filter(Boolean).join(" ");
  return {
    id: toCandidateId(index),
    name: candidate.courseName,
    dayOfWeek: candidate.dayOfWeek,
    startTime,
    endTime,
    room: candidate.room ?? "",
    instructor: "",
    color: COLOR_PALETTE[index % COLOR_PALETTE.length],
    memo: slotMemo ? `${slotMemo}（抽出候補）` : ""
  };
}

export function CourseImageImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<TimetableExtractMode>("fast");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EditableCourseCandidate[]>([]);

  const hasCandidates = candidates.length > 0;
  const step = hasCandidates ? 2 : 1;
  const summaryText = useMemo(
    () => (hasCandidates ? `候補 ${candidates.length}件を確認・編集してから一括保存できます。` : "画像を選んで候補を作成してください。"),
    [candidates.length, hasCandidates]
  );

  function updateCandidate(id: string, patch: Partial<EditableCourseCandidate>) {
    setCandidates((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeCandidate(id: string) {
    setCandidates((current) => current.filter((item) => item.id !== id));
  }

  function addEmptyCandidate() {
    setCandidates((current) => [
      ...current,
      {
        id: toCandidateId(current.length),
        name: "",
        dayOfWeek: "Mon",
        startTime: "09:00",
        endTime: "10:30",
        room: "",
        instructor: "",
        color: COLOR_PALETTE[current.length % COLOR_PALETTE.length],
        memo: ""
      }
    ]);
  }

  async function runExtract() {
    if (!file) {
      setError("画像ファイルを選択してください。");
      return;
    }

    setExtracting(true);
    setError(null);
    setNotice(null);
    setFallbackReason(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);

      const response = await fetch("/api/ai/extract-timetable", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "時間割画像の読み取りに失敗しました。");
      }

      const payload = (await response.json()) as ExtractResponse;
      setFallbackReason(payload.fallbackReason);

      const nextCandidates = payload.candidates.map(toEditableCandidate);
      setCandidates(nextCandidates);

      if (nextCandidates.length > 0) {
        setNotice(`${nextCandidates.length}件の候補を作成しました。内容を確認して一括保存してください。`);
      } else {
        setNotice("画像から候補を作成できませんでした。必要な授業だけ手動で追加してください。");
      }
    } catch (extractError) {
      setError(extractError instanceof Error ? extractError.message : "時間割画像の読み取りに失敗しました。");
    } finally {
      setExtracting(false);
    }
  }

  async function saveAllCandidates() {
    const rows = candidates
      .map((item) => ({
        name: item.name.trim(),
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        room: item.room.trim(),
        instructor: item.instructor.trim(),
        color: item.color.trim(),
        memo: item.memo.trim()
      }))
      .filter((item) => item.name.length > 0);

    if (rows.length === 0) {
      setError("保存対象がありません。授業名を1件以上入力してください。");
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/courses/bulk-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: rows })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "一括保存に失敗しました。");
      }

      const payload = (await response.json()) as BulkSaveResponse;
      const createdCount = payload.createdCount ?? payload.savedCount;
      const updatedCount = payload.updatedCount ?? 0;
      const skippedCount = payload.skippedCount ?? 0;
      setNotice(
        `保存完了: 新規${createdCount}件・更新${updatedCount}件・スキップ${skippedCount}件（保存反映 ${payload.savedCount}件）`
      );
      setCandidates([]);
      setFile(null);
      setFallbackReason(null);
      window.location.reload();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "一括保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-card sm:p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">時間割画像/PDFから作成</h3>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          1) 画像/PDFアップロード → 2) 候補確認/編集 → 3) 一括保存 の順で授業をまとめて登録します。
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-1 font-medium text-primary">STEP 1 画像</span>
        <span className={`rounded-full border px-2 py-1 font-medium ${step >= 2 ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
          STEP 2 候補編集テーブル
        </span>
        <span className={`rounded-full border px-2 py-1 font-medium ${hasCandidates ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground"}`}>
          STEP 3 一括保存
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-center">
        <Input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full"
        />
        <Select value={mode} onChange={(event) => setMode(event.target.value as TimetableExtractMode)} aria-label="抽出モード">
          <option value="fast">高速抽出</option>
          <option value="quality">精度重視</option>
        </Select>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={runExtract} disabled={extracting || !file}>
          {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          候補を作成
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{summaryText}</p>
      {fallbackReason ? <p className="mt-2 text-xs text-warning">{fallbackReason}</p> : null}
      {notice ? <p className="mt-2 text-xs text-success">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      {hasCandidates ? (
        <div className="mt-4 space-y-3">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                  <th className="px-2 py-2">授業名</th>
                  <th className="px-2 py-2">曜日</th>
                  <th className="px-2 py-2">開始</th>
                  <th className="px-2 py-2">終了</th>
                  <th className="px-2 py-2">教室</th>
                  <th className="px-2 py-2">教員</th>
                  <th className="px-2 py-2">色</th>
                  <th className="px-2 py-2">メモ</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-b border-border/60">
                    <td className="px-2 py-2 align-top">
                      <Input value={candidate.name} onChange={(event) => updateCandidate(candidate.id, { name: event.target.value })} className="w-[180px]" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Select
                        value={candidate.dayOfWeek}
                        onChange={(event) => updateCandidate(candidate.id, { dayOfWeek: event.target.value as Weekday })}
                        className="w-[90px]"
                      >
                        {WEEKDAYS.map((day) => (
                          <option key={day} value={day}>
                            {DAY_LABELS[day]}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="time"
                        value={candidate.startTime}
                        onChange={(event) => updateCandidate(candidate.id, { startTime: event.target.value })}
                        className="w-[120px]"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="time"
                        value={candidate.endTime}
                        onChange={(event) => updateCandidate(candidate.id, { endTime: event.target.value })}
                        className="w-[120px]"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={candidate.room} onChange={(event) => updateCandidate(candidate.id, { room: event.target.value })} className="w-[140px]" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={candidate.instructor} onChange={(event) => updateCandidate(candidate.id, { instructor: event.target.value })} className="w-[140px]" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="color"
                        value={candidate.color}
                        onChange={(event) => updateCandidate(candidate.id, { color: event.target.value })}
                        className="h-10 w-[76px] p-1"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input value={candidate.memo} onChange={(event) => updateCandidate(candidate.id, { memo: event.target.value })} className="w-[220px]" />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeCandidate(candidate.id)}>
                        <Trash2 className="h-4 w-4" />
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={addEmptyCandidate}>
              <Plus className="h-4 w-4" />
              候補を追加
            </Button>
            <Button type="button" className="w-full sm:w-auto" onClick={saveAllCandidates} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              一括保存で確定 ({candidates.length}件)
            </Button>
          </div>

          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            <p className="inline-flex items-center gap-2">
              <Rows4 className="h-3.5 w-3.5 text-primary" />
              候補編集テーブルで修正してから、一括保存ボタンで確定します。
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
