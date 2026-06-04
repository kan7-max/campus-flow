export function formatCalendarSyncErrorMessage(rawMessage: string): string {
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("token not connected")) {
    return "Google Calendar連携が未設定のため同期できませんでした。課題データは保存されています。";
  }

  if (normalized.includes("permission") || normalized.includes("forbidden")) {
    return "Google Calendarの権限が不足しているため同期できませんでした。課題データは保存されています。";
  }

  if (normalized.includes("invalid_grant") || normalized.includes("refresh")) {
    return "Googleアカウントの再連携が必要です。課題データは保存されています。";
  }

  if (normalized.includes("assignment not found for calendar sync job")) {
    return "同期対象の課題が見つからないため、カレンダー同期を実行できませんでした。";
  }

  return "Google Calendar同期に失敗しましたが、課題データは保存されています。";
}
