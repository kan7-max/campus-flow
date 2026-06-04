import fs from "node:fs";
import path from "node:path";

export function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonIfExists(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const text = fs.readFileSync(filePath, "utf8");
  if (!text.trim()) {
    return fallback;
  }
  return JSON.parse(text);
}

export function writeJson(filePath, value) {
  ensureDirForFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

export function appendJsonl(filePath, rows) {
  if (!rows.length) {
    return;
  }
  ensureDirForFile(filePath);
  const payload = rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
  fs.appendFileSync(filePath, payload, "utf8");
}

export function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const text = fs.readFileSync(filePath, "utf8");
  if (!text.trim()) {
    return [];
  }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines to keep ingestion robust.
    }
  }
  return out;
}

