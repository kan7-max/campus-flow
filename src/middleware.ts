import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

const AUTH_BYPASS_PATHS = ["/_next", "/api", "/manifest.webmanifest", "/sw.js", "/favicon.ico"];
const LOGIN_PATH = "/login";
const AUTH_PATH = "/auth";
const PUBLIC_INFO_PATHS = ["/beta-guide", "/feedback", "/terms", "/privacy"];
const ADMIN_ROUTE_PREFIXES = ["/admin"];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function normalizeInternalPath(raw: string | null | undefined, fallback = "/dashboard") {
  if (!raw || !raw.startsWith("/")) {
    return fallback;
  }
  return raw;
}

function resolveRequestPathWithSearch(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function hasSupabaseSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => /^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
}

function parseAdminEmails(raw: string | undefined) {
  const normalized = (raw ?? "").replace(/[，；]/g, ",");
  return Array.from(
    new Set(
      normalized
        .split(/[\s,;]+/)
        .map((item) => item.trim().replace(/^['"]|['"]$/g, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

function getAdminEmails() {
  const merged = [env.ADMIN_EMAILS, env.OPERATIONS_ADMIN_EMAILS].filter(Boolean).join(",");
  return parseAdminEmails(merged);
}

function hasAdminEmailMatch(userEmail: string, configuredEmails: string[]) {
  if (!userEmail) {
    return false;
  }

  return configuredEmails.some((token) => {
    if (token.startsWith("*@")) {
      const domain = token.slice(1);
      return userEmail.endsWith(domain);
    }
    return token === userEmail;
  });
}

function hasServerAdminAccess(user: { id: string; email?: string | null }) {
  const configuredEmails = getAdminEmails();
  const userEmail = (user.email ?? "").trim().toLowerCase();
  const isDemoUser = user.id === "demo-user";
  const isDevFallback = process.env.NODE_ENV !== "production" && configuredEmails.length === 0;

  return isDemoUser || isDevFallback || hasAdminEmailMatch(userEmail, configuredEmails);
}

function isAdminPath(pathname: string) {
  return ADMIN_ROUTE_PREFIXES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function createLoginUrl(request: NextRequest, redirectTo: string, oauthError?: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("redirectTo", redirectTo);
  if (oauthError) {
    loginUrl.searchParams.set("oauth_error", oauthError);
  }
  return loginUrl;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request
  });
  const pathname = request.nextUrl.pathname;
  const isBypassPath = AUTH_BYPASS_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isLoginPath = pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
  const isAuthPath = pathname === AUTH_PATH || pathname.startsWith(`${AUTH_PATH}/`);
  const isPublicInfoPath = PUBLIC_INFO_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isProtectedPath = !isLoginPath && !isAuthPath && !isPublicInfoPath;
  const redirectTo = resolveRequestPathWithSearch(request);

  if (isBypassPath) {
    return response;
  }

  if (!isSupabaseEnabled) {
    return response;
  }

  let supabase: ReturnType<typeof createServerClient> | null = null;
  try {
    supabase = createServerClient(supabaseProjectUrl!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
  } catch (error) {
    console.warn("Failed to initialize Supabase proxy client", error);
    if (!isProtectedPath) {
      return response;
    }
    return NextResponse.redirect(createLoginUrl(request, redirectTo, "supabase_apikey_missing"));
  }

  let user = null;
  let authCheckFailed = false;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    authCheckFailed = true;
    console.warn("Supabase proxy auth check failed", error);
  }
  const hasSupabaseSessionCookieValue = hasSupabaseSessionCookie(request);

  if (!user && !authCheckFailed && isProtectedPath) {
    return NextResponse.redirect(createLoginUrl(request, redirectTo));
  }

  if (!user && authCheckFailed && !hasSupabaseSessionCookieValue && isProtectedPath) {
    return NextResponse.redirect(createLoginUrl(request, redirectTo));
  }

  if (user && isLoginPath) {
    const redirectToParam = request.nextUrl.searchParams.get("redirectTo");
    const safeRedirectTo = normalizeInternalPath(redirectToParam, "/dashboard");

    if (safeRedirectTo === "/login" || safeRedirectTo.startsWith("/login?")) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      dashboardUrl.search = "";
      return NextResponse.redirect(dashboardUrl);
    }

    return NextResponse.redirect(new URL(safeRedirectTo, request.url));
  }

  if (user && isAdminPath(pathname) && !hasServerAdminAccess(user)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.searchParams.set("admin", "forbidden");
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
