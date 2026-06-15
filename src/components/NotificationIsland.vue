<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import type { NotificationAction, NotificationItem, NotificationKind } from '@/stores/notificationCenter';

import type { CatchUpRenderItem } from '@/composables/useCatchUpSummary';
import { markCatchUpViewed, triggerCatchUpView } from '@/composables/useCatchUpSummary';

import { storeToRefs } from 'pinia';
import { useTheme } from 'vuetify';

import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { onClickOutside } from '@vueuse/core';

const IDLE_HIDE_DELAY = 5000;
// 55% into the 300 ms sling-in is the overshoot peak — fire expand here so the
// bounce energy carries directly into the panel opening.
const EXPAND_TRIGGER_MS = 165;

const notificationCenter = useNotificationCenterStore();
const { activeItem, isExpanded, queueCount, sortedItems } = storeToRefs(notificationCenter);
const theme = useTheme();
const isDarkMode = computed(() => theme.global.current.value.dark);

const rootEl = ref<HTMLElement>();
const innerEl = ref<HTMLElement>();
const dims = ref<{ width: number; height: number } | null>(null);
const ready = ref(false);
let resizeObserver: ResizeObserver | null = null;

// True while the sling-in animation is playing. Forces compact rendering so the
// shell always slings in as a pill regardless of store expanded state.
const isEnteringActive = ref(false);

// True during the 5 s idle window after the queue empties.
const isInIdleWindow = ref(false);
let hideTimerId: ReturnType<typeof setTimeout> | null = null;

const isVisible = computed(() => queueCount.value > 0 || isExpanded.value || isInIdleWindow.value);

// Use this instead of isExpanded in the template so content stays compact
// during the sling-in even when the store already has expanded = true.
const effectiveExpanded = computed(() => !isEnteringActive.value && isExpanded.value);

const contentKey = computed(() => {
  if (effectiveExpanded.value) return `expanded-${sortedItems.value.map((item) => item.id).join('-') || 'empty'}`;
  return `compact-${activeItem.value?.id ?? 'idle'}-${queueCount.value}`;
});

const shellStyle = computed(() =>
  dims.value
    ? {
        width: `${dims.value.width}px`,
        height: `${dims.value.height}px`,
      }
    : undefined,
);

function measure() {
  const el = innerEl.value;
  if (!el) return;
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (dims.value?.width === width && dims.value.height === height) return;
  dims.value = { width, height };
}

function startHideTimer() {
  if (hideTimerId !== null) clearTimeout(hideTimerId);
  isInIdleWindow.value = true;
  hideTimerId = setTimeout(() => {
    isInIdleWindow.value = false;
    hideTimerId = null;
  }, IDLE_HIDE_DELAY);
}

function cancelHideTimer() {
  if (hideTimerId !== null) {
    clearTimeout(hideTimerId);
    hideTimerId = null;
  }
  isInIdleWindow.value = false;
}

// Collapse and start idle timer when queue empties; cancel timer when queue fills.
watch([queueCount, isExpanded], ([count, expanded]) => {
  if (count === 0 && expanded) {
    notificationCenter.toggleExpanded(false);
  } else if (count === 0 && !expanded) {
    startHideTimer();
  } else {
    cancelHideTimer();
  }
});

function onEnter(el: Element, done: () => void) {
  const shell = el as HTMLElement;
  const needsExpand = isExpanded.value;
  isEnteringActive.value = true;

  nextTick(() => {
    measure();

    const animation = shell.animate(
      [
        { transform: 'translateX(-50%) scale(0.04)', opacity: '0' },
        { transform: 'translateX(-50%) scale(1.12)', opacity: '1', offset: 0.55 },
        { transform: 'translateX(-50%) scale(0.97)', offset: 0.78 },
        { transform: 'translateX(-50%) scale(1)', opacity: '1' },
      ],
      { duration: 300, easing: 'linear', fill: 'forwards' },
    );

    if (needsExpand) {
      // At the overshoot peak, switch to expanded content and let the CSS
      // width/height transition carry the panel open.
      setTimeout(() => {
        ready.value = true;
        isEnteringActive.value = false;
        nextTick(measure);
      }, EXPAND_TRIGGER_MS);
    }

    animation.onfinish = () => {
      animation.cancel();
      if (!needsExpand) isEnteringActive.value = false;
      ready.value = true;
      done();
    };
  });
}

function onLeave(el: Element, done: () => void) {
  const shell = el as HTMLElement;
  ready.value = false;

  // Animation is defined in CSS (.notification-shell--leaving). We only trigger
  // it and report completion. animationend also bubbles up from the inner text
  // fade, so finish on the shell's own animation.
  shell.classList.add('notification-shell--leaving');
  shell.addEventListener('animationend', (event) => {
    if (event.target === shell) done();
  });
}

function toggleIsland() {
  notificationCenter.toggleExpanded(!isExpanded.value);
}

function closeIsland() {
  notificationCenter.toggleExpanded(false);
}

function closeIslandFromOutside() {
  const item = activeItem.value;
  if (item?.kind === 'confirm') {
    notificationCenter.dismiss(item.id);
    notificationCenter.toggleExpanded(false);
    return;
  }
  closeIsland();
}

function onShellClick() {
  if (!effectiveExpanded.value) toggleIsland();
}

function onShellKeydown(event: KeyboardEvent) {
  if (effectiveExpanded.value) return;
  if (event.target !== event.currentTarget) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  toggleIsland();
}

function iconFor(kind?: NotificationKind): string {
  switch (kind) {
    case 'greeting':
      return 'mdi-weather-sunny';
    case 'success':
      return 'mdi-check-circle-outline';
    case 'warning':
    case 'confirm':
      return 'mdi-alert-circle-outline';
    case 'error':
      return 'mdi-alert-octagon-outline';
    case 'activity':
      return 'mdi-progress-clock';
    case 'catchup':
      return 'mdi-lightning-bolt';
    case 'info':
      return 'mdi-information-outline';
    default:
      return 'mdi-clock-outline';
  }
}

function compactText(item: NotificationItem | null): string {
  if (!item) return 'All done';
  return item.title;
}

function canQuickDismiss(item: NotificationItem): boolean {
  return item.kind !== 'catchup' && item.kind !== 'confirm';
}

function actionColor(action: NotificationAction): string | undefined {
  if (action.tone === 'danger') return 'error';
  if (action.tone === 'primary') return 'primary';
  return undefined;
}

function actionVariant(action: NotificationAction): 'text' | 'tonal' {
  return action.tone === 'default' || !action.tone ? 'text' : 'tonal';
}

function onCatchUpItemClick(item: NotificationItem) {
  const items = (item.payload?.items as CatchUpRenderItem[] | undefined) ?? [];
  if (!items.length) return;
  triggerCatchUpView(items);
  notificationCenter.dismiss(item.id);
  markCatchUpViewed();
}

watch(
  [contentKey, effectiveExpanded, queueCount],
  () => {
    nextTick(measure);
  },
  { flush: 'post' },
);

onMounted(() => {
  nextTick(measure);
  resizeObserver = new ResizeObserver(measure);
  if (innerEl.value) resizeObserver.observe(innerEl.value);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  cancelHideTimer();
  isEnteringActive.value = false;
});

onClickOutside(rootEl, () => {
  if (isExpanded.value) closeIslandFromOutside();
});
</script>

<template>
  <div ref="rootEl" class="notification-island-anchor" :class="{ 'notification-island-anchor--dark': isDarkMode }">
    <div v-if="isVisible" class="notification-slot" aria-hidden="true" />

    <Transition :css="false" @enter="onEnter" @leave="onLeave">
      <div
        v-if="isVisible"
        class="notification-shell"
        :class="{
          'notification-shell--ready': ready,
          'notification-shell--expanded': effectiveExpanded,
          'notification-shell--idle': !activeItem && !effectiveExpanded,
        }"
        :data-kind="activeItem?.kind ?? 'idle'"
        :style="shellStyle"
        :role="effectiveExpanded ? undefined : 'button'"
        :tabindex="effectiveExpanded ? undefined : 0"
        :aria-expanded="effectiveExpanded"
        aria-label="Notifications"
        @click="onShellClick"
        @keydown="onShellKeydown"
      >
        <div ref="innerEl" class="notification-inner">
          <div class="notification-content" :key="contentKey">
            <div v-if="!effectiveExpanded" class="island-compact">
              <VIcon :icon="iconFor(activeItem?.kind)" size="16" class="island-glyph" />
              <span class="island-compact-text">{{ compactText(activeItem) }}</span>
              <span v-if="queueCount > 1" class="island-count">{{ queueCount }}</span>
            </div>

            <section v-else class="island-panel" @click.stop>
            <header v-if="sortedItems.length > 1" class="island-panel-header">
              <div class="island-panel-title">
                Notifications
                <span class="island-panel-count">{{ queueCount }}</span>
              </div>
            </header>

            <div v-if="sortedItems.length" class="island-list">
              <article
                v-for="item in sortedItems"
                :key="item.id"
                class="island-item"
                :class="{ 'island-item--clickable': item.kind === 'catchup' }"
                :data-kind="item.kind"
                @click="item.kind === 'catchup' ? onCatchUpItemClick(item) : undefined"
              >
                <div class="island-item-head">
                  <span class="island-item-icon">
                    <VIcon :icon="iconFor(item.kind)" size="17" />
                  </span>

                  <div class="island-item-copy">
                    <div class="island-item-title">{{ item.title }}</div>
                    <div v-if="item.message" class="island-item-message">
                      {{ item.message }}
                    </div>
                  </div>

                  <VBtn
                    v-if="canQuickDismiss(item)"
                    icon="mdi-close"
                    size="x-small"
                    variant="text"
                    aria-label="Dismiss notification"
                    @click.stop="notificationCenter.dismiss(item.id)"
                  />
                </div>

                <p v-if="item.description && item.kind !== 'catchup'" class="island-description">{{ item.description }}</p>

                <div v-if="item.actions?.length" class="island-actions" @click.stop>
                  <VBtn
                    v-for="action in item.actions"
                    :key="action.id"
                    size="small"
                    class="island-action-btn text-none"
                    :variant="actionVariant(action)"
                    :color="actionColor(action)"
                    :loading="notificationCenter.isActionLoading(item.id, action.id)"
                    @click="notificationCenter.runAction(item.id, action.id)"
                  >
                    {{ action.label }}
                  </VBtn>
                </div>
              </article>
            </div>

            <div v-else class="island-empty">
              <VIcon icon="mdi-check-circle-outline" size="20" />
              <span>No notifications</span>
            </div>
          </section>
        </div>
      </div>
    </div>
    </Transition>
  </div>
</template>

<style scoped>
.notification-island-anchor {
  --island-header-bg: rgba(255, 255, 255, var(--glass-opacity-light, 0.83));
  --island-header-border: rgba(255, 255, 255, 0.7);
  --island-panel-bg: rgb(var(--v-theme-surface));
  --island-text: rgb(var(--v-theme-on-surface));
  --island-muted: rgba(var(--v-theme-on-surface), 0.62);
  --island-faint: rgba(var(--v-theme-on-surface), 0.38);
  --island-primary: rgb(var(--v-theme-primary));
  --island-primary-soft: rgba(var(--v-theme-primary), 0.12);
  --island-expanded-border: rgba(var(--v-theme-on-surface), 0.08);
  --island-expanded-shadow:
    0 4px 12px rgba(22, 44, 32, 0.08),
    0 14px 30px rgba(22, 44, 32, 0.12);
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 20;
  width: 0;
  height: 0;
  transform: translateX(-50%);
}

.notification-slot {
  position: absolute;
  top: -15px;
  left: 0;
  width: 196px;
  height: 30px;
  border-radius: 999px;
  transform: translateX(-50%);
  pointer-events: none;
}

.notification-shell {
  position: absolute;
  top: -15px;
  left: 0;
  overflow: hidden;
  cursor: pointer;
  color: var(--island-text);
  border: 1px solid var(--island-header-border);
  border-radius: 999px;
  background: var(--island-header-bg);
  box-shadow: none;
  transform: translateX(-50%);
  backdrop-filter: blur(var(--glass-blur, 25.6px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 25.6px));
}

.notification-shell--ready {
  transition:
    width 0.24s cubic-bezier(0.4, 1.02, 0.5, 1),
    height 0.24s cubic-bezier(0.4, 1.02, 0.5, 1),
    border-radius 0.2s ease,
    background 0.18s ease,
    box-shadow 0.2s ease;
}

.notification-shell--expanded {
  cursor: default;
  border-radius: 24px;
  border-color: var(--island-expanded-border);
  background: var(--island-panel-bg);
  box-shadow: var(--island-expanded-shadow);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.notification-shell--idle {
  border-color: var(--island-header-border);
  background: var(--island-header-bg);
  box-shadow: none;
  backdrop-filter: blur(var(--glass-blur, 25.6px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 25.6px));
}

/* Leave: text dismisses first, then the empty pill squishes to a circle and fades. */
.notification-shell--leaving {
  pointer-events: none;
  animation: island-shell-leave 720ms linear forwards;
}

.notification-shell--leaving .notification-inner {
  animation: island-text-leave 150ms ease-out forwards;
}

/* border-radius 50% = 98px/15px in element space; after scaleX(0.153) the
   visual radius is ~15px on each axis — a perfect circle. */
@keyframes island-shell-leave {
  0% {
    transform: translateX(-50%) scale(1);
    border-radius: 999px;
    opacity: 1;
  }
  /* hold the pill until the text has exited, then squish */
  28% {
    transform: translateX(-50%) scale(1);
    border-radius: 999px;
    opacity: 1;
    animation-timing-function: ease-out;
  }
  /* hold the circle so the two-step feel is clear */
  54% {
    transform: translateX(-50%) scaleX(0.153) scaleY(1);
    border-radius: 50%;
    opacity: 0.85;
  }
  78% {
    transform: translateX(-50%) scaleX(0.153) scaleY(1);
    border-radius: 50%;
    opacity: 0.85;
  }
  100% {
    transform: translateX(-50%) scaleX(0.153) scaleY(1);
    border-radius: 50%;
    opacity: 0;
  }
}

@keyframes island-text-leave {
  to {
    transform: translateY(-6px) scale(0.96);
    opacity: 0;
  }
}

.notification-inner {
  position: absolute;
  top: 0;
  left: 0;
  display: inline-block;
}

.notification-content {
  animation: island-pop 0.18s cubic-bezier(0.32, 1, 0.5, 1) both;
}

@keyframes island-pop {
  from {
    transform: translateY(5px) scale(0.985);
  }

  to {
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .notification-content {
    animation: none;
  }
}

.island-compact {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 196px;
  height: 30px;
  gap: 9px;
  padding: 6px 15px;
  white-space: nowrap;
}

.island-glyph {
  color: var(--island-primary);
}

.notification-shell--idle .island-glyph,
.notification-shell--idle .island-compact-text {
  color: var(--island-faint);
}

.island-compact-text {
  min-width: 0;
  overflow: hidden;
  color: var(--island-text);
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.island-count {
  display: inline-grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 999px;
  background: var(--island-primary);
  color: rgb(var(--v-theme-on-primary));
  font-size: 11px;
  font-weight: 700;
}

.island-panel {
  width: min(340px, calc(100vw - 24px));
  max-height: min(560px, calc(100vh - 86px));
  padding: 14px 16px;
  overflow-y: auto;
}

.island-panel-header {
  display: flex;
  align-items: center;
  padding: 1px 0 10px;
}

.island-panel-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--island-text);
  font-size: 14px;
  font-weight: 700;
}

.island-panel-count {
  display: inline-grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 999px;
  background: var(--island-primary-soft);
  color: var(--island-primary);
  font-size: 11.5px;
  font-weight: 700;
}

.island-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 0;
}

.island-item {
  border-radius: 7px;
  padding: 8px 0;
  background: transparent;
}

.island-item--clickable {
  cursor: pointer;
  border-radius: 7px;
  transition: background 0.12s ease;
}

.island-item--clickable:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.island-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.island-item-icon {
  display: grid;
  width: 20px;
  height: 20px;
  flex: none;
  place-items: center;
  color: var(--island-primary);
}

.island-item[data-kind='error'] .island-item-icon,
.island-item[data-kind='confirm'] .island-item-icon {
  color: rgb(var(--v-theme-error));
}

.island-item-copy {
  min-width: 0;
  flex: 1;
}

.island-item-title {
  color: var(--island-text);
  font-size: 13.5px;
  font-weight: 700;
  line-height: 1.25;
}

.island-item-message,
.island-description {
  color: var(--island-muted);
  font-size: 12.5px;
  line-height: 1.45;
}

.island-item-message {
  margin-top: 2px;
}

.island-description {
  margin: 8px 0 0;
}

.island-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.island-action-btn {
  letter-spacing: 0;
  text-transform: none;
}

.island-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 84px;
  color: var(--island-muted);
  font-size: 13px;
  font-weight: 600;
}


.notification-island-anchor--dark {
  --island-header-bg: rgba(28, 28, 28, var(--glass-opacity-dark, 0.77));
  --island-header-border: rgba(255, 255, 255, 0.06);
  --island-expanded-border: rgba(255, 255, 255, 0.08);
  --island-expanded-shadow:
    0 4px 12px rgba(0, 0, 0, 0.18),
    0 14px 28px rgba(0, 0, 0, 0.26);
}
</style>
