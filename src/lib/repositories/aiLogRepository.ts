import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore, persistMockStore } from "@/lib/mock/store";

export async function createAiExtractionLog(params: {
  userId: string;
  sourceType: "chat" | "pdf" | "image";
  sourceText: string;
  extractedJson: unknown;
  confidenceAvg: number | null;
}) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    store.aiLogs.push({
      id: crypto.randomUUID(),
      userId: params.userId,
      sourceType: params.sourceType,
      sourceText: params.sourceText,
      extractedJson: params.extractedJson,
      confidenceAvg: params.confidenceAvg,
      createdAt: new Date().toISOString()
    });
    persistMockStore(store);
    return;
  }

  const { error } = await supabase.from("ai_extraction_logs").insert({
    user_id: params.userId,
    source_type: params.sourceType,
    source_text: params.sourceText,
    extracted_json: params.extractedJson as object,
    confidence_avg: params.confidenceAvg
  });

  if (error) {
    throw new Error(`Failed to save AI extraction log: ${error.message}`);
  }
}

