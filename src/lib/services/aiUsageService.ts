import { createAiUsageLogBestEffort } from "@/lib/repositories/aiUsageRepository";
import { consumeAiCredits, getOrCreateAiCreditBalance } from "@/lib/repositories/aiCreditRepository";
import { isOpenAiEnabled } from "@/lib/env";
import type { AiExtractionResult, AiUsageFeature, AiUsageStatus } from "@/lib/types/domain";

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateResultTokens(result: AiExtractionResult) {
  return estimateTokens(JSON.stringify(result.candidates));
}

export function estimateExtractionCredits(params: {
  sourceType: "chat" | "image" | "pdf";
  usedAi: boolean;
  text: string;
}) {
  if (!params.usedAi) {
    return 0;
  }

  if (params.sourceType === "image") {
    return 5;
  }

  if (params.sourceType === "pdf") {
    return params.text.length > 6000 ? 5 : 3;
  }

  return params.text.length > 2500 ? 2 : 1;
}

export async function logAiExtractionUsage(params: {
  errorMessage?: string | null;
  feature?: AiUsageFeature;
  model: string;
  result?: AiExtractionResult;
  sourceType: "chat" | "image" | "pdf";
  status: AiUsageStatus;
  text: string;
  usedAi: boolean;
  userId: string;
}) {
  await createAiUsageLogBestEffort({
    userId: params.userId,
    feature: params.feature ?? "assignment_extract",
    model: params.model,
    inputTokens: estimateTokens(params.text),
    outputTokens: params.result ? estimateResultTokens(params.result) : null,
    creditsUsed: estimateExtractionCredits({
      sourceType: params.sourceType,
      text: params.text,
      usedAi: params.usedAi
    }),
    status: params.status,
    errorMessage: params.errorMessage ?? null,
    metadata: {
      candidateCount: params.result?.candidates.length ?? 0,
      sourceType: params.sourceType,
      usedAi: params.usedAi
    }
  });
}

export async function checkAiCreditsForExtraction(params: {
  sourceType: "chat" | "image" | "pdf";
  text: string;
  userId: string;
}) {
  const creditsNeeded = estimateExtractionCredits({
    sourceType: params.sourceType,
    text: params.text,
    usedAi: isOpenAiEnabled
  });

  if (creditsNeeded === 0) {
    return {
      allowed: true,
      balance: await getOrCreateAiCreditBalance(params.userId),
      creditsNeeded
    };
  }

  const balance = await getOrCreateAiCreditBalance(params.userId);
  if (!balance) {
    return {
      allowed: true,
      balance: null,
      creditsNeeded
    };
  }

  return {
    allowed: balance.creditsRemaining >= creditsNeeded,
    balance,
    creditsNeeded
  };
}

export async function consumeAiCreditsForExtractionBestEffort(params: {
  sourceType: "chat" | "image" | "pdf";
  text: string;
  usedAi: boolean;
  userId: string;
}) {
  const credits = estimateExtractionCredits({
    sourceType: params.sourceType,
    text: params.text,
    usedAi: params.usedAi
  });

  try {
    return await consumeAiCredits({
      userId: params.userId,
      credits
    });
  } catch (error) {
    console.error("AI credit consume failed", error);
    return {
      balance: null,
      charged: false,
      insufficient: false
    };
  }
}
