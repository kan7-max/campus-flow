import "server-only";
import type { AppUser } from "@/lib/auth";
import { env } from "@/lib/env";

export type AdminAccess = {
  isAdmin: boolean;
  isDemoUser: boolean;
  configuredEmails: string[];
  userEmail: string;
};

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

export function getAdminEmails() {
  const merged = [env.ADMIN_EMAILS, env.OPERATIONS_ADMIN_EMAILS].filter(Boolean).join(",");
  return parseAdminEmails(merged);
}

export function resolveAdminAccess(user: AppUser): AdminAccess {
  const configuredEmails = getAdminEmails();
  const userEmail = (user.email ?? "").trim().toLowerCase();
  const isDemoUser = user.id === "demo-user";
  const isDevFallback = process.env.NODE_ENV !== "production" && configuredEmails.length === 0;
  const isAdmin = isDemoUser || isDevFallback || hasAdminEmailMatch(userEmail, configuredEmails);

  return {
    isAdmin,
    isDemoUser,
    configuredEmails,
    userEmail
  };
}
