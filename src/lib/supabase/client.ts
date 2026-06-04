import { createBrowserClient } from "@supabase/ssr";
import { supabaseProjectUrl } from "@/lib/env";

export function getSupabaseBrowserClient() {
  const supabaseUrl = supabaseProjectUrl;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
