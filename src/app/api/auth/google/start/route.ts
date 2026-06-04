import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const OAUTH_START_GUARD_COOKIE = "taskflow_oauth_start_guard";
const OAUTH_START_GUARD_SECONDS = 8;

function normalizeInternalPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/")) {
    return fallback;
  }
  return raw;
}

function resolveRequestOrigin(request: NextRequest) {
  const forwardedHostRaw = request.headers.get("x-forwarded-host");
  const forwardedHost = forwardedHostRaw?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";

  if (!forwardedHost) {
    return request.nextUrl.origin;
  }

  return `${forwardedProto}://${forwardedHost}`;
}

function classifyOAuthStartError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  if (!text) return "oauth_start_failed";
  if (text.includes("no api key found") || text.includes("apikey")) return "supabase_apikey_missing";
  if (text.includes("redirect") && text.includes("allow")) return "redirect_not_allowed";
  if (text.includes("provider is not enabled")) return "provider_disabled";
  if (text.includes("invalid client")) return "oauth_client_invalid";
  if (text.includes("failed to fetch") || text.includes("network")) return "oauth_network_failed";
  if (text.includes("invalid redirect")) return "redirect_not_allowed";
  return "oauth_start_failed";
}

function normalizeReason(message: string | undefined) {
  if (!message) return null;
  return message.replace(/\s+/g, " ").trim().slice(0, 220);
}

function parseGuardTimestamp(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function GET(request: NextRequest) {
  const origin = resolveRequestOrigin(request);
  const next = normalizeInternalPath(request.nextUrl.searchParams.get("next"));
  const debugMode = request.nextUrl.searchParams.get("debug") === "1";

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("redirectTo", next);

  const now = Date.now();
  const guardAt = parseGuardTimestamp(request.cookies.get(OAUTH_START_GUARD_COOKIE)?.value);
  if (guardAt && now - guardAt < OAUTH_START_GUARD_SECONDS * 1000) {
    const retryAfterSeconds = Math.max(1, OAUTH_START_GUARD_SECONDS - Math.floor((now - guardAt) / 1000));
    if (debugMode) {
      return NextResponse.json(
        {
          ok: false,
          code: "oauth_start_rate_limited",
          reason: `Retry after ${retryAfterSeconds}s`,
          retryAfterSeconds,
          origin,
          next
        },
        { status: 429 }
      );
    }
    loginUrl.searchParams.set("oauth_error", "oauth_start_rate_limited");
    loginUrl.searchParams.set("oauth_reason", `${retryAfterSeconds}秒後に再試行してください。`);
    return NextResponse.redirect(loginUrl);
  }

  if (!isSupabaseEnabled) {
    if (debugMode) {
      return NextResponse.json(
        {
          ok: false,
          code: "supabase_disabled",
          reason: "Supabase is disabled by env or demo mode",
          origin,
          next,
          hasSupabaseUrl: Boolean(supabaseProjectUrl),
          hasAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          isSupabaseEnabled
        },
        { status: 400 }
      );
    }
    loginUrl.searchParams.set("oauth_error", "supabase_disabled");
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(supabaseProjectUrl!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const callback = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  let data: { url: string | null } | null = null;
  let error: { message: string } | null = null;

  try {
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Keep login OAuth params minimal, but always show Google's account chooser after logout.
        // Offline access/consent prompts are handled in the Calendar connect flow instead.
        redirectTo: callback,
        scopes: "openid email profile",
        queryParams: {
          prompt: "select_account"
        }
      }
    });
    data = result.data;
    error = result.error;
  } catch (thrown) {
    const reason = thrown instanceof Error ? thrown.message : "unexpected_oauth_start_exception";
    console.error("OAuth start threw unexpectedly", {
      reason,
      origin,
      callback,
      hasSupabaseUrl: Boolean(supabaseProjectUrl),
      hasAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    });
    if (debugMode) {
      return NextResponse.json(
        {
          ok: false,
          code: "oauth_start_exception",
          reason,
          origin,
          callback,
          next,
          hasSupabaseUrl: Boolean(supabaseProjectUrl),
          hasAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          isSupabaseEnabled
        },
        { status: 500 }
      );
    }
    loginUrl.searchParams.set("oauth_error", "oauth_start_exception");
    loginUrl.searchParams.set("oauth_reason", reason.slice(0, 220));
    return NextResponse.redirect(loginUrl);
  }

  if (error || !data?.url) {
    const reason = normalizeReason(error?.message) ?? (data?.url ? null : "OAuth URL missing");
    console.warn("OAuth start failed", {
      code: classifyOAuthStartError(error?.message),
      reason,
      origin,
      callback
    });
    if (debugMode) {
      return NextResponse.json(
        {
          ok: false,
          code: classifyOAuthStartError(error?.message),
          reason,
          origin,
          callback,
          next,
          hasSupabaseUrl: Boolean(supabaseProjectUrl),
          hasAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
          isSupabaseEnabled
        },
        { status: 400 }
      );
    }
    loginUrl.searchParams.set("oauth_error", classifyOAuthStartError(error?.message));
    if (reason) {
      loginUrl.searchParams.set("oauth_reason", reason);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (debugMode) {
    const oauthHost = (() => {
      try {
        return new URL(data.url).host;
      } catch {
        return null;
      }
    })();
    return NextResponse.json({
      ok: true,
      code: "oauth_start_ok",
      origin,
      callback,
      next,
      oauthUrlHost: oauthHost,
      hasSupabaseUrl: Boolean(supabaseProjectUrl),
      hasAnonKey: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      isSupabaseEnabled
    });
  }

  const redirectResponse = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  redirectResponse.cookies.set(OAUTH_START_GUARD_COOKIE, String(now), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: OAUTH_START_GUARD_SECONDS
  });
  return redirectResponse;
}
