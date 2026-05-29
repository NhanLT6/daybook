import { computed, ref } from 'vue';

import { defineStore } from 'pinia';
import { nanoid } from 'nanoid';

export type NotificationKind =
  | 'greeting'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'confirm'
  | 'activity'
  | 'catchup';

export interface NotificationAction {
  id: string;
  label: string;
  tone?: 'default' | 'primary' | 'danger';
  closeOnComplete?: boolean;
  onClick?: () => void | Promise<void>;
}

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  description?: string;
  createdAt: number;
  priority?: number;
  autoDismissMs?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  payload?: Record<string, unknown>;
}

type NotificationInput = Omit<NotificationItem, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: number;
};

export type NotificationOptions = Omit<NotificationInput, 'kind' | 'title'>;

const DEFAULT_PRIORITIES: Record<NotificationKind, number> = {
  confirm: 90,
  error: 80,
  catchup: 70,
  activity: 60,
  greeting: 50,
  warning: 45,
  success: 40,
  info: 30,
};

const DEFAULT_AUTO_DISMISS_MS: Partial<Record<NotificationKind, number>> = {
  greeting: 4200,
  success: 3000,
  info: 4000,
  warning: 5000,
};

const PERSISTENT_KINDS = new Set<NotificationKind>(['activity', 'catchup', 'confirm', 'error']);

export const useNotificationCenterStore = defineStore('notificationCenter', () => {
  const items = ref<NotificationItem[]>([]);
  const isExpanded = ref(false);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const actionLoadingKeys = ref<Set<string>>(new Set());

  const sortedItems = computed(() =>
    [...items.value].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt - a.createdAt;
    }),
  );

  const activeItem = computed(() => sortedItems.value[0] ?? null);
  const queueCount = computed(() => items.value.length);

  function actionKey(itemId: string, actionId: string): string {
    return `${itemId}:${actionId}`;
  }

  function setActionLoading(itemId: string, actionId: string, isLoading: boolean) {
    const next = new Set(actionLoadingKeys.value);
    const key = actionKey(itemId, actionId);
    if (isLoading) next.add(key);
    else next.delete(key);
    actionLoadingKeys.value = next;
  }

  function isActionLoading(itemId: string, actionId: string): boolean {
    return actionLoadingKeys.value.has(actionKey(itemId, actionId));
  }

  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (!timer) return;
    clearTimeout(timer);
    timers.delete(id);
  }

  function scheduleAutoDismiss(item: NotificationItem) {
    clearTimer(item.id);
    if (item.persistent || !item.autoDismissMs || item.autoDismissMs <= 0) return;
    timers.set(
      item.id,
      setTimeout(() => {
        dismiss(item.id);
      }, item.autoDismissMs),
    );
  }

  function normalize(input: NotificationInput): NotificationItem {
    const hasActions = !!input.actions?.length;
    const persistent = PERSISTENT_KINDS.has(input.kind) || hasActions || input.persistent === true;

    return {
      ...input,
      id: input.id ?? nanoid(),
      createdAt: input.createdAt ?? Date.now(),
      priority: input.priority ?? DEFAULT_PRIORITIES[input.kind],
      persistent,
      autoDismissMs: persistent ? undefined : input.autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS[input.kind],
    };
  }

  function enqueue(input: NotificationInput): string {
    const item = normalize(input);
    const existingIndex = items.value.findIndex((candidate) => candidate.id === item.id);
    if (existingIndex >= 0) {
      clearTimer(item.id);
      items.value[existingIndex] = item;
    } else {
      items.value = [...items.value, item];
    }
    scheduleAutoDismiss(item);
    if (item.kind === 'confirm') isExpanded.value = true;
    return item.id;
  }

  function notify(kind: NotificationKind, title: string, options: NotificationOptions = {}): string {
    return enqueue({ ...options, kind, title });
  }

  function greeting(title: string, options?: NotificationOptions): string {
    return notify('greeting', title, options);
  }

  function success(title: string, options?: NotificationOptions): string {
    return notify('success', title, options);
  }

  function info(title: string, options?: NotificationOptions): string {
    return notify('info', title, options);
  }

  function warning(title: string, options?: NotificationOptions): string {
    return notify('warning', title, options);
  }

  function error(title: string, options?: NotificationOptions): string {
    return notify('error', title, options);
  }

  function confirm(title: string, options?: NotificationOptions): string {
    return notify('confirm', title, options);
  }

  function activity(title: string, options?: NotificationOptions): string {
    return notify('activity', title, options);
  }

  function catchup(title: string, options?: NotificationOptions): string {
    return notify('catchup', title, options);
  }

  function dismiss(id: string) {
    clearTimer(id);
    items.value = items.value.filter((item) => item.id !== id);
    if (!items.value.length) isExpanded.value = false;
  }

  function clear() {
    timers.forEach(clearTimeout);
    timers.clear();
    items.value = [];
    isExpanded.value = false;
    actionLoadingKeys.value = new Set();
  }

  function toggleExpanded(force?: boolean) {
    isExpanded.value = force ?? !isExpanded.value;
  }

  async function runAction(itemId: string, actionId: string) {
    const item = items.value.find((candidate) => candidate.id === itemId);
    const action = item?.actions?.find((candidate) => candidate.id === actionId);
    if (!item || !action || isActionLoading(itemId, actionId)) return;
    const shouldCollapseAfterConfirm = item.kind === 'confirm';

    setActionLoading(itemId, actionId, true);
    try {
      await action.onClick?.();
      if (action.closeOnComplete) {
        dismiss(itemId);
        if (shouldCollapseAfterConfirm && activeItem.value?.kind !== 'confirm') {
          isExpanded.value = false;
        }
      }
    } finally {
      setActionLoading(itemId, actionId, false);
    }
  }

  return {
    items,
    sortedItems,
    activeItem,
    queueCount,
    isExpanded,
    enqueue,
    greeting,
    success,
    info,
    warning,
    error,
    confirm,
    activity,
    catchup,
    dismiss,
    clear,
    runAction,
    toggleExpanded,
    isActionLoading,
  };
});
