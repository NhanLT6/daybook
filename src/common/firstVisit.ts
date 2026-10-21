import { storageKeys } from '@/common/storageKeys';
import { getSchemaVersion } from '@/db/dbMeta';

/**
 * True when this browser has never opened Daybook. Read once, when the app's modules load: initDb
 * writes the schema version right after, and the greeting writes its first-seen time, so every
 * returning browser has at least one of them. Clearing site data counts as a first visit again.
 */
export const isFirstVisit =
  typeof localStorage !== 'undefined' &&
  getSchemaVersion() === 0 &&
  !localStorage.getItem(storageKeys.notifications.greetingFirstSeenAt);

/** The welcome stands in for the "Good morning" greeting on the first visit, so the two don't stack. */
export function markGreetingShown(now = Date.now()) {
  localStorage.setItem(storageKeys.notifications.greetingFirstSeenAt, String(now));
  localStorage.setItem(storageKeys.notifications.greetingLastShownAt, String(now));
}
