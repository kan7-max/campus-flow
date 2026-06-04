import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMockStore, persistMockStore } from "@/lib/mock/store";
import type { NotificationRecord } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    channel: row.channel as NotificationRecord["channel"],
    notifyAt: row.notify_at,
    deliveredAt: row.delivered_at,
    status: row.status as NotificationRecord["status"],
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function enqueueNotification(params: {
  userId: string;
  assignmentId: string;
  channel: "email" | "web_push";
  notifyAt: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    const store = getMockStore();
    const now = new Date().toISOString();
    store.notifications.push({
      id: crypto.randomUUID(),
      userId: params.userId,
      assignmentId: params.assignmentId,
      channel: params.channel,
      notifyAt: params.notifyAt,
      deliveredAt: null,
      status: "queued",
      errorMessage: null,
      createdAt: now,
      updatedAt: now
    });
    persistMockStore(store);
    return;
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    assignment_id: params.assignmentId,
    channel: params.channel,
    notify_at: params.notifyAt,
    status: "queued"
  });

  if (error) {
    throw new Error(`Failed to enqueue notification: ${error.message}`);
  }
}

export async function listDueNotifications(
  nowIso = new Date().toISOString(),
  limit = 20,
  userId?: string,
  options?: { useAdmin?: boolean }
) {
  const supabase = await resolveSupabaseClient(Boolean(options?.useAdmin));
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  if (!supabase) {
    const store = getMockStore();
    return store.notifications
      .filter((item) => item.status === "queued" && item.notifyAt <= nowIso && (!userId || item.userId === userId))
      .sort((a, b) => a.notifyAt.localeCompare(b.notifyAt))
      .slice(0, safeLimit);
  }

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("status", "queued")
    .lte("notify_at", nowIso)
    .order("notify_at", { ascending: true })
    .limit(safeLimit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list due notifications: ${error.message}`);
  }

  return (data as NotificationRow[]).map(mapNotification);
}

async function resolveSupabaseClient(useAdmin: boolean) {
  if (!useAdmin) {
    return createSupabaseServerClient();
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    return admin;
  }

  const server = await createSupabaseServerClient();
  if (server) {
    throw new Error("Supabase admin client is required for system notification dispatch");
  }

  return null;
}

export async function listRecentNotifications(userId: string, limit = 12) {
  const supabase = await createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);

  if (!supabase) {
    const store = getMockStore();
    return store.notifications
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, safeLimit);
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to list recent notifications: ${error.message}`);
  }

  return (data as NotificationRow[]).map(mapNotification);
}

export async function requeueFailedNotifications(userId: string, limit = 20) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);

  if (!supabase) {
    const store = getMockStore();
    const targets = store.notifications
      .filter((item) => item.userId === userId && item.status === "failed")
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, safeLimit);

    if (targets.length === 0) {
      return 0;
    }

    targets.forEach((item) => {
      item.status = "queued";
      item.notifyAt = now;
      item.deliveredAt = null;
      item.errorMessage = null;
      item.updatedAt = now;
    });

    persistMockStore(store);
    return targets.length;
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "failed")
    .order("updated_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to list failed notifications: ${error.message}`);
  }

  const ids = ((data as Array<{ id: string }> | null) ?? []).map((item) => item.id);
  if (ids.length === 0) {
    return 0;
  }

  const { error: updateError } = await supabase
    .from("notifications")
    .update({
      status: "queued",
      notify_at: now,
      delivered_at: null,
      error_message: null,
      updated_at: now
    })
    .eq("user_id", userId)
    .eq("status", "failed")
    .in("id", ids);

  if (updateError) {
    throw new Error(`Failed to requeue notifications: ${updateError.message}`);
  }

  return ids.length;
}

export async function markNotificationSent(id: string, options?: { useAdmin?: boolean }) {
  const supabase = await resolveSupabaseClient(Boolean(options?.useAdmin));
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const item = store.notifications.find((notification) => notification.id === id);
    if (item) {
      item.status = "sent";
      item.deliveredAt = now;
      item.updatedAt = now;
      persistMockStore(store);
    }
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ status: "sent", delivered_at: now, updated_at: now })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark notification sent: ${error.message}`);
  }
}

export async function markNotificationFailed(id: string, reason: string, options?: { useAdmin?: boolean }) {
  const supabase = await resolveSupabaseClient(Boolean(options?.useAdmin));
  const now = new Date().toISOString();

  if (!supabase) {
    const store = getMockStore();
    const item = store.notifications.find((notification) => notification.id === id);
    if (item) {
      item.status = "failed";
      item.errorMessage = reason;
      item.updatedAt = now;
      persistMockStore(store);
    }
    return;
  }

  const { error } = await supabase
    .from("notifications")
    .update({ status: "failed", error_message: reason, updated_at: now })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark notification failed: ${error.message}`);
  }
}

