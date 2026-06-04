import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function createSupabaseServerClient() {
  if (!isSupabaseEnabled) {
    return null;
  }

  const cookieStore = await cookies();
  try {
    return createServerClient(supabaseProjectUrl!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot set cookies. Server Actions and Route Handlers can.
          }
        }
      }
    });
  } catch (error) {
    console.warn("Failed to initialize Supabase server client", error);
    return null;
  }
}
