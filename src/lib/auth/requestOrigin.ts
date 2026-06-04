function pickFirstToken(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  const token = raw
    .split(",")
    .map((part) => part.trim())
    .find(Boolean);

  return token ?? null;
}

function normalizeHost(raw: string | null | undefined) {
  const token = pickFirstToken(raw);
  if (!token) {
    return null;
  }

  // Accept both plain host headers and absolute URLs.
  const normalized = (() => {
    if (token.includes("://")) {
      try {
        return new URL(token).host;
      } catch {
        return token;
      }
    }
    return token;
  })();

  const noPath = normalized.split("/")[0]?.trim();
  if (!noPath) {
    return null;
  }

  return noPath.toLowerCase();
}

function normalizeProto(raw: string | null | undefined, fallbackOrigin: string) {
  const token = pickFirstToken(raw)?.toLowerCase();
  if (token === "http" || token === "https") {
    return token;
  }

  try {
    const protocol = new URL(fallbackOrigin).protocol.replace(":", "");
    return protocol === "http" || protocol === "https" ? protocol : "https";
  } catch {
    return "https";
  }
}

export function resolveRequestOriginFromHeaders(headers: Headers, fallbackOrigin: string) {
  const host =
    normalizeHost(headers.get("host")) ??
    normalizeHost(headers.get("x-forwarded-host")) ??
    normalizeHost(fallbackOrigin) ??
    "localhost:3000";

  const proto = normalizeProto(headers.get("x-forwarded-proto"), fallbackOrigin);
  return `${proto}://${host}`;
}
