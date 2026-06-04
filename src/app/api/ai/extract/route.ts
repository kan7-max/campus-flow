import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isLikelyPdfInternalText } from "@/lib/ai/pdfInternalTextGuard";
import { extractAssignmentInfoWithUsage } from "@/lib/ai/extractAssignmentInfo";
import { createInboxItem } from "@/lib/repositories/inboxItemRepository";
import {
  checkAiCreditsForExtraction,
  consumeAiCreditsForExtractionBestEffort,
  logAiExtractionUsage
} from "@/lib/services/aiUsageService";

const bodySchema = z.object({
  text: z.string().min(1),
  sourceType: z.enum(["chat", "pdf", "image"]).default("chat"),
  timezone: z.string().optional()
});
const PDF_INTERNAL_TEXT_ERROR =
  "PDF抽出文が文字化けしている可能性があります。入力欄の本文は残っているので、WebClass本文をコピーして貼り付けてください。";
const EXTRACT_CACHE_TTL_MS = 10 * 60_000;
const EXTRACT_CACHE_MAX_ENTRIES = 64;

type ExtractCacheEntry = {
  expiresAt: number;
  result: Awaited<ReturnType<typeof extractAssignmentInfoWithUsage>>["result"];
};

const extractCache = new Map<string, ExtractCacheEntry>();

function toExtractCacheKey(params: { sourceType: z.infer<typeof bodySchema>["sourceType"]; text: string; timezone?: string }) {
  const hash = createHash("sha1").update(params.text).digest("hex");
  return `${params.sourceType}:${params.timezone ?? "Asia/Tokyo"}:${hash}`;
}

function readExtractCache(key: string) {
  const now = Date.now();
  const entry = extractCache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= now) {
    extractCache.delete(key);
    return null;
  }
  return entry.result;
}

function writeExtractCache(key: string, result: ExtractCacheEntry["result"]) {
  if (extractCache.size >= EXTRACT_CACHE_MAX_ENTRIES) {
    const oldestKey = extractCache.keys().next().value;
    if (oldestKey) {
      extractCache.delete(oldestKey);
    }
  }

  extractCache.set(key, {
    expiresAt: Date.now() + EXTRACT_CACHE_TTL_MS,
    result
  });
}

function toInboxSourceType(sourceType: z.infer<typeof bodySchema>["sourceType"]) {
  if (sourceType === "pdf") return "pdf";
  if (sourceType === "image") return "screenshot";
  return "ai_input";
}

async function saveFailedExtractionToInbox(userId: string, body: z.infer<typeof bodySchema>) {
  try {
    return await createInboxItem({
      userId,
      rawText: body.text,
      sourceType: toInboxSourceType(body.sourceType),
      status: "failed",
      errorMessage: "AI整理に失敗したため、メモとしてInboxに保存しました。"
    });
  } catch (inboxError) {
    console.error("Failed to save AI extraction input to inbox", inboxError);
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> | null = null;

  try {
    const json = await request.json();
    body = bodySchema.parse(json);
    const normalizedText = body.text.replace(/\r\n/g, "\n").trim();
    const cacheKey = toExtractCacheKey({
      sourceType: body.sourceType,
      text: normalizedText,
      timezone: body.timezone
    });

    if (body.sourceType === "pdf" && isLikelyPdfInternalText(normalizedText)) {
      void logAiExtractionUsage({
        userId: user.id,
        text: body.text,
        sourceType: body.sourceType,
        model: "pdf-internal-guard",
        usedAi: false,
        status: "failed",
        errorMessage: "PDF internal structure text was blocked before AI extraction"
      }).catch(() => undefined);
      return NextResponse.json({ error: PDF_INTERNAL_TEXT_ERROR }, { status: 400 });
    }

    const cachedResult = readExtractCache(cacheKey);
    if (cachedResult) {
      void logAiExtractionUsage({
        userId: user.id,
        text: body.text,
        sourceType: body.sourceType,
        result: cachedResult,
        model: "assignment-extraction-cache",
        usedAi: false,
        status: "success"
      }).catch(() => undefined);

      return NextResponse.json({
        ...cachedResult,
        aiCredits: null
      });
    }

    const creditCheck = await checkAiCreditsForExtraction({
      userId: user.id,
      text: normalizedText,
      sourceType: body.sourceType
    });

    if (!creditCheck.allowed) {
      void logAiExtractionUsage({
        userId: user.id,
        text: body.text,
        sourceType: body.sourceType,
        model: "assignment-extraction",
        usedAi: false,
        status: "failed",
        errorMessage: "AI credits are insufficient"
      }).catch(() => undefined);

      const inboxItem = await saveFailedExtractionToInbox(user.id, body);
      const inboxSaved = Boolean(inboxItem);

      return NextResponse.json(
        {
          error: inboxSaved
            ? `AI creditsが不足しています。今月の残りは${creditCheck.balance?.creditsRemaining ?? 0} creditsです。入力内容はInboxに残しました。`
            : `AI creditsが不足しています。今月の残りは${creditCheck.balance?.creditsRemaining ?? 0} creditsです。入力内容は画面に残っています。`,
          aiCredits: {
            creditsNeeded: creditCheck.creditsNeeded,
            creditsRemaining: creditCheck.balance?.creditsRemaining ?? 0,
            monthlyLimit: creditCheck.balance?.monthlyLimit ?? null
          },
          inboxSaved
        },
        { status: 402 }
      );
    }

    const { result, usage } = await extractAssignmentInfoWithUsage({
      text: normalizedText,
      sourceType: body.sourceType,
      timezone: body.timezone ?? "Asia/Tokyo"
    });
    writeExtractCache(cacheKey, result);

    void logAiExtractionUsage({
      userId: user.id,
      text: body.text,
      sourceType: body.sourceType,
      result,
      model: usage.model,
      usedAi: usage.usedAi,
      status: usage.fallbackError ? "fallback" : "success",
      errorMessage: usage.fallbackError ?? null
    }).catch(() => undefined);

    const creditConsume = await consumeAiCreditsForExtractionBestEffort({
      userId: user.id,
      text: normalizedText,
      sourceType: body.sourceType,
      usedAi: usage.usedAi
    });

    const fallbackCreditsRemaining =
      creditCheck.balance && usage.usedAi
        ? Math.max(0, creditCheck.balance.creditsRemaining - creditCheck.creditsNeeded)
        : creditCheck.balance?.creditsRemaining ?? null;

    const creditsRemaining = creditConsume.balance?.creditsRemaining ?? fallbackCreditsRemaining;
    const creditsUsed = creditConsume.charged ? creditCheck.creditsNeeded : 0;
    const monthlyLimit = creditConsume.balance?.monthlyLimit ?? creditCheck.balance?.monthlyLimit ?? null;

    return NextResponse.json({
      ...result,
      aiCredits: monthlyLimit !== null && creditsRemaining !== null
        ? {
            creditsRemaining,
            creditsUsed,
            monthlyLimit
          }
        : null
    });
  } catch (error) {
    let inboxSaved = false;

    if (body) {
      void logAiExtractionUsage({
        userId: user.id,
        text: body.text,
        sourceType: body.sourceType,
        model: "assignment-extraction",
        usedAi: false,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Assignment extraction failed"
      }).catch(() => undefined);

      const inboxItem = await saveFailedExtractionToInbox(user.id, body);
      inboxSaved = Boolean(inboxItem);
    }

    return NextResponse.json(
      {
        error: inboxSaved
          ? "うまく整理できませんでした。入力内容はInboxに残しました。"
          : "うまく整理できませんでした。入力内容は画面に残っているので、少し短くするか手入力で保存してください。",
        inboxSaved
      },
      { status: 400 }
    );
  }
}
