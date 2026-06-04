import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAssignments } from "@/lib/repositories/assignmentRepository";
import { toAssignmentsCsv } from "@/lib/export/assignmentExport";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await listAssignments(user.id, { sortBy: "due" });
  const csv = toAssignmentsCsv(assignments);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="assignments-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
