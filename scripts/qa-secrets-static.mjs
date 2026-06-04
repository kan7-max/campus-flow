import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = (process.env.TASKFLOW_QA_DIST_DIR || ".next").trim() || ".next";
const staticDir = path.join(root, distDir, "static");

const sensitiveKeys = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_CLIENT_SECRET",
  "WEB_PUSH_PRIVATE_KEY",
  "OPENAI_API_KEY"
];

function hasConfiguredValue(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 12) return false;
  return !/^(YOUR_|example$|changeme$|placeholder$)/i.test(trimmed);
}

async function parseDotEnvLocal() {
  const envPath = path.join(root, ".env.local");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const parsed = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index <= 0) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      parsed[key] = value;
    }
    return parsed;
  } catch {
    return {};
  }
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
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

async function main() {
  const envLocal = await parseDotEnvLocal();
  const getEnv = (key) => process.env[key] ?? envLocal[key];

  try {
    await fs.access(staticDir);
  } catch {
    console.log(`[FAIL] ${distDir}/static が見つかりません。先に \`npm run build -- --no-lint\` を実行してください。`);
    process.exitCode = 1;
    return;
  }

  const allFiles = await walkFiles(staticDir);
  const secretValues = sensitiveKeys
    .map((key) => ({ key, value: getEnv(key) }))
    .filter((item) => hasConfiguredValue(item.value));

  if (secretValues.length === 0) {
    console.log("[WARN] 検査対象の秘密値が見つかりませんでした（.env.local / 環境変数）。");
    console.log("[PASS] 値ベース漏えいチェックはスキップしました。");
    return;
  }

  const leaks = [];

  for (const filePath of allFiles) {
    let buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      continue;
    }

    for (const secret of secretValues) {
      const target = Buffer.from(secret.value, "utf8");
      if (target.length > 0 && buffer.includes(target)) {
        leaks.push({ key: secret.key, file: toPosix(path.relative(root, filePath)) });
      }
    }
  }

  if (leaks.length > 0) {
    console.log("[FAIL] build成果物に秘密値が含まれています。");
    for (const leak of leaks.slice(0, 20)) {
      console.log(`- ${leak.key}: ${leak.file}`);
    }
    if (leaks.length > 20) {
      console.log(`... and ${leaks.length - 20} more`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("[PASS] .next/static に秘密値の直接混入は見つかりませんでした。");
}

await main();
