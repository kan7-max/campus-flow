export async function sendEmailNotification(params: {
  to: string | string[];
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress = process.env.NOTIFICATION_EMAIL_FROM?.trim();
  const recipients = normalizeRecipients(params.to);

  if (!apiKey) {
    return {
      ok: false,
      reason: "RESEND_API_KEY not configured"
    };
  }

  if (!fromAddress) {
    return {
      ok: false,
      reason: "NOTIFICATION_EMAIL_FROM not configured"
    };
  }

  if (recipients.length === 0) {
    return {
      ok: false,
      reason: "Recipient email not found"
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromAddress,
      to: recipients,
      subject: params.subject,
      text: params.body
    })
  });

  if (!response.ok) {
    const reason = formatEmailProviderError(await response.text(), response.status);
    return {
      ok: false,
      reason
    };
  }

  return { ok: true };
}

export function resolveNotificationEmailRecipients(primaryEmail: string | null) {
  return normalizeRecipients([
    primaryEmail,
    ...(process.env.NOTIFICATION_EMAIL_EXTRA_RECIPIENTS?.split(",") ?? [])
  ]);
}

function normalizeRecipients(value: string | Array<string | null>) {
  const raw = Array.isArray(value) ? value : [value];
  const seen = new Set<string>();
  const recipients: string[] = [];

  for (const item of raw) {
    const email = item?.trim().toLowerCase();
    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);
    recipients.push(email);
  }

  return recipients;
}

function formatEmailProviderError(rawReason: string, status: number) {
  if (!rawReason) {
    return `Email provider failed: ${status}`;
  }

  try {
    const parsed = JSON.parse(rawReason) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Fall back to the provider response below.
  }

  return rawReason;
}
