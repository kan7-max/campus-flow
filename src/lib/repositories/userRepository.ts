import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockStore } from "@/lib/mock/store";
import type { Database } from "@/lib/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

function normalizeEmail(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function getUserEmailById(userId: string): Promise<string | null> {
  if (userId === "demo-user") {
    return "demo@example.com";
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      if (!error) {
        const email = normalizeEmail((data as Pick<UserRow, "email"> | null)?.email ?? null);
        if (email) {
          return email;
        }
      }
    } catch {
      // fall back to admin client.
    }
  } else {
    const store = getMockStore();
    if (store.settings[userId]) {
      return userId === "demo-user" ? "demo@example.com" : null;
    }
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
  if (error) {
    console.warn("Failed to resolve user email for notification", error.message);
    return null;
  }

  return normalizeEmail((data as Pick<UserRow, "email"> | null)?.email ?? null);
}
