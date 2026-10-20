<script setup lang="ts">
import { computed } from 'vue';

import type { NotificationAction, NotificationItem, NotificationKind } from '@/stores/notificationCenter';

import dayjs from 'dayjs';

import { noticeColor } from '@/composables/useChatNotices';
import { useNotificationCenterStore } from '@/stores/notificationCenter';

/*
 * One notification as the chat's bottom surface shows it. `toast` and `pill` are a single line
 * (title, message, actions, dismiss); `row` is an entry in the open panel's notification list
 * and also shows the description and the time.
 */
const props = defineProps<{
  item: NotificationItem;
  variant: 'toast' | 'pill' | 'row';
}>();

const notificationCenter = useNotificationCenterStore();

const ICONS: Record<NotificationKind, string> = {
  greeting: 'mdi-weather-sunny',
  success: 'mdi-check-circle-outline',
  info: 'mdi-information-outline',
  warning: 'mdi-alert-circle-outline',
  confirm: 'mdi-alert-circle-outline',
  error: 'mdi-alert-octagon-outline',
  activity: 'mdi-progress-clock',
};

const color = computed(() => noticeColor(props.item.kind));
const isRow = computed(() => props.variant === 'row');
// A confirm is answered with its own buttons, so it has no quick dismiss
const canQuickDismiss = computed(() => props.item.kind !== 'confirm');

function actionColor(action: NotificationAction): string | undefined {
  if (action.tone === 'danger') return 'error';
  if (action.tone === 'primary') return 'primary';
  return undefined;
}
</script>

<template>
  <div class="notice" :class="`is-${variant}`" :data-kind="item.kind">
    <VIcon :icon="ICONS[item.kind]" :color="color" :size="isRow ? 18 : 19" class="notice-icon" />

    <!-- Title and message: one ellipsised line in the toast and pill, wrapping in the list -->
    <div class="notice-copy">
      <span class="notice-title">{{ item.title }}</span>
      <span v-if="item.message" class="notice-message">{{ item.message }}</span>
      <p v-if="isRow && item.description" class="notice-description">{{ item.description }}</p>
    </div>

    <time v-if="isRow" class="notice-time">{{ dayjs(item.createdAt).format('HH:mm') }}</time>

    <div v-if="item.actions?.length" class="notice-actions">
      <VBtn
        v-for="action in item.actions"
        :key="action.id"
        size="small"
        rounded="pill"
        class="notice-action text-none"
        :variant="action.tone && action.tone !== 'default' ? 'tonal' : 'text'"
        :color="actionColor(action)"
        :loading="notificationCenter.isActionLoading(item.id, action.id)"
        @click.stop="notificationCenter.runAction(item.id, action.id)"
      >
        {{ action.label }}
      </VBtn>
    </div>

    <button
      v-if="canQuickDismiss"
      type="button"
      class="notice-dismiss"
      aria-label="Dismiss notification"
      @click.stop="notificationCenter.dismiss(item.id)"
    >
      <VIcon icon="mdi-close" size="16" />
    </button>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-size: 13px;
  line-height: 18px;
}

.notice-icon {
  flex: none;
}

.notice-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.notice-title {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.notice-message {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.notice-actions {
  display: flex;
  gap: 4px;
  flex: none;
}
.notice-action {
  letter-spacing: 0;
}

.notice-dismiss {
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: none;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
  cursor: pointer;
}
.notice-dismiss:hover {
  background: var(--chat-tile);
  color: rgb(var(--v-theme-on-surface));
}

/* List row: wraps, with the time on the right and actions under the text */
.notice.is-row {
  flex-wrap: wrap;
  align-items: flex-start;
  padding: 8px 6px 8px 10px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--chat-line);
}
.is-row .notice-icon {
  margin-top: 1px;
}
.is-row .notice-copy {
  flex-direction: column;
  gap: 2px;
  white-space: normal;
}
.is-row .notice-title {
  flex: initial;
}
.is-row .notice-message,
.notice-description {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.notice-description {
  margin: 4px 0 0;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.notice-time {
  flex: none;
  margin-top: 1px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}
.is-row .notice-dismiss {
  margin-top: -5px;
}
.is-row .notice-actions {
  order: 1;
  flex-basis: 100%;
  justify-content: flex-end;
  padding-right: 4px;
}
</style>
