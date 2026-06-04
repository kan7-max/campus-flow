import fs from "node:fs";
import { PATHS } from "./paths.js";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const eq = trimmed.indexOf("=");
  if (eq < 1) {
    return null;
  }
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

export function loadEnvFile(filePath = PATHS.envFile) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const body = fs.readFileSync(filePath, "utf8");
  for (const line of body.split(/\r?\n/)) {
    const pair = parseEnvLine(line);
    if (!pair) {
      continue;
    }
    const [key, value] = pair;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getEnv(name, fallback = "") {
  const value = process.env[name];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
}

