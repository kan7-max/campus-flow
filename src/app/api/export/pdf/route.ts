import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { toAssignmentsPdf } from "@/lib/export/assignmentExport";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await listAssignments(user.id, { sortBy: "due" });
  const pdf = await toAssignmentsPdf(assignments);

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="assignments-${new Date().toISOString().slice(0, 10)}.pdf"`
    }
  });
}
