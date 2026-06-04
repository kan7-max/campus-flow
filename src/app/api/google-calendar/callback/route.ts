import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { env, isGoogleCalendarOAuthEnabled } from "@/lib/env";
import { patchUserSettings } from "@/lib/repositories/settingsRepository";
import { resolveRequestOriginFromHeaders } from "@/lib/auth/requestOrigin";

const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE = "ctf_google_calendar_oauth_state";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

function settingsRedirect(request: Request, status: string) {
  const url = new URL("/settings", request.url);
  url.searchParams.set("google", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const requestOrigin = resolveRequestOriginFromHeaders(request.headers, url.origin);
  const configuredOrigin = new URL(env.NEXT_PUBLIC_APP_URL).origin;
  if (requestOrigin !== configuredOrigin) {
    const canonicalCallbackUrl = new URL(url.pathname, configuredOrigin);
    canonicalCallbackUrl.search = url.search;
    return NextResponse.redirect(canonicalCallbackUrl);
  }

  let user;
  try {
    user = await requireUser();
  } catch (error) {
    console.error("Google Calendar callback auth failed", error);
    return settingsRedirect(request, "auth_error");
  }

  const errorCode = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE)?.value;

  if (errorCode) {
    return settingsRedirect(request, errorCode === "access_denied" ? "access_denied" : "token_error");
  }

  if (!isGoogleCalendarOAuthEnabled) {
    return settingsRedirect(request, "not_configured");
  }

  if (!code || !state || state !== expectedState) {
    return settingsRedirect(request, "state_error");
  }

  const redirectUri = new URL("/api/google-calendar/callback", configuredOrigin).toString();
  let tokenRes: Response;

  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
  } catch (error) {
    console.error("Google Calendar token request failed", error);
    return settingsRedirect(request, "token_error");
  }

  if (!tokenRes.ok) {
    console.error("Google Calendar token response failed", await tokenRes.text().catch(() => "unknown"));
    return settingsRedirect(request, "token_error");
  }

  const token = (await tokenRes.json()) as TokenResponse;
  if (!token.access_token) {
    return settingsRedirect(request, "token_error");
  }

  const expiry = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;

  const patch: {
    googleAccessToken: string;
    googleCalendarEnabled: boolean;
    googleRefreshToken?: string;
    googleTokenExpiry: string | null;
  } = {
    googleAccessToken: token.access_token,
    googleCalendarEnabled: true,
    googleTokenExpiry: expiry
  };

  if (token.refresh_token) {
    patch.googleRefreshToken = token.refresh_token;
  }

  try {
    await patchUserSettings(user.id, patch);
  } catch (error) {
    console.error("Google Calendar token save failed", error);
    return settingsRedirect(request, "storage_error");
  }

  const response = settingsRedirect(request, "connected");
  response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, "", {
    expires: new Date(0),
    path: "/"
  });

  return response;
}
