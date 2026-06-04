import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { saveAssignmentsFromAiCandidates } from "@/lib/services/assignmentService";

const candidateSchema = z.object({
  title: z.string(),
  courseName: z.string().nullable(),
  dueAt: z.string().nullable(),
  submissionTarget: z.string().nullable(),
  assignmentType: z.enum(["report", "quiz", "homework", "presentation", "lab_report", "exam", "other"]),
  memo: z.string().nullable(),
  priorityLabel: z.enum(["high", "medium", "low"]),
  estimatedHours: z.number().min(1).max(24),
  isHeavy: z.boolean(),
  tags: z.array(z.enum(["heavy", "quick"])),
  confidence: z.number().min(0).max(1),
  suggestedSubtasks: z.array(z.string()),
  studyPlan: z.array(z.string())
});

const bodySchema = z.object({
  sourceType: z.enum(["chat", "pdf", "image"]),
  sourceText: z.string().optional().default(""),
  candidates: z.array(candidateSchema)
});

function buildFallbackSourceText(candidates: z.infer<typeof candidateSchema>[]) {
  return candidates
    .slice(0, 20)
    .map((candidate) => {
      const course = candidate.courseName ?? "授業未設定";
      const due = candidate.dueAt ?? "締切未設定";
      return `${candidate.title} / ${course} / ${due}`;
    })
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    }

    const json = await request.json();
    const body = bodySchema.parse(json);
    const sourceText = body.sourceText.trim() || buildFallbackSourceText(body.candidates);

    const selected = body.candidates;
    const result = await saveAssignmentsFromAiCandidates({
      userId: user.id,
      sourceType: body.sourceType,
      sourceText,
      candidates: selected
    });

    if (result.saved.length > 0) {
      revalidatePath("/assignments");
      revalidatePath("/today");
    }

    return NextResponse.json({
      failedCount: result.failed.length,
      failures: result.failed.slice(0, 3),
      savedAssignments: result.saved.map((assignment) => ({
        id: assignment.id,
        title: assignment.title
      })),
      savedIndexes: result.savedCandidateIndexes,
      savedCount: result.saved.length,
      skippedIndexes: result.skippedCandidateIndexes,
      skippedCount: result.skippedDueCount
    });
  } catch (error) {
    console.error("AI candidate save failed", error);
    return NextResponse.json(
      { error: "課題化に失敗しました。入力内容は画面に残っているので、内容を確認してもう一度保存してください。" },
      { status: 400 }
    );
  }
}
