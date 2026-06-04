import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { env, isOpenAiEnabled } from "@/lib/env";
import {
  extractTimetableCandidatesFromImage,
  extractTimetableCandidatesFromPdf,
  type TimetableExtractMode
} from "@/lib/ai/timetableImageExtractor";
import { createAiUsageLogBestEffort } from "@/lib/repositories/aiUsageRepository";

export const runtime = "nodejs";
export const maxDuration = 120;

const IMAGE_FILE_SIZE_LIMIT_BYTES = 6 * 1024 * 1024;
const PDF_FILE_SIZE_LIMIT_BYTES = 8 * 1024 * 1024;

type TimetableExtractSuccessResponse = {
  candidates: Array<{
    courseName: string;
    dayOfWeek: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
    period: number | null;
    startTime: string | null;
    endTime: string | null;
    room: string | null;
  }>;
  fallbackReason: string | null;
};

function parseMode(modeRaw: FormDataEntryValue | null): TimetableExtractMode {
  return modeRaw === "quality" ? "quality" : "fast";
}

function isImageFile(file: File) {
  const mime = file.type || "";
  const lowerName = file.name.toLowerCase();
  return mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(lowerName);
}

function isPdfFile(file: File) {
  const mime = file.type || "";
  const lowerName = file.name.toLowerCase();
  return mime === "application/pdf" || mime === "application/x-pdf" || lowerName.endsWith(".pdf");
}

function toFallbackReason(error: unknown) {
  const lowered = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (!lowered) {
    return "画像/PDFから時間割を読み取れませんでした。手入力で授業を追加してください。";
  }

  if (lowered.includes("timed out")) {
    return "時間割抽出がタイムアウトしました。手入力に切り替えるか、ファイルを分割して再試行してください。";
  }

  if (
    lowered.includes("incorrect api key")
    || lowered.includes("invalid api key")
    || lowered.includes("invalid_api_key")
    || lowered.includes("unauthorized")
  ) {
    return "OCR/PDF抽出の認証に失敗しました。いったん手入力で登録してください。";
  }

  if (
    lowered.includes("exceeded your current quota")
    || lowered.includes("insufficient_quota")
    || lowered.includes("rate limit")
    || lowered.includes("429")
  ) {
    return "OCR/PDF抽出の利用上限に達しました。手入力で登録して進めてください。";
  }

  if (lowered.includes("invalid json") || lowered.includes("no normalized candidates")) {
    return "時間割の形式をうまく解釈できませんでした。手入力で授業名・曜日・時限を登録してください。";
  }

  return "画像/PDFから時間割を読み取れませんでした。手入力で授業を追加してください。";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let file: File | null = null;
  const responseBase: TimetableExtractSuccessResponse = {
    candidates: [],
    fallbackReason: null
  };

  try {
    const formData = await request.formData();
    const maybeFile = formData.get("file");
    const mode = parseMode(formData.get("mode") ?? formData.get("pdfMode"));

    if (!(maybeFile instanceof File)) {
      return NextResponse.json({ error: "ファイルを選択してください。" }, { status: 400 });
    }
    file = maybeFile;

    const imageFile = isImageFile(file);
    const pdfFile = isPdfFile(file);
    if (!imageFile && !pdfFile) {
      return NextResponse.json({ error: "画像またはPDFファイルを選択してください。" }, { status: 400 });
    }

    const metadata = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "unknown",
      sourceKind: imageFile ? "image" : "pdf",
      mode
    };

    const sizeLimit = imageFile ? IMAGE_FILE_SIZE_LIMIT_BYTES : PDF_FILE_SIZE_LIMIT_BYTES;
    if (file.size > sizeLimit) {
      const fallbackReason = "ファイルが大きすぎるため抽出を実行できませんでした。手入力で授業を追加してください。";
      void createAiUsageLogBestEffort({
        userId: user.id,
        feature: "file_text_extract",
        model: "timetable-image-size-limit",
        inputTokens: null,
        outputTokens: null,
        creditsUsed: 0,
        status: "failed",
        errorMessage: fallbackReason,
        metadata
      });

      return NextResponse.json({
        ...responseBase,
        fallbackReason
      });
    }

    if (!isOpenAiEnabled || !env.OPENAI_API_KEY) {
      const fallbackReason = "OCR/PDF抽出が未設定です。手入力で授業名・曜日・時限を追加してください。";
      void createAiUsageLogBestEffort({
        userId: user.id,
        feature: "file_text_extract",
        model: "timetable-openai-not-configured",
        inputTokens: null,
        outputTokens: null,
        creditsUsed: 0,
        status: "failed",
        errorMessage: fallbackReason,
        metadata
      });

      return NextResponse.json({
        ...responseBase,
        fallbackReason
      });
    }

    try {
      const extracted = imageFile
        ? await extractTimetableCandidatesFromImage({
          apiKey: env.OPENAI_API_KEY,
          file,
          mode,
          preferredModel: env.OPENAI_IMAGE_MODEL,
          fallbackModel: env.OPENAI_MODEL
        })
        : await extractTimetableCandidatesFromPdf({
        apiKey: env.OPENAI_API_KEY,
        file,
        mode,
        preferredModel: env.OPENAI_PDF_MODEL,
        fallbackModel: env.OPENAI_MODEL
      });

      void createAiUsageLogBestEffort({
        userId: user.id,
        feature: "file_text_extract",
        model: extracted.model,
        inputTokens: extracted.usage.inputTokens,
        outputTokens: extracted.usage.outputTokens,
        creditsUsed: 0,
        status: "success",
        metadata
      });

      return NextResponse.json({
        candidates: extracted.candidates,
        fallbackReason: null
      });
    } catch (error) {
      const fallbackReason = toFallbackReason(error);
      void createAiUsageLogBestEffort({
        userId: user.id,
        feature: "file_text_extract",
        model: "timetable-image-openai-failed",
        inputTokens: null,
        outputTokens: null,
        creditsUsed: 0,
        status: "fallback",
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata
      });

      return NextResponse.json({
        ...responseBase,
        fallbackReason
      });
    }
  } catch (error) {
    const fallbackReason = "時間割ファイルの処理中に失敗しました。手入力で授業を追加してください。";
    void createAiUsageLogBestEffort({
      userId: user.id,
      feature: "file_text_extract",
      model: "timetable-image-extract",
      inputTokens: null,
      outputTokens: null,
      creditsUsed: 0,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "timetable image extraction failed",
      metadata: file
        ? {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "unknown"
          }
        : undefined
    });

    return NextResponse.json({
      ...responseBase,
      fallbackReason
    });
  }
}
