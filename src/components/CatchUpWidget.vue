<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import DOMPurify from 'dompurify';
import dayjs from 'dayjs';
import { marked } from 'marked';

import { useCatchUpSummary } from '@/composables/useCatchUpSummary';
import { storageKeys } from '@/common/storageKeys';
import { useRouter } from 'vue-router';

const router = useRouter();
const { isVisible, contentState, summary, runFlow, dismiss, startAutoCloseTimer, clearAutoCloseTimer, retry } =
  useCatchUpSummary();

// ── Expand / collapse ─────────────────────────────────────────────────────

const isExpanded = ref(false);

function expand() {
  isExpanded.value = true;
  clearAutoCloseTimer();
}

function collapse() {
  isExpanded.value = false;
  startAutoCloseTimer();
}

function handleClose() {
  isExpanded.value = false;
  dismiss();
}

function toggleExpand() {
  if (isExpanded.value) {
    collapse();
  } else {
    expand();
  }
}

// ── Last-log date for header hint ─────────────────────────────────────────

const lastLogDate = computed(() => {
  const lastFetchedAt = localStorage.getItem(storageKeys.catchUp.lastFetchedAt);
  if (lastFetchedAt) {
    const d = dayjs(lastFetchedAt).subtract(1, 'day');
    return d.format('ddd DD MMM');
  }
  // Fallback: scan for most recent date with logs
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

// ── Mount: run state flow ─────────────────────────────────────────────────

onMounted(() => {
  if (isVisible.value) {
    runFlow();
  }
});
</script>

<template>
  <Transition name="widget-slide">
    <div
      v-if="isVisible"
      class="catchup-widget glass-acrylic"
      role="complementary"
      aria-label="Catch up summary"
    >
      <!-- Content area (expands upward) -->
      <div class="content-area" :class="{ 'content-area--expanded': isExpanded }">
        <div class="content-inner pa-4">
          <!-- Greeting state -->
          <div v-if="contentState === 'greeting'" class="state-message">
            <VIcon icon="mdi-coffee-outline" class="mr-2 text-medium-emphasis" size="18" />
            <span class="text-medium-emphasis text-body-2">Let's see where you left off...</span>
          </div>

          <!-- Preparing state -->
          <div v-else-if="contentState === 'preparing'" class="state-message">
            <VProgressCircular indeterminate size="16" width="2" color="primary" class="mr-2" />
            <span class="text-medium-emphasis text-body-2">Gathering your logs...</span>
          </div>

          <!-- Unconfigured state -->
          <div v-else-if="contentState === 'unconfigured'" class="state-message">
            <VIcon icon="mdi-robot-outline" class="mr-2 text-medium-emphasis" size="18" />
            <span class="text-medium-emphasis text-body-2">
              AI isn't set up yet.
              <a class="text-primary text-decoration-none cursor-pointer" @click="router.push('/setting')">
                Go to Settings →
              </a>
            </span>
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
      <div class="header-row" @click="toggleExpand">
        <VIcon icon="mdi-lightning-bolt" size="14" class="mr-1 text-primary" />
        <span class="header-text text-caption font-weight-medium">
          Catch up ↑ · {{ lastLogDate }}
        </span>
        <VSpacer />
        <VBtn
          v-if="isExpanded"
          icon="mdi-close"
          size="x-small"
          variant="text"
          density="compact"
          class="close-btn"
          @click.stop="handleClose"
        />
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
  /* expand: spring bounce; collapse: calm ease-out */
  transition: max-height 0.45s ease-out;
}

.content-area--expanded {
  max-height: 360px;
  overflow-y: auto;
  /* spring curve only on expand (set via JS class toggle timing) */
  transition: max-height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.content-inner {
  /* Slide up with spring on expand */
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
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  min-height: 36px;
  transition: opacity 0.15s ease;
}

.header-row:hover {
  opacity: 0.8;
}

.header-text {
  letter-spacing: 0.01em;
  opacity: 0.85;
}

.close-btn {
  opacity: 0.6;
}
.close-btn:hover {
  opacity: 1;
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
