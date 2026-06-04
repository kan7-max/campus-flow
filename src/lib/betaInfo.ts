export const BETA_CONTACT_EMAIL = "campusflow.official@gmail.com";
export const BETA_CONTACT_MAILTO = `mailto:${BETA_CONTACT_EMAIL}`;

export const BETA_FEEDBACK_TYPES = [
  "不具合",
  "使いにくいところ",
  "改善案",
  "感想",
  "その他"
] as const;

export const BETA_SCREEN_OPTIONS = [
  "/beta-guide",
  "/feedback",
  "/ai",
  "/today",
  "/dashboard",
  "/assignments",
  "/inbox",
  "login",
  "その他"
] as const;
export type BetaScreenOption = (typeof BETA_SCREEN_OPTIONS)[number];

export function isBetaScreenOption(value: string): value is BetaScreenOption {
  return (BETA_SCREEN_OPTIONS as readonly string[]).includes(value);
}

export const BETA_DEVICE_OPTIONS = ["iPhone", "Android", "PC", "その他"] as const;

export const BETA_BROWSER_OPTIONS = ["Safari", "Chrome", "Edge", "その他"] as const;
