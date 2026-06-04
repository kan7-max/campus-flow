import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth";
import { env, isOpenAiEnabled } from "@/lib/env";
import { isLikelyPdfInternalText } from "@/lib/ai/pdfInternalTextGuard";
import { createAiUsageLogBestEffort } from "@/lib/repositories/aiUsageRepository";

export const runtime = "nodejs";
export const maxDuration = 120;

function textTokenEstimate(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

type PdfExtractMode = "fast" | "quality";

const PDF_FILE_SIZE_LIMIT_BYTES = 8 * 1024 * 1024;
const IMAGE_FILE_SIZE_LIMIT_BYTES = 6 * 1024 * 1024;
const PDF_EXTRACT_CACHE_TTL_MS = 20 * 60_000;
const PDF_EXTRACT_CACHE_MAX_ENTRIES = 40;
const PDF_EXTRACT_FAILURE_MESSAGE =
  "PDF本文をうまく読み取れませんでした。WebClass本文をコピーして貼り付けてください。";
const PDF_TIMEOUT_MS: Record<PdfExtractMode, number> = {
  fast: 28_000,
  quality: 75_000
};
const PDF_EXTRACT_CONFIG: Record<PdfExtractMode, { maxOutputTokens: number; prompt: string }> = {
  fast: {
    maxOutputTokens: 850,
    prompt:
      "Campus TaskFlowで課題整理に使える情報だけを日本語で抽出してください。"
      + " 課題名、授業名、締切、提出先、作業内容、注意事項を優先し、箇条書き中心で簡潔にまとめてください。"
      + " PDFの本文全文や前置きは不要です。2500文字以内で出力してください。"
  },
  quality: {
    maxOutputTokens: 3600,
    prompt:
      "このPDFから読める本文をできるだけ忠実に抽出してください。"
      + " 課題名、締切、提出先、作業内容は欠けないように含めてください。"
      + " 出力は本文テキストのみ。説明文や前置きは不要。"
  }
};
const IMAGE_EXTRACT_CONFIG: Record<PdfExtractMode, { maxOutputTokens: number; prompt: string }> = {
  fast: {
    maxOutputTokens: 560,
    prompt:
      "この画像から課題整理に必要な情報のみを日本語で抽出してください。"
      + " 課題名、授業名、締切、提出先、作業内容、注意事項を優先し、箇条書き中心で簡潔にまとめてください。"
      + " 1200文字以内で出力してください。"
  },
  quality: {
    maxOutputTokens: 2200,
    prompt:
      "この画像に写っている文字情報をできるだけ忠実に日本語で抽出してください。"
      + " 課題名、締切、提出先、作業内容、注意事項は省略せず含めてください。"
      + " 説明文は不要で、本文テキストのみを出力してください。"
  }
};

type PdfExtractCacheEntry = {
  expiresAt: number;
  text: string;
};

const pdfExtractCache = new Map<string, PdfExtractCacheEntry>();

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function looksCorrupted(text: string) {
  if (!text) {
    return true;
  }

  const replacementChars = (text.match(/�/g) ?? []).length;
  const invalidRatio = replacementChars / Math.max(1, text.length);
  if (invalidRatio > 0.02) {
    return true;
  }

  const usableChars = (text.match(/[ぁ-んァ-ヶ一-龥A-Za-z0-9]/g) ?? []).length;
  return usableChars < 20;
}

function shouldStopPdfModelFallback(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeStatus = (error as { status?: unknown }).status;
  // 403 can mean "model not allowed" for one model, so keep trying fallback models.
  if (typeof maybeStatus === "number" && [401, 429].includes(maybeStatus)) {
    return true;
  }

  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message?: string }).message ?? "").toLowerCase()
      : "";

  return message.includes("incorrect api key") || message.includes("exceeded your current quota");
}

function toPdfExtractUserErrorMessage(reason: string | null) {
  const lowered = (reason ?? "").toLowerCase();

  if (!lowered) {
    return PDF_EXTRACT_FAILURE_MESSAGE;
  }

  if (lowered.includes("timed out")) {
    return "PDF抽出がタイムアウトしました。まずは高速抽出を試してください。";
  }

  if (lowered.includes("internal structure") || lowered.includes("looked corrupted")) {
    return "PDF本文をそのまま読めず文字化けしました。WebClass本文をコピーして貼り付けてください。";
  }

  if (
    lowered.includes("incorrect api key")
    || lowered.includes("invalid api key")
    || lowered.includes("invalid_api_key")
    || lowered.includes("unauthorized")
  ) {
    return "OpenAI APIキーを確認してください。設定更新後は再デプロイが必要です。";
  }

  if (
    lowered.includes("exceeded your current quota")
    || lowered.includes("insufficient_quota")
    || lowered.includes("rate limit")
    || lowered.includes("429")
  ) {
    return "OpenAIの利用上限に達しています。課金状態またはレート制限を確認してください。";
  }

  if (
    lowered.includes("model")
    && (lowered.includes("not found") || lowered.includes("not allowed") || lowered.includes("does not exist"))
  ) {
    return "PDF対応モデルを利用できません。OPENAI_PDF_MODEL を gpt-4o-mini に設定して再デプロイしてください。";
  }

  return PDF_EXTRACT_FAILURE_MESSAGE;
}

function shouldSkipQualityFastFallback(reason: string | null) {
  const lowered = (reason ?? "").toLowerCase();
  return (
    lowered.includes("incorrect api key")
    || lowered.includes("invalid api key")
    || lowered.includes("invalid_api_key")
    || lowered.includes("unauthorized")
    || lowered.includes("exceeded your current quota")
    || lowered.includes("insufficient_quota")
    || lowered.includes("rate limit")
    || lowered.includes("429")
  );
}

function toImageExtractUserErrorMessage(reason: string | null) {
  const lowered = (reason ?? "").toLowerCase();

  if (!lowered) {
    return "画像OCRに失敗しました。画像内の本文をコピーして貼り付けてください。";
  }

  if (lowered.includes("timed out")) {
    return "画像OCRがタイムアウトしました。まずは高速抽出を試してください。";
  }

  if (
    lowered.includes("incorrect api key")
    || lowered.includes("invalid api key")
    || lowered.includes("invalid_api_key")
    || lowered.includes("unauthorized")
  ) {
    return "OpenAI APIキーを確認してください。設定更新後は再デプロイが必要です。";
  }

  if (
    lowered.includes("exceeded your current quota")
    || lowered.includes("insufficient_quota")
    || lowered.includes("rate limit")
    || lowered.includes("429")
  ) {
    return "OpenAIの利用上限に達しています。課金状態またはレート制限を確認してください。";
  }

  if (
    lowered.includes("model")
    && (lowered.includes("not found") || lowered.includes("not allowed") || lowered.includes("does not exist"))
  ) {
    return "画像OCR対応モデルを利用できません。OPENAI_IMAGE_MODEL を gpt-4o-mini に設定して再デプロイしてください。";
  }

  return "画像OCRに失敗しました。画像内の本文をコピーして貼り付けてください。";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}

function toPdfCacheKey(params: { file: File; mode: PdfExtractMode; userId: string }) {
  return `${params.userId}:${params.mode}:${params.file.name}:${params.file.size}:${params.file.lastModified}`;
}

function readPdfExtractCache(key: string) {
  const entry = pdfExtractCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    pdfExtractCache.delete(key);
    return null;
  }

  return entry.text;
}

function writePdfExtractCache(key: string, text: string) {
  if (pdfExtractCache.size >= PDF_EXTRACT_CACHE_MAX_ENTRIES) {
    const oldestKey = pdfExtractCache.keys().next().value;
    if (oldestKey) {
      pdfExtractCache.delete(oldestKey);
    }
  }

  pdfExtractCache.set(key, {
    expiresAt: Date.now() + PDF_EXTRACT_CACHE_TTL_MS,
    text
  });
}

function parsePdfExtractMode(modeRaw: FormDataEntryValue | null): PdfExtractMode {
  return modeRaw === "quality" ? "quality" : "fast";
}

async function extractPdfTextWithOpenAi(file: File, mode: PdfExtractMode) {
  const config = PDF_EXTRACT_CONFIG[mode];
  const baseModelCandidates = mode === "fast"
    ? [env.OPENAI_PDF_MODEL, "gpt-4o-mini"]
    : [env.OPENAI_PDF_MODEL, "gpt-4o-mini", "gpt-4o", env.OPENAI_MODEL];
  const modelCandidates = Array.from(new Set(baseModelCandidates.filter(Boolean))) as string[];
  const timeoutMs = PDF_TIMEOUT_MS[mode];
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileData = `data:application/pdf;base64,${buffer.toString("base64")}`;
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY!, maxRetries: 0 });
  const failures: string[] = [];

  for (const model of modelCandidates) {
    try {
      const response = await withTimeout(
        client.responses.create({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_file",
                  filename: file.name || "upload.pdf",
                  file_data: fileData
                },
                {
                  type: "input_text",
                  text: config.prompt
                }
              ]
            }
          ],
          max_output_tokens: config.maxOutputTokens
        }),
        timeoutMs,
        `PDF extraction (${model})`
      );

      const text = normalizeExtractedText(response.output_text ?? "");
      if (looksCorrupted(text)) {
        failures.push(`${model}: extracted text looked corrupted`);
        continue;
      }

      return {
        text,
        usage: response.usage,
        model: String(response.model ?? model)
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${reason}`);
      if (shouldStopPdfModelFallback(error)) {
        break;
      }
    }
  }

  throw new Error(failures.join(" | "));
}

async function extractImageTextWithOpenAi(file: File, mode: PdfExtractMode) {
  const config = IMAGE_EXTRACT_CONFIG[mode];
  const baseModelCandidates = mode === "fast"
    ? [env.OPENAI_IMAGE_MODEL, "gpt-4o-mini"]
    : [env.OPENAI_IMAGE_MODEL, "gpt-4o", "gpt-4o-mini", env.OPENAI_MODEL];
  const modelCandidates = Array.from(new Set(baseModelCandidates.filter(Boolean))) as string[];
  const timeoutMs = mode === "fast" ? 12_000 : 36_000;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type && file.type.startsWith("image/") ? file.type : "image/png";
  const imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY!, maxRetries: 0 });
  const failures: string[] = [];

  for (const model of modelCandidates) {
    try {
      const response = await withTimeout(
        client.responses.create({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_image",
                  image_url: imageDataUrl,
                  detail: mode === "fast" ? "low" : "high"
                },
                {
                  type: "input_text",
                  text: config.prompt
                }
              ]
            }
          ],
          max_output_tokens: config.maxOutputTokens
        }),
        timeoutMs,
        `Image OCR (${model})`
      );

      const text = normalizeExtractedText(response.output_text ?? "");
      if (text.length < 5) {
        failures.push(`${model}: extracted text was empty`);
        continue;
      }

      return {
        text,
        usage: response.usage,
        model: String(response.model ?? model)
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${reason}`);
      if (shouldStopPdfModelFallback(error)) {
        break;
      }
    }
  }

  throw new Error(failures.join(" | "));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pdfMode = parsePdfExtractMode(formData.get("pdfMode"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "ファイルを選択してください。" }, { status: 400 });
    }

    const mime = file.type;
    const normalizedName = file.name.toLowerCase();
    const isPdfFile =
      mime === "application/pdf" ||
      mime === "application/x-pdf" ||
      normalizedName.endsWith(".pdf");
    const isTextFile = mime.startsWith("text/") || normalizedName.endsWith(".txt");
    const isImageFile =
      mime.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(normalizedName);
    const metadata = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: mime || "unknown",
      pdfMode
    };

    if (isTextFile) {
      const text = await file.text();
      void createAiUsageLogBestEffort({
        userId: user.id,
        feature: "file_text_extract",
        model: "browser-file-text",
        inputTokens: null,
        outputTokens: textTokenEstimate(text),
        creditsUsed: 0,
        status: "success",
        metadata
      });
      return NextResponse.json({ text });
    }

    if (isPdfFile) {
      const cacheKey = toPdfCacheKey({ userId: user.id, file, mode: pdfMode });
      const cachedText = readPdfExtractCache(cacheKey);
      if (cachedText) {
        return NextResponse.json({ text: cachedText });
      }
      let pdfOpenAiFailureReason: string | null = null;

      if (file.size > PDF_FILE_SIZE_LIMIT_BYTES) {
        void createAiUsageLogBestEffort({
          userId: user.id,
          feature: "file_text_extract",
          model: "pdf-size-limit",
          inputTokens: null,
          outputTokens: null,
          creditsUsed: 0,
          status: "failed",
          errorMessage: "PDFファイルが大きすぎます。",
          metadata
        });

        return NextResponse.json(
          { error: "PDFが大きすぎます（8MB以下推奨）。本文をコピーして貼り付けてください。" },
          { status: 400 }
        );
      }

      if (isOpenAiEnabled) {
        try {
          const ai = await extractPdfTextWithOpenAi(file, pdfMode);
          if (isLikelyPdfInternalText(ai.text)) {
            throw new Error("PDF internal structure was detected in extracted text");
          }
          writePdfExtractCache(cacheKey, ai.text);
          void createAiUsageLogBestEffort({
            userId: user.id,
            feature: "file_text_extract",
            model: ai.model,
            inputTokens: ai.usage?.input_tokens ?? null,
            outputTokens: ai.usage?.output_tokens ?? null,
            creditsUsed: 0,
            status: "success",
            metadata
          });

          return NextResponse.json({ text: ai.text });
        } catch (error) {
          pdfOpenAiFailureReason = error instanceof Error ? error.message : String(error);

          if (pdfMode === "quality" && !shouldSkipQualityFastFallback(pdfOpenAiFailureReason)) {
            try {
              const fastAi = await extractPdfTextWithOpenAi(file, "fast");
              if (!isLikelyPdfInternalText(fastAi.text)) {
                writePdfExtractCache(cacheKey, fastAi.text);
                void createAiUsageLogBestEffort({
                  userId: user.id,
                  feature: "file_text_extract",
                  model: fastAi.model,
                  inputTokens: fastAi.usage?.input_tokens ?? null,
                  outputTokens: fastAi.usage?.output_tokens ?? null,
                  creditsUsed: 0,
                  status: "fallback",
                  errorMessage: "quality_timeout_fallback_to_fast",
                  metadata: { ...metadata, fallbackMode: "fast" }
                });

                return NextResponse.json({
                  text: fastAi.text,
                  warning: "精度重視で抽出に失敗したため、高速抽出の結果を表示しています。"
                });
              }
            } catch (fallbackError) {
              const fallbackReason = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
              pdfOpenAiFailureReason = `${pdfOpenAiFailureReason} | fast-fallback: ${fallbackReason}`;
            }
          }

          void createAiUsageLogBestEffort({
            userId: user.id,
            feature: "file_text_extract",
            model: "pdf-openai-fallback",
            inputTokens: null,
            outputTokens: null,
            creditsUsed: 0,
            status: "fallback",
            errorMessage: pdfOpenAiFailureReason,
            metadata
          });
        }
      }
      if (!isOpenAiEnabled) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY が未設定です。Vercel環境変数を設定して再デプロイしてください。" },
          { status: 400 }
        );
      }

      void createAiUsageLogBestEffort({
        userId: user.id,
        feature: "file_text_extract",
        model: "pdf-text-rejected",
        inputTokens: null,
        outputTokens: null,
        creditsUsed: 0,
        status: "failed",
        errorMessage: PDF_EXTRACT_FAILURE_MESSAGE,
        metadata
      });

      return NextResponse.json({ error: toPdfExtractUserErrorMessage(pdfOpenAiFailureReason) }, { status: 400 });
    }

    if (isImageFile) {
      if (file.size > IMAGE_FILE_SIZE_LIMIT_BYTES) {
        void createAiUsageLogBestEffort({
          userId: user.id,
          feature: "file_text_extract",
          model: "image-size-limit",
          inputTokens: null,
          outputTokens: null,
          creditsUsed: 0,
          status: "failed",
          errorMessage: "画像ファイルが大きすぎます。",
          metadata
        });

        return NextResponse.json(
          { error: "画像が大きすぎます（6MB以下推奨）。画像内の本文をコピーして貼り付けてください。" },
          { status: 400 }
        );
      }

      if (!isOpenAiEnabled) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY が未設定です。Vercel環境変数を設定して再デプロイしてください。" },
          { status: 400 }
        );
      }

      try {
        const ai = await extractImageTextWithOpenAi(file, pdfMode);
        void createAiUsageLogBestEffort({
          userId: user.id,
          feature: "file_text_extract",
          model: ai.model,
          inputTokens: ai.usage?.input_tokens ?? null,
          outputTokens: ai.usage?.output_tokens ?? null,
          creditsUsed: 0,
          status: "success",
          metadata
        });

        return NextResponse.json({ text: ai.text });
      } catch (error) {
        const imageOpenAiFailureReason = error instanceof Error ? error.message : String(error);
        void createAiUsageLogBestEffort({
          userId: user.id,
          feature: "file_text_extract",
          model: "image-openai-failed",
          inputTokens: null,
          outputTokens: null,
          creditsUsed: 0,
          status: "failed",
          errorMessage: imageOpenAiFailureReason,
          metadata
        });

        return NextResponse.json({ error: toImageExtractUserErrorMessage(imageOpenAiFailureReason) }, { status: 400 });
      }
    }

    void createAiUsageLogBestEffort({
      userId: user.id,
      feature: "file_text_extract",
      model: "unsupported-file",
      inputTokens: null,
      outputTokens: null,
      creditsUsed: 0,
      status: "failed",
      errorMessage: "対応していないファイル形式です。",
      metadata
    });

    return NextResponse.json({ error: "対応していないファイル形式です。" }, { status: 400 });
  } catch (error) {
    void createAiUsageLogBestEffort({
      userId: user.id,
      feature: "file_text_extract",
      model: "file-text-extract",
      inputTokens: null,
      outputTokens: null,
      creditsUsed: 0,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Failed to extract text from file"
    });

    return NextResponse.json(
      { error: "ファイルの読み取りに失敗しました。本文をコピーして貼り付けてください。" },
      { status: 400 }
    );
  }
}
