import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_PDF_MODEL: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default("primary"),
  TASKFLOW_DEMO_MODE: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_PUBLIC_KEY: z.string().optional(),
  WEB_PUSH_PRIVATE_KEY: z.string().optional(),
  WEB_PUSH_SUBJECT: z.string().default("mailto:notify@example.com"),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  OPERATIONS_ADMIN_EMAILS: z.string().optional(),
  NOTIFICATION_DISPATCH_BATCH_LIMIT: z.string().optional(),
  NOTIFICATION_DISPATCH_MAX_ROUNDS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATION_EMAIL_FROM: z.string().optional(),
  NOTIFICATION_EMAIL_EXTRA_RECIPIENTS: z.string().optional(),
  BETA_FEEDBACK_FORM_URL: z.string().url().optional(),
  BETA_CONTACT_EMAIL: z.string().optional()
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
}

export const env = parsed.success ? parsed.data : serverSchema.parse({});

function normalizeSupabaseProjectUrl(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.replace(/\/(?:rest|auth)\/v1$/i, "");
}

function hasConfiguredValue(value: string | undefined) {
  if (!value) {
    return false;
  }

  return !/^(YOUR_|example$|changeme$|placeholder$)/i.test(value.trim());
}

export const isDemoMode = /^(1|true|on|yes)$/i.test(env.TASKFLOW_DEMO_MODE ?? "");
export const supabaseProjectUrl = normalizeSupabaseProjectUrl(env.NEXT_PUBLIC_SUPABASE_URL);

export const isSupabaseEnabled =
  !isDemoMode && hasConfiguredValue(supabaseProjectUrl) && hasConfiguredValue(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const isOpenAiEnabled = hasConfiguredValue(env.OPENAI_API_KEY);
export const isWebPushEnabled = hasConfiguredValue(env.WEB_PUSH_PUBLIC_KEY) && hasConfiguredValue(env.WEB_PUSH_PRIVATE_KEY);
export const isGoogleCalendarOAuthEnabled =
  hasConfiguredValue(env.GOOGLE_CLIENT_ID) && hasConfiguredValue(env.GOOGLE_CLIENT_SECRET);

export function getSupabaseServiceRoleKey() {
  return hasConfiguredValue(env.SUPABASE_SERVICE_ROLE_KEY) ? env.SUPABASE_SERVICE_ROLE_KEY : null;
}
