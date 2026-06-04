import type { AiExtractionResult } from "@/lib/types/domain";

export type ExtractionSourceType = "chat" | "pdf" | "image";

export type ExtractorInput = {
  text: string;
  timezone: string;
  sourceType: ExtractionSourceType;
};

export interface AssignmentExtractor {
  extract(input: ExtractorInput): Promise<AiExtractionResult>;
}
