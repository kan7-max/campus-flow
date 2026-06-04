import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

const demoUser: AppUser = {
  id: "demo-user",
  email: "demo@example.com",
  name: "Demo User",
  avatarUrl: null
};

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return demoUser;
  }

  let user = null;
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;
    const nowUnix = Math.floor(Date.now() / 1000);

    if (session?.user && (session.expires_at ?? 0) > nowUnix) {
      user = session.user;
    } else {
      if (sessionError) {
        console.warn("Supabase session read failed; falling back to getUser", sessionError);
      }
      const result = await supabase.auth.getUser();
      user = result.data.user;
    }
  } catch (error) {
    console.warn("Failed to fetch current user from Supabase", error);
    return null;
  }

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata.full_name as string | undefined) ?? null,
    avatarUrl: (user.user_metadata.avatar_url as string | undefined) ?? null
  };
}

function normalizeInternalPath(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

async function resolveLoginRedirectTo() {
  const requestHeaders = await headers();
  const candidate =
    normalizeInternalPath(requestHeaders.get("next-url")) ??
    normalizeInternalPath(requestHeaders.get("x-invoke-path")) ??
    normalizeInternalPath(requestHeaders.get("x-pathname"));

  if (!candidate) {
    return null;
  }

  if (candidate === "/login" || candidate.startsWith("/login?")) {
    return null;
  }

  return candidate;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const redirectTo = await resolveLoginRedirectTo();
    if (redirectTo) {
      redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
    }

    redirect("/login");
  }
  return user;
}
