import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseEnabled, supabaseProjectUrl } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

type SyncSessionBody = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

function parseSyncBody(value: SyncSessionBody) {
  const accessToken = typeof value.accessToken === "string" ? value.accessToken.trim() : "";
  const refreshToken = typeof value.refreshToken === "string" ? value.refreshToken.trim() : "";
  return {
    accessToken,
    refreshToken,
    isValid: accessToken.length > 0 && refreshToken.length > 0
  };
}

export async function POST(request: NextRequest) {
  if (!isSupabaseEnabled || !supabaseProjectUrl || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false, code: "supabase_disabled" }, { status: 400 });
  }

  let body: SyncSessionBody = {};
  try {
    body = (await request.json()) as SyncSessionBody;
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_json" }, { status: 400 });
  }

  const parsed = parseSyncBody(body);
  if (!parsed.isValid) {
    return NextResponse.json({ ok: false, code: "missing_tokens" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, code: "session_synced" });

  const supabase = createServerClient(supabaseProjectUrl, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { error } = await supabase.auth.setSession({
    access_token: parsed.accessToken,
    refresh_token: parsed.refreshToken
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "set_session_failed",
        reason: error.message.slice(0, 200)
      },
      { status: 400 }
    );
  }

  return response;
}
