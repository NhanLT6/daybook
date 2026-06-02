import type { RememberedDate } from '@/stores/settings';

export const REMEMBER_DATE_EXPIRY_MS = 3 * 60 * 1000;

export function getRememberedDate(
  stored: RememberedDate | null,
  rememberEnabled: boolean,
  nowMs = Date.now(),
): Date | null {
  if (!rememberEnabled || !stored) return null;
  if (nowMs - stored.savedAt > REMEMBER_DATE_EXPIRY_MS) return null;
  const date = new Date(stored.date);
  return isNaN(date.getTime()) ? null : date;
}
