import { computed, onScopeDispose, ref, watch } from 'vue';

import type { NotificationItem, NotificationKind } from '@/stores/notificationCenter';

import { storeToRefs } from 'pinia';

import { useNotificationCenterStore } from '@/stores/notificationCenter';

/** How long a notice without actions stays up as the toast or the pill above the chat. */
export const NOTICE_MS = 3200;

/** Theme colour of a notification kind: its icon, and the chat's light while it's the toast. */
export function noticeColor(kind: NotificationKind): string {
  switch (kind) {
    case 'success':
      return 'success';
    case 'info':
      return 'info';
    case 'greeting':
    case 'warning':
      return 'warning';
    case 'error':
    case 'confirm':
      return 'error';
    default:
      return 'primary';
  }
}

/*
 * Which notification the chat's bottom surface is announcing right now. Every item that arrives
 * (or is re-enqueued under the same id) is announced once: the highest-priority unannounced item
 * shows, as the toast while the chat is hidden or as the pill above it while it's open. A notice
 * without actions steps down after NOTICE_MS; one with actions stays until it's acted on or
 * dismissed. Stepping down only ends the announcement: the item stays in the store (and in the
 * panel's notification list) until the store dismisses it.
 */
export function useChatNotices() {
  const notificationCenter = useNotificationCenterStore();
  const { items, sortedItems } = storeToRefs(notificationCenter);

  const pending = ref<string[]>([]);
  const keyOf = (item: NotificationItem) => `${item.id}:${item.createdAt}`;

  watch(
    () => items.value.map(keyOf),
    (keys, oldKeys) => {
      const seen = new Set(oldKeys ?? []);
      const fresh = items.value.filter((item) => !seen.has(keyOf(item))).map((item) => item.id);
      const alive = new Set(items.value.map((item) => item.id));
      pending.value = [...pending.value.filter((id) => alive.has(id) && !fresh.includes(id)), ...fresh];
    },
    { immediate: true },
  );

  const notice = computed(() => sortedItems.value.find((item) => pending.value.includes(item.id)) ?? null);

  const drop = (id: string) => {
    pending.value = pending.value.filter((candidate) => candidate !== id);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(
    () => (notice.value ? keyOf(notice.value) : null),
    () => {
      clearTimeout(timer);
      const item = notice.value;
      if (item && !item.actions?.length) timer = setTimeout(() => drop(item.id), NOTICE_MS);
    },
    { immediate: true },
  );

  /** The chat changed between hidden and shown: passive notices end, actionable ones move across. */
  const dropPassive = () => {
    pending.value = pending.value.filter((id) => items.value.find((item) => item.id === id)?.actions?.length);
  };

  /** The user opened the notification list: nothing is left to announce. */
  const dropAll = () => {
    pending.value = [];
  };

  onScopeDispose(() => clearTimeout(timer));

  return { notice, dropPassive, dropAll };
}
