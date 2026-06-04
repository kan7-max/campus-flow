import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredEnvVars = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "WEB_PUSH_PUBLIC_KEY",
  "WEB_PUSH_PRIVATE_KEY"
];

const optionalEnvVars = [
  "GOOGLE_CALENDAR_ID",
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
  "RESEND_API_KEY",
  "NOTIFICATION_EMAIL_FROM"
];

const requiredMigrations = [
  "supabase/migrations/20260430_sync_outbox.sql",
  "supabase/migrations/20260430_work_sessions.sql",
  "supabase/migrations/20260430_study_blocks.sql",
  "supabase/migrations/20260430_assignment_steps.sql",
  "supabase/migrations/20260501_inbox_items.sql",
  "supabase/migrations/20260501_ai_usage_logs.sql",
  "supabase/migrations/20260501_ai_credit_balances.sql",
  "supabase/migrations/20260514_grants_for_user_tables.sql"
];

const rlsCheckTargets = [
  "sync_outbox",
  "work_sessions",
  "study_blocks",
  "assignment_steps",
  "inbox_items",
  "ai_usage_logs",
  "ai_credit_balances"
];

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function parseDotEnvLocal() {
  const envPath = path.join(root, ".env.local");
  let raw = "";
  try {
    raw = await fs.readFile(envPath, "utf8");
  } catch {
    return {};
  }

  const parsed = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    parsed[key] = value;
  }
  return parsed;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === ".next" || entry.name === "node_modules" || entry.name === ".git") continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(abs)));
      continue;
    }
    files.push(abs);
  }
  return files;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

async function checkServiceRoleKeyExposure() {
  const srcDir = path.join(root, "src");
  const files = await walkFiles(srcDir);
  const hits = [];

  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    if (rel === "src/lib/env.ts") continue;
    const ext = path.extname(abs);
    if (![".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"].includes(ext)) continue;

    const content = await fs.readFile(abs, "utf8");
    if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      hits.push(rel);
    }
  }

  return hits;
}

async function checkMigrationsExist() {
  const missing = [];
  for (const rel of requiredMigrations) {
    const abs = path.join(root, rel);
    try {
      await fs.access(abs);
    } catch {
      missing.push(rel);
    }
  }
  return missing;
}

async function checkRlsCoverage() {
  const migrationsDir = path.join(root, "supabase", "migrations");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(migrationsDir, entry.name));
  const joined = (
    await Promise.all(
      sqlFiles.map(async (file) => {
        const text = await fs.readFile(file, "utf8");
        return text.toLowerCase();
      })
    )
  ).join("\n");

  const missing = [];
  for (const table of rlsCheckTargets) {
    const hasRls = joined.includes(`alter table public.${table} enable row level security`);
    const hasPolicy = joined.includes(`policy "${table} self"`) || joined.includes(`on public.${table}`);
    if (!hasRls || !hasPolicy) {
      missing.push({ table, hasRls, hasPolicy });
    }
  }

  return missing;
}

async function checkGrantCoverage() {
  const migrationsDir = path.join(root, "supabase", "migrations");
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => path.join(migrationsDir, entry.name));
  const joined = (
    await Promise.all(
      sqlFiles.map(async (file) => {
        const text = await fs.readFile(file, "utf8");
        return text.toLowerCase();
      })
    )
  ).join("\n");

  const missing = [];

  for (const table of rlsCheckTargets) {
    const hasAnonRevoke = joined.includes(`revoke all on table public.${table} from anon`);
    const hasAuthGrant = joined.includes(`grant select, insert, update, delete on table public.${table} to authenticated`);
    const hasServiceGrant = joined.includes(`grant select, insert, update, delete on table public.${table} to service_role`);

    if (!hasAnonRevoke || !hasAuthGrant || !hasServiceGrant) {
      missing.push({
        table,
        hasAnonRevoke,
        hasAuthGrant,
        hasServiceGrant
      });
    }
  }

  return missing;
}

function printSection(title) {
  console.log(`\n## ${title}`);
}

async function main() {
  const envLocal = await parseDotEnvLocal();
  const getEnv = (key) => process.env[key] ?? envLocal[key];

  printSection("Environment Variables");
  let failed = false;

  for (const key of requiredEnvVars) {
    const ok = hasValue(getEnv(key));
    console.log(`${ok ? "[PASS]" : "[FAIL]"} ${key}`);
    if (!ok) failed = true;
  }

  for (const key of optionalEnvVars) {
    const ok = hasValue(getEnv(key));
    console.log(`${ok ? "[PASS]" : "[WARN]"} ${key} (optional)`);
  }

  printSection("Service Role Key Exposure (src)");
  const exposureHits = await checkServiceRoleKeyExposure();
  if (exposureHits.length === 0) {
    console.log("[PASS] no SUPABASE_SERVICE_ROLE_KEY usage found outside src/lib/env.ts");
  } else {
    failed = true;
    console.log("[FAIL] SUPABASE_SERVICE_ROLE_KEY token string found in:");
    for (const hit of exposureHits) {
      console.log(`- ${hit}`);
    }
  }

  printSection("Required Migration Files");
  const missingMigrations = await checkMigrationsExist();
  if (missingMigrations.length === 0) {
    console.log("[PASS] required migration files exist");
  } else {
    failed = true;
    console.log("[FAIL] missing migration files:");
    for (const rel of missingMigrations) {
      console.log(`- ${rel}`);
    }
  }

  printSection("RLS Coverage (migration-level static check)");
  const missingRls = await checkRlsCoverage();
  if (missingRls.length === 0) {
    console.log("[PASS] target tables have RLS + policy markers in migrations");
  } else {
    failed = true;
    console.log("[FAIL] missing RLS/policy markers:");
    for (const row of missingRls) {
      console.log(`- ${row.table} (hasRls=${row.hasRls}, hasPolicy=${row.hasPolicy})`);
    }
  }

  printSection("GRANT Coverage (migration-level static check)");
  const missingGrants = await checkGrantCoverage();
  if (missingGrants.length === 0) {
    console.log("[PASS] target tables have explicit anon revoke + authenticated/service_role grants");
  } else {
    failed = true;
    console.log("[FAIL] missing GRANT markers:");
    for (const row of missingGrants) {
      console.log(
        `- ${row.table} (anonRevoke=${row.hasAnonRevoke}, authenticatedGrant=${row.hasAuthGrant}, serviceRoleGrant=${row.hasServiceGrant})`
      );
    }
  }

  printSection("Summary");
  if (failed) {
    console.log("PREPROD READINESS CHECK: FAIL");
    process.exitCode = 1;
    return;
  }
  console.log("PREPROD READINESS CHECK: PASS");
}

await main();
