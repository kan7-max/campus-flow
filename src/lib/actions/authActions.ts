"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const AUTH_COOKIE_NAME_PATTERN = /^sb-.+-auth-token(?:\.\d+)?$/;
const AUTH_CODE_VERIFIER_COOKIE_PATTERN = /^sb-.+-auth-token-code-verifier$/;
const EXTRA_AUTH_COOKIES = ["taskflow_oauth_start_guard", "taskflow_oauth_callback_trace"];

async function clearAuthCookies() {
  const cookieStore = await cookies();
  const names = cookieStore.getAll().map((cookie) => cookie.name);

  for (const name of names) {
    if (
      AUTH_COOKIE_NAME_PATTERN.test(name) ||
      AUTH_CODE_VERIFIER_COOKIE_PATTERN.test(name) ||
      EXTRA_AUTH_COOKIES.includes(name)
    ) {
      cookieStore.delete(name);
    }
  }
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn("Supabase sign out returned error", error);
      }
    } catch (error) {
      console.warn("Supabase sign out failed", error);
    }
  }

  await clearAuthCookies();
  redirect("/login");
}

