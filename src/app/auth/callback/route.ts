import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const CALLBACK_TRACE_COOKIE = "taskflow_oauth_callback_trace";
const OAUTH_START_GUARD_COOKIE = "taskflow_oauth_start_guard";

function normalizeInternalPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/")) {
    return fallback;
  }
  return raw;
}

function resolveRequestOrigin(request: Request, requestUrl: URL) {
  const forwardedHostRaw = request.headers.get("x-forwarded-host");
  const forwardedHost = forwardedHostRaw?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";

  if (!forwardedHost) {
    return requestUrl.origin;
  }

  return `${forwardedProto}://${forwardedHost}`;
}

function attachCallbackTraceCookie(response: NextResponse, value: string) {
  response.cookies.set(CALLBACK_TRACE_COOKIE, value.slice(0, 220), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 10
  });
}

function clearOAuthStartGuardCookie(response: NextResponse) {
  response.cookies.set(OAUTH_START_GUARD_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 0
  });
}

function classifyCallbackError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  if (!text) return "oauth_callback_failed";
  if (text.includes("code verifier") || text.includes("flow state")) return "oauth_state_mismatch";
  if (text.includes("invalid_grant")) return "oauth_code_invalid";
  if (text.includes("no api key found") || text.includes("apikey")) return "supabase_apikey_missing";
  return "oauth_callback_failed";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  const providerErrorDescription = url.searchParams.get("error_description");
  const next = normalizeInternalPath(url.searchParams.get("next"));
  const baseOrigin = resolveRequestOrigin(request, url);

  if (!code || !isSupabaseEnabled) {
    console.warn("OAuth callback missing code or Supabase disabled", {
      hasCode: Boolean(code),
      isSupabaseEnabled,
      providerError
    });
    const loginUrl = new URL("/login", baseOrigin);
    loginUrl.searchParams.set("redirectTo", next);
    if (providerError) {
      loginUrl.searchParams.set("oauth_error", "oauth_provider_error");
      if (providerErrorDescription) {
        loginUrl.searchParams.set("oauth_reason", providerErrorDescription.slice(0, 180));
      } else {
        loginUrl.searchParams.set("oauth_reason", providerError.slice(0, 180));
      }
    } else {
      loginUrl.searchParams.set("oauth_error", "oauth_code_missing");
    }
    const redirect = NextResponse.redirect(loginUrl);
    attachCallbackTraceCookie(redirect, `no_code:${providerError ?? "none"}`);
    clearOAuthStartGuardCookie(redirect);
    return redirect;
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL(next, baseOrigin));

  const supabase = createServerClient(
    supabaseProjectUrl!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let error: { message: string } | null = null;
  try {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } catch (thrown) {
    const reason = thrown instanceof Error ? thrown.message : "unexpected_exchange_exception";
    console.error("OAuth callback exchange threw unexpectedly", {
      reason,
      baseOrigin,
      next
    });
    const loginUrl = new URL("/login", baseOrigin);
    loginUrl.searchParams.set("redirectTo", next);
    loginUrl.searchParams.set("oauth_error", "oauth_callback_failed");
    loginUrl.searchParams.set("oauth_reason", String(reason).slice(0, 180));
    const redirect = NextResponse.redirect(loginUrl);
    attachCallbackTraceCookie(redirect, `exchange_throw:${String(reason).slice(0, 80)}`);
    clearOAuthStartGuardCookie(redirect);
    return redirect;
  }

  if (error) {
    console.warn("OAuth callback exchange failed", {
      code: classifyCallbackError(error.message),
      reason: error.message?.slice(0, 180),
      baseOrigin,
      next
    });
    const loginUrl = new URL("/login", baseOrigin);
    loginUrl.searchParams.set("redirectTo", next);
    loginUrl.searchParams.set("oauth_error", classifyCallbackError(error.message));
    loginUrl.searchParams.set("oauth_reason", error.message.slice(0, 180));
    const redirect = NextResponse.redirect(loginUrl);
    attachCallbackTraceCookie(redirect, `exchange_error:${classifyCallbackError(error.message)}`);
    clearOAuthStartGuardCookie(redirect);
    return redirect;
  }

  const outgoingCookies = response.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => /^sb-.+/.test(name));
  console.info("OAuth callback exchange succeeded", {
    baseOrigin,
    next,
    outgoingAuthCookieNames: outgoingCookies
  });
  attachCallbackTraceCookie(response, "ok");
  clearOAuthStartGuardCookie(response);

  return response;
}
