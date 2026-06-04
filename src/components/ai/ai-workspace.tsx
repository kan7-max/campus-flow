"use client";

import { useState } from "react";
import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import { FileExtractPanel } from "@/components/ai/file-extract-panel";

export function AiWorkspace() {
  const [prefillText, setPrefillText] = useState("");

  return (
    <div className="space-y-4">
      <FileExtractPanel onExtractedText={(text) => setPrefillText(text)} />
      <AiChatPanel key={prefillText} initialText={prefillText} />
      <p className="text-xs text-muted-foreground">
        ファイル抽出結果はチャット入力欄へ反映されます。必要に応じて編集して抽出してください。
      </p>
    </div>
  );
}
