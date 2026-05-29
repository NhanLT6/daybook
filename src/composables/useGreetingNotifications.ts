import { storageKeys } from '@/common/storageKeys';
import { useNotificationCenterStore } from '@/stores/notificationCenter';

export const GREETING_INTERVAL_MS = 4 * 60 * 60 * 1000;

type GreetingReason = 'first-visit' | 'return';

export function getTimeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function getGreetingReason(now: number, firstSeenAt: string | null, lastShownAt: string | null): GreetingReason | null {
  if (!firstSeenAt) return 'first-visit';

  const lastShown = lastShownAt ? Number(lastShownAt) : 0;
  if (!Number.isFinite(lastShown) || now - lastShown >= GREETING_INTERVAL_MS) return 'return';

  return null;
}

export function useGreetingNotifications() {
  const notificationCenter = useNotificationCenterStore();

  function enqueueGreeting(reason: GreetingReason) {
    const now = Date.now();
    const title = reason === 'first-visit' ? getTimeOfDayGreeting(new Date(now)) : 'Welcome back';

    notificationCenter.greeting(title, {
      id: 'greeting',
      message: reason === 'first-visit' ? 'Ready to log your day?' : 'Back at it?',
    });

    localStorage.setItem(storageKeys.notifications.greetingLastShownAt, String(now));
    if (!localStorage.getItem(storageKeys.notifications.greetingFirstSeenAt)) {
      localStorage.setItem(storageKeys.notifications.greetingFirstSeenAt, String(now));
    }
  }

  function maybeShowGreeting() {
    const now = Date.now();
    const reason = getGreetingReason(
      now,
      localStorage.getItem(storageKeys.notifications.greetingFirstSeenAt),
      localStorage.getItem(storageKeys.notifications.greetingLastShownAt),
    );
    if (reason) enqueueGreeting(reason);
  }

  function startGreetingNotifications(): () => void {
    maybeShowGreeting();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeShowGreeting();
    };
    const onUserReturn = () => maybeShowGreeting();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('keydown', onUserReturn, { passive: true });
    window.addEventListener('pointerdown', onUserReturn, { passive: true });

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('keydown', onUserReturn);
      window.removeEventListener('pointerdown', onUserReturn);
    };
  }

  return {
    maybeShowGreeting,
    startGreetingNotifications,
  };
}
