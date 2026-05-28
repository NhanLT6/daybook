<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import DOMPurify from 'dompurify';
import dayjs from 'dayjs';
import { marked } from 'marked';

import { useCatchUpSummary } from '@/composables/useCatchUpSummary';
import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';

const settingsStore = useSettingsStore();
const { isVisible, contentState, summary, runFlow, dismiss, show, retry } = useCatchUpSummary();

// ── Visual states ──────────────────────────────────────────────────────────

const isExpanded = ref(true);
const isPinned = ref(false);

// ── Greetings ──────────────────────────────────────────────────────────────

const GREETINGS = [
  "Let's see where you left off...",
  'Morning! Checking your recent work...',
  'Ready for your standup? Gathering your logs...',
  "Here's what you've been up to...",
  'Let me pull up your recent activity...',
];

const greetingText = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

// ── Hover logic ────────────────────────────────────────────────────────────

function handleMouseEnter() {
  isExpanded.value = true;
  clearCompactTimer();
}

function handleMouseLeave() {
  if (!isPinned.value) {
    isExpanded.value = false;
  }
}

function togglePin() {
  isPinned.value = !isPinned.value;
}

function handleClose() {
  isExpanded.value = false;
  isPinned.value = false;
  dismiss();
}

// ── Auto-compact after result/error ───────────────────────────────────────

let compactTimer: ReturnType<typeof setTimeout> | null = null;

function clearCompactTimer() {
  if (compactTimer) {
    clearTimeout(compactTimer);
    compactTimer = null;
  }
}

watch(contentState, (state) => {
  if (state === 'ready' || state === 'error') {
    clearCompactTimer();
    compactTimer = setTimeout(() => {
      if (!isPinned.value) {
        isExpanded.value = false;
      }
    }, 3000);
  }
});

// ── Re-trigger when user configures AI for the first time ─────────────────

watch(
  () => settingsStore.geminiConfig.enabled && !!settingsStore.geminiConfig.apiKey,
  (isNowConfigured, wasConfigured) => {
    if (isNowConfigured && !wasConfigured) {
      show();
      isExpanded.value = true;
      runFlow();
    }
  },
);

// ── Last-log date for header ───────────────────────────────────────────────

const lastLogDate = computed(() => {
  const lastFetchedAt = localStorage.getItem(storageKeys.catchUp.lastFetchedAt);
  if (lastFetchedAt) {
    const d = dayjs(lastFetchedAt).subtract(1, 'day');
    return d.format('ddd DD MMM');
  }
  for (let i = 1; i <= 14; i++) {
    const d = dayjs().subtract(i, 'day');
    const testDate = d.format('YYYY-MM-DD');
    const monthKey = `timeLogs-${d.format('YYYY-MM')}`;
    const stored = localStorage.getItem(monthKey);
    if (stored) {
      try {
        const logs = JSON.parse(stored) as Array<{ date: string }>;
        if (logs.some((l) => l.date === testDate)) {
          return d.format('ddd DD MMM');
        }
      } catch {
        // ignore
      }
    }
  }
  return dayjs().subtract(1, 'day').format('ddd DD MMM');
});

// ── Markdown rendering ────────────────────────────────────────────────────

const renderedSummary = computed(() => {
  if (!summary.value) return '';
  const html = marked(summary.value) as string;
  return DOMPurify.sanitize(html);
});

// ── Mount / Unmount ────────────────────────────────────────────────────────

onMounted(() => {
  if (isVisible.value) {
    runFlow();
  }
});

onUnmounted(clearCompactTimer);
</script>

<template>
  <Transition name="widget-slide">
    <div
      v-if="isVisible"
      class="catchup-widget glass-acrylic"
      :class="{ 'catchup-widget--collapsed': !isExpanded }"
      role="complementary"
      aria-label="Catch up summary"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <!-- Content area (expands upward) -->
      <div class="content-area" :class="{ 'content-area--expanded': isExpanded }">
        <div class="content-inner pa-4">
          <!-- Greeting state -->
          <div v-if="contentState === 'greeting'" class="state-message">
            <VIcon icon="mdi-coffee-outline" class="mr-2 text-medium-emphasis" size="18" />
            <span class="text-medium-emphasis text-body-2">{{ greetingText }}</span>
          </div>

          <!-- Preparing state -->
          <div v-else-if="contentState === 'preparing'" class="state-message">
            <VProgressCircular indeterminate size="16" width="2" color="primary" class="mr-2" />
            <span class="text-medium-emphasis text-body-2">Gathering your logs...</span>
          </div>

          <!-- Error state -->
          <div v-else-if="contentState === 'error'" class="state-message">
            <VIcon icon="mdi-alert-circle-outline" class="mr-2 text-error" size="18" />
            <span class="text-medium-emphasis text-body-2">Couldn't load summary.</span>
            <VBtn size="x-small" variant="text" color="primary" class="ml-2" @click="retry">Retry</VBtn>
          </div>

          <!-- Ready state: rendered markdown -->
          <div
            v-else-if="contentState === 'ready'"
            class="summary-content text-body-2"
            v-html="renderedSummary"
          />
        </div>
      </div>

      <!-- Header row (always visible) -->
      <div class="header-row">
        <VIcon icon="mdi-lightning-bolt" size="12" class="mr-1 text-primary" />
        <span class="header-text">Catch up · {{ lastLogDate }}</span>
        <VSpacer />

        <!-- Pin button: only visible when expanded -->
        <Transition name="icon-fade">
          <button
            v-if="isExpanded"
            class="icon-btn"
            :class="{ 'icon-btn--active': isPinned }"
            :title="isPinned ? 'Unpin' : 'Pin open'"
            @click.stop="togglePin"
          >
            <VIcon
              :icon="isPinned ? 'mdi-pin' : 'mdi-pin-outline'"
              size="14"
              :color="isPinned ? 'primary' : undefined"
            />
          </button>
        </Transition>

        <!-- Chevron (collapsed) ↔ Close (expanded) with transition -->
        <Transition name="icon-swap" mode="out-in">
          <button
            v-if="isExpanded"
            key="close"
            class="icon-btn"
            title="Dismiss"
            @click.stop="handleClose"
          >
            <VIcon icon="mdi-close" size="14" />
          </button>
          <button
            v-else
            key="chevron"
            class="icon-btn"
            title="Expand"
            @click.stop="isExpanded = true"
          >
            <VIcon icon="mdi-chevron-up" size="14" />
          </button>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Widget container ───────────────────────────────────────────────────── */
.catchup-widget {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 480px;
  max-width: calc(100vw - 32px);
  border-radius: 12px 12px 0 0;
  z-index: 200;
  overflow: hidden;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.12), 0 -1px 6px rgba(0, 0, 0, 0.06);
}

/* ── Mount animation (slides up from below) ─────────────────────────────── */
.widget-slide-enter-active {
  transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.widget-slide-leave-active {
  transition: transform 0.25s ease-in;
}
.widget-slide-enter-from,
.widget-slide-leave-to {
  transform: translateX(-50%) translateY(100%);
}

/* ── Content area (expand/collapse) ─────────────────────────────────────── */
.content-area {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.45s ease-out;
}

.content-area--expanded {
  max-height: 360px;
  overflow-y: auto;
  transition: max-height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.content-inner {
  transform: translateY(12px);
  opacity: 0;
  transition:
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}

.content-area--expanded .content-inner {
  transform: translateY(0);
  opacity: 1;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.header-row {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  user-select: none;
  min-height: 36px;
  gap: 2px;
  transition:
    min-height 0.3s ease,
    padding 0.3s ease;
}

/* Compact collapsed strip */
.catchup-widget--collapsed .header-row {
  padding: 3px 10px;
  min-height: 0;
  cursor: pointer;
}

.header-text {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.01em;
  opacity: 0.85;
  white-space: nowrap;
}

/* ── Icon buttons ─────────────────────────────────────────────────────────── */
.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: inherit;
  opacity: 0.55;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.icon-btn:hover {
  opacity: 1;
}

.icon-btn--active {
  opacity: 0.9;
}

/* ── Icon transitions ─────────────────────────────────────────────────────── */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

.icon-fade-enter-active,
.icon-fade-leave-active {
  transition: opacity 0.2s ease;
}
.icon-fade-enter-from,
.icon-fade-leave-to {
  opacity: 0;
}

/* ── State message rows ──────────────────────────────────────────────────── */
.state-message {
  display: flex;
  align-items: center;
  min-height: 32px;
}

/* ── Summary markdown ────────────────────────────────────────────────────── */
.summary-content :deep(h2) {
  font-size: 0.8125rem;
  font-weight: 600;
  margin: 0 0 4px;
  opacity: 0.9;
}

.summary-content :deep(ul) {
  margin: 0 0 10px;
  padding-left: 18px;
}

.summary-content :deep(li) {
  margin-bottom: 2px;
  line-height: 1.5;
  opacity: 0.85;
}

.summary-content :deep(h2:first-child) {
  margin-top: 0;
}

.summary-content :deep(h2 + ul),
.summary-content :deep(h2 ~ ul) {
  margin-top: 2px;
}
</style>
