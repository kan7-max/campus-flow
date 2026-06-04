"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginCardProps = {
  redirectTo: string;
  isSupabaseEnabled: boolean;
  initialError?: string | null;
};

export function LoginCard({ redirectTo, isSupabaseEnabled, initialError = null }: LoginCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const safeRedirectTo = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

  useEffect(() => {
    if (!isSupabaseEnabled || typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hash || !hash.includes("access_token=")) {
      return;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("redirectTo", safeRedirectTo);
      loginUrl.searchParams.set("oauth_error", "oauth_hash_missing");
      window.location.replace(loginUrl.toString());
      return;
    }

    const restoreSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          throw sessionError;
        }

        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        window.location.replace(safeRedirectTo);
      } catch (restoreError) {
        console.error("Failed to restore Supabase session from OAuth hash", restoreError);
        const reason =
          restoreError instanceof Error
            ? restoreError.message
            : "session_restore_failed";
        const loginUrl = new URL("/login", window.location.origin);
        loginUrl.searchParams.set("redirectTo", safeRedirectTo);
        loginUrl.searchParams.set("oauth_error", "oauth_hash_restore_failed");
        loginUrl.searchParams.set("oauth_reason", encodeURIComponent(reason.slice(0, 180)));
        window.location.replace(loginUrl.toString());
      }
    };

    void restoreSession();
  }, [isSupabaseEnabled, safeRedirectTo]);

  useEffect(() => {
    if (!isSupabaseEnabled || typeof window === "undefined") {
      return;
    }
    if (window.location.hash.includes("access_token=")) {
      return;
    }

    let cancelled = false;

    const syncExistingSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error: sessionError } = await supabase.auth.getSession();
        const session = data.session;

        if (sessionError || !session?.access_token || !session.refresh_token) {
          return;
        }

        const syncResponse = await fetch("/api/auth/sync-session", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            accessToken: session.access_token,
            refreshToken: session.refresh_token
          })
        });

        if (!syncResponse.ok || cancelled) {
          return;
        }

        window.location.replace(safeRedirectTo);
      } catch (syncError) {
        console.warn("Failed to sync existing browser session for SSR cookies", syncError);
      }
    };

    void syncExistingSession();

    return () => {
      cancelled = true;
    };
  }, [isSupabaseEnabled, safeRedirectTo]);

  const loginWithGoogle = () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseEnabled) {
      setError("Supabase未設定のためGoogleログインは利用できません。デモモードで開始してください。");
      setLoading(false);
      return;
    }

    // Keep OAuth start consistent in production by always using the server route.
    const target = `/api/auth/google/start?next=${encodeURIComponent(safeRedirectTo)}`;
    window.location.assign(target);
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-card">
      <h1 className="text-2xl font-semibold tracking-tight">Campus TaskFlow</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        課題の入力を最小化し、今日やることをすぐ見える形に整理します。
      </p>

      {!isSupabaseEnabled ? (
        <div className="mt-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          Supabase未設定のためデモモードです。保存・編集・削除はローカルのデモデータで確認できます。
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 whitespace-pre-line rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {isSupabaseEnabled ? (
        <Button className="mt-6 w-full" onClick={loginWithGoogle} disabled={loading}>
          {loading ? "Connecting..." : "Googleでログイン"}
        </Button>
      ) : (
        <Link
          href={safeRedirectTo}
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          デモモードで開始
        </Link>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        将来的にGitHub/メールリンク認証を追加しやすいよう、Auth基盤はSupabaseで抽象化しています。
      </p>
    </div>
  );
}
