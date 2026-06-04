import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { env, isGoogleCalendarOAuthEnabled } from "@/lib/env";
import { resolveRequestOriginFromHeaders } from "@/lib/auth/requestOrigin";

const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE = "ctf_google_calendar_oauth_state";
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function settingsRedirect(request: Request, status: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = resolveRequestOriginFromHeaders(request.headers, requestUrl.origin);
  const configuredOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin;

  if (requestOrigin !== configuredOrigin) {
    // Keep OAuth state cookie and callback host on the same canonical origin.
    return NextResponse.redirect(new URL("/api/google-calendar/connect", configuredOrigin));
  }

  await requireUser();

  if (!isGoogleCalendarOAuthEnabled) {
    return settingsRedirect(request, "not_configured");
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/google-calendar/callback", configuredOrigin).toString();
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

  authUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", GOOGLE_CALENDAR_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: configuredOrigin.startsWith("https://")
  });

  return response;
}
