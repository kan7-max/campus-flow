import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateProgressAndStatus } from "@/lib/repositories/assignmentRepository";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { id?: unknown; progress?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const progress = Number(body?.progress);

  if (!id || !Number.isFinite(progress) || progress < 0 || progress > 100) {
    return NextResponse.json({ error: "進捗の値が正しくありません。" }, { status: 400 });
  }

  await updateProgressAndStatus(user.id, id, progress);
  return NextResponse.json({ ok: true });
}
