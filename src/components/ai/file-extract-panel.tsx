"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type FileExtractPanelProps = {
  onExtractedText: (text: string) => void;
};

type PdfExtractMode = "fast" | "quality";

export function FileExtractPanel({ onExtractedText }: FileExtractPanelProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pdfMode, setPdfMode] = useState<PdfExtractMode>("fast");

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
    setNotice(null);
  };

  const runFileExtract = async () => {
    if (!selectedFile) {
      setError("ファイルを選択してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("pdfMode", pdfMode);

      const res = await fetch("/api/ai/extract-from-file", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "ファイル抽出に失敗しました");
      }

      const data = (await res.json()) as { text: string; warning?: string };
      onExtractedText(data.text);
      if (data.warning) {
        setNotice(data.warning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ファイル抽出中にエラー");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-card">
      <h4 className="text-sm font-semibold">PDF / 画像アップロード</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        抽出精度が不完全でも、あとでAIプレビューで編集して保存できます。
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
        <div>
          <Label htmlFor="extract-file">ファイル</Label>
          <Input id="extract-file" type="file" accept=".pdf,image/*,.txt" onChange={handleFileSelection} className="w-full" />
        </div>
        <div>
          <Label htmlFor="extract-mode">抽出モード</Label>
          <Select
            id="extract-mode"
            value={pdfMode}
            onChange={(event) => setPdfMode(event.target.value as PdfExtractMode)}
            className="w-full"
          >
            <option value="fast">高速抽出</option>
            <option value="quality">精度重視</option>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || !selectedFile}
          className="w-full sm:w-auto"
          onClick={runFileExtract}
        >
          {loading ? "抽出中..." : "ファイルを読み取り"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {pdfMode === "fast"
          ? "高速抽出: 要点だけ抽出して待ち時間を短くします。"
          : "精度重視: 本文を広めに抽出するため時間がかかる場合があります。"}
      </p>

      {notice ? <p className="mt-2 text-xs text-warning">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
