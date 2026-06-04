import { createAssignmentSteps, listAssignmentSteps } from "@/lib/repositories/assignmentStepRepository";
import type { Assignment, AssignmentStep, AssignmentStepInsertInput } from "@/lib/types/domain";

type StepTemplateItem = Omit<AssignmentStepInsertInput, "assignmentId" | "userId">;

function baseSubmissionStep(assignment: Assignment): StepTemplateItem {
  const target = assignment.submissionTarget ? `${assignment.submissionTarget}に提出` : "提出場所と形式を確認";
  return {
    title: target,
    description: "ファイル名、形式、提出先、期限を最後に確認する",
    estimatedMinutes: 10
  };
}

export function getAssignmentStepTemplate(assignment: Assignment): StepTemplateItem[] {
  switch (assignment.assignmentType) {
    case "lab_report":
      return [
        {
          title: "実験データを確認",
          description: "測定値、単位、欠損データがないかを見る",
          estimatedMinutes: 15
        },
        {
          title: "グラフを作成",
          description: "軸名、単位、凡例まで入れる",
          estimatedMinutes: 30
        },
        {
          title: "計算過程を書く",
          description: "式、代入値、結果の単位を残す",
          estimatedMinutes: 25
        },
        {
          title: "結果を書く",
          description: "グラフや計算から読み取れることを短くまとめる",
          estimatedMinutes: 25
        },
        {
          title: "考察を書く",
          description: "誤差、原因、理論値との違いを整理する",
          estimatedMinutes: 40
        },
        {
          title: "PDFに整える",
          description: "図表番号、ページ崩れ、指定形式を確認する",
          estimatedMinutes: 15
        },
        baseSubmissionStep(assignment)
      ];
    case "report":
      return [
        {
          title: "資料を確認",
          description: "課題条件、字数、引用ルールを確認する",
          estimatedMinutes: 15
        },
        {
          title: "構成を作る",
          description: "見出しと各段落で書くことを決める",
          estimatedMinutes: 25
        },
        {
          title: "本文を書く",
          description: "完成度より先に一通り書き切る",
          estimatedMinutes: 50
        },
        {
          title: "見直し",
          description: "誤字、条件漏れ、引用漏れを確認する",
          estimatedMinutes: 20
        },
        baseSubmissionStep(assignment)
      ];
    case "presentation":
      return [
        {
          title: "発表の要点を決める",
          description: "聞き手に残したい結論を1つ決める",
          estimatedMinutes: 15
        },
        {
          title: "スライド骨子を作る",
          description: "タイトル、流れ、必要な図を並べる",
          estimatedMinutes: 25
        },
        {
          title: "スライドを作成",
          description: "本文を増やしすぎず、見せる材料を整える",
          estimatedMinutes: 45
        },
        {
          title: "発表メモを作る",
          description: "話す順番と詰まりそうな言葉を確認する",
          estimatedMinutes: 20
        },
        baseSubmissionStep(assignment)
      ];
    case "quiz":
    case "exam":
      return [
        {
          title: "範囲を確認",
          description: "出題範囲と優先する章を決める",
          estimatedMinutes: 10
        },
        {
          title: "例題を解く",
          description: "読むだけでなく手を動かして解く",
          estimatedMinutes: 25
        },
        {
          title: "間違いを見直す",
          description: "解けなかった理由を1行で残す",
          estimatedMinutes: 20
        },
        {
          title: "直前確認",
          description: "公式、用語、提出/受験方法を確認する",
          estimatedMinutes: 10
        }
      ];
    case "homework":
      return [
        {
          title: "問題を確認",
          description: "提出範囲と配点が高そうな問題を見る",
          estimatedMinutes: 10
        },
        {
          title: "解く",
          description: "分からない問題は印をつけて先に進む",
          estimatedMinutes: 35
        },
        {
          title: "見直し",
          description: "計算ミス、記入漏れ、添付漏れを確認する",
          estimatedMinutes: 15
        },
        baseSubmissionStep(assignment)
      ];
    default:
      return [
        {
          title: "内容を確認",
          description: "何を出せば完了かを確認する",
          estimatedMinutes: 10
        },
        {
          title: "25分だけ進める",
          description: "完璧に終わらせず、次に続けられるところまで進める",
          estimatedMinutes: 25
        },
        baseSubmissionStep(assignment)
      ];
  }
}

export async function createTemplateAssignmentSteps(userId: string, assignment: Assignment): Promise<AssignmentStep[]> {
  const template = getAssignmentStepTemplate(assignment);
  return createAssignmentSteps(userId, assignment.id, template);
}

export async function createAssignmentStepsFromTitles(params: {
  assignmentId: string;
  titles: string[];
  userId: string;
}): Promise<AssignmentStep[]> {
  return createAssignmentSteps(
    params.userId,
    params.assignmentId,
    params.titles.map((title) => ({
      title,
      estimatedMinutes: 25
    }))
  );
}

export async function getNextOpenAssignmentStep(userId: string, assignmentId: string) {
  const steps = await listAssignmentSteps(userId, assignmentId);
  return steps.find((step) => step.status !== "done") ?? null;
}
