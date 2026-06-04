import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

export function createSupabaseAdminClient() {
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!isSupabaseEnabled || !serviceRoleKey) {
    return null;
  }

  try {
    return createClient(supabaseProjectUrl!, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error("Failed to initialize Supabase admin client", error);
    return null;
  }
}
