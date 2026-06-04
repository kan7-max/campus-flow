import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function GET() {
  const cookieStore = await cookies();
  const callbackTrace = cookieStore.get("taskflow_oauth_callback_trace")?.value ?? null;
  const incomingAuthCookieNames = cookieStore
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => /^sb-.+/.test(name));
  const incomingSessionCookieNames = incomingAuthCookieNames.filter((name) => /-auth-token(\.|$)/.test(name));
  const incomingCodeVerifierCookieNames = incomingAuthCookieNames.filter((name) => /-auth-token-code-verifier$/.test(name));

  if (!isSupabaseEnabled || !supabaseProjectUrl || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json(
      {
        ok: false,
        code: "supabase_disabled",
        reason: "Supabase is disabled by env or demo mode",
        isSupabaseEnabled,
        hasSupabaseUrl: Boolean(supabaseProjectUrl),
        hasAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
        incomingAuthCookieNames,
        incomingSessionCookieNames,
        incomingCodeVerifierCookieNames,
        callbackTrace
      },
      { status: 400 }
    );
  }

  const pendingCookies: CookieToSet[] = [];

  const supabase = createServerClient(supabaseProjectUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        pendingCookies.push(...cookiesToSet);
      }
    }
  });

  let user: { id: string; email: string | null } | null = null;
  let authError: string | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user
      ? {
          id: result.data.user.id,
          email: result.data.user.email ?? null
        }
      : null;
    authError = result.error?.message ?? null;
  } catch (error) {
    authError = error instanceof Error ? error.message : "unexpected_auth_debug_exception";
  }

  const finalResponse = NextResponse.json(
    {
      ok: true,
      code: "auth_debug_result",
      isSupabaseEnabled,
      supabaseProjectHost: (() => {
        try {
          return new URL(supabaseProjectUrl).host;
        } catch {
          return null;
        }
      })(),
      incomingAuthCookieNames,
      incomingSessionCookieNames,
      incomingCodeVerifierCookieNames,
      callbackTrace,
      user,
      authError
    }
  );

  pendingCookies.forEach(({ name, value, options }) => {
    finalResponse.cookies.set(name, value, options);
  });

  return finalResponse;
}
