import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Assignment } from "@/lib/types/domain";
import { formatDateTime } from "@/lib/utils";

const csvHeader = [
  "id",
  "title",
  "course",
  "due_at",
  "assignment_type",
  "priority_label",
  "priority_score",
  "status",
  "progress",
  "estimated_hours",
  "submission_target",
  "tags",
  "memo"
];

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\n") || text.includes('"')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toAssignmentsCsv(assignments: Assignment[]) {
  const lines = [csvHeader.join(",")];

  assignments.forEach((assignment) => {
    lines.push(
      [
        assignment.id,
        assignment.title,
        assignment.course?.name ?? "",
        assignment.dueAt,
        assignment.assignmentType,
        assignment.priorityLabel,
        assignment.priorityScore,
        assignment.status,
        assignment.progress,
        assignment.estimatedHours,
        assignment.submissionTarget,
        assignment.tags.join("|"),
        assignment.memo ?? ""
      ]
        .map(escapeCsv)
        .join(",")
    );
  });

  return lines.join("\n");
}

export async function toAssignmentsPdf(assignments: Assignment[]) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  let y = 800;
  page.drawText("Campus TaskFlow - Assignments Export", {
    x: 48,
    y,
    size: 16,
    font,
    color: rgb(0.2, 0.5, 0.8)
  });

  y -= 28;

  assignments.slice(0, 60).forEach((assignment, index) => {
    const line = `${index + 1}. ${assignment.title} | Due: ${formatDateTime(assignment.dueAt)} | ${assignment.status}`;
    page.drawText(line.slice(0, 120), {
      x: 48,
      y,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 13;
    if (y < 40) {
      y = 40;
    }
  });

  return pdf.save();
}
