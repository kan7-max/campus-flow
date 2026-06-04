import path from "node:path";

export const ROOT_DIR = process.cwd();

export const PATHS = {
  root: ROOT_DIR,
  envFile: path.join(ROOT_DIR, ".env"),
  sourcesConfig: path.join(ROOT_DIR, "config", "sources.json"),
  autoKeywordsConfig: path.join(ROOT_DIR, "config", "auto-keywords.json"),
  automationTargetsConfig: path.join(ROOT_DIR, "config", "automation-targets.json"),
  dataDir: path.join(ROOT_DIR, "data"),
  rawPostsJsonl: path.join(ROOT_DIR, "data", "raw", "x-posts.jsonl"),
  rawInvestmentPostsJsonl: path.join(ROOT_DIR, "data", "raw", "x-posts-investment.jsonl"),
  ingestStateJson: path.join(ROOT_DIR, "data", "state", "ingest-state.json"),
  ingestCursorJson: path.join(ROOT_DIR, "data", "state", "ingest-cursors.json"),
  spendStateJson: path.join(ROOT_DIR, "data", "state", "spend-state.json"),
  memorySyncStateJson: path.join(ROOT_DIR, "data", "state", "memory-sync-state.json"),
  autoImproveStateJson: path.join(ROOT_DIR, "data", "state", "auto-improve-state.json"),
  toolSyncStateJson: path.join(ROOT_DIR, "data", "state", "tool-sync-state.json"),
  processedItemsJson: path.join(ROOT_DIR, "data", "processed", "items.json"),
  briefsDir: path.join(ROOT_DIR, "data", "briefs"),
  investmentBriefsDir: path.join(ROOT_DIR, "data", "briefs", "investment"),
  actionsDir: path.join(ROOT_DIR, "data", "actions"),
  pmDir: path.join(ROOT_DIR, "data", "pm"),
  leadsDir: path.join(ROOT_DIR, "data", "leads"),
  reviewsDir: path.join(ROOT_DIR, "data", "reviews")
};

