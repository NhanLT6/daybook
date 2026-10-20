<script setup lang="ts">
import { computed, provide, ref } from 'vue';

import { LIST_SCROLLED_KEY } from '@/components/listPanelKeys';

import { useScroll } from '@vueuse/core';

// Shared shell for the list pages (Logs, Tasks, Events): one toolbar row — title + count,
// optional search, filter slot, right-aligned actions — over a scrolling body. Pages bring
// their own body (usually a GroupedTable) so every list reads the same.
const { title, count, searchPlaceholder } = defineProps<{
  title: string;
  count?: number;
  // Shows the search field when set
  searchPlaceholder?: string;
}>();

const search = defineModel<string>('search', { default: '' });

// The scrolling body, for callers that scroll a row into view
const body = ref<HTMLElement | null>(null);
defineExpose({ body });

// Lets sticky column titles (GroupedTable) take a fill only once rows scroll under them
const { y: scrollTop } = useScroll(body);
provide(
  LIST_SCROLLED_KEY,
  computed(() => scrollTop.value > 0),
);
</script>

<template>
  <section class="list-panel">
    <!-- Toolbar: title + count, search, filters, then actions on the right; wraps on phones -->
    <div class="list-toolbar">
      <div class="list-toolbar__heading">
        <h3 class="list-toolbar__title">{{ title }}</h3>
        <span v-if="count !== undefined" class="list-toolbar__count">{{ count }}</span>
      </div>

      <div v-if="searchPlaceholder" class="list-search">
        <VTextField
          v-model="search"
          :placeholder="searchPlaceholder"
          prepend-inner-icon="mdi-magnify"
          variant="solo"
          flat
          density="compact"
          hide-details
          single-line
          clearable
          class="list-search__field"
          @click:clear="search = ''"
        />
      </div>

      <slot name="filters" />

      <VSpacer />

      <div class="list-toolbar__actions">
        <slot name="actions" />
      </div>
    </div>

    <!-- Body: owns the scroll so the toolbar stays put -->
    <div ref="body" class="list-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.list-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.list-panel__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.list-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px 8px 20px;
}

.list-toolbar__heading {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-right: 10px;
  white-space: nowrap;
}

.list-toolbar__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}

.list-toolbar__count {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

.list-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Shared look for toolbar buttons placed in the slots: compact, no caps */
.list-toolbar :deep(.v-btn) {
  letter-spacing: normal;
  text-transform: none;
}

.list-search {
  flex: 1 1 260px;
  min-width: 120px;
  max-width: 280px;
}

/* 32px tall, softly tinted: out-specifies .glass-acrylic .v-field's solid surface */
.list-search__field :deep(.v-field) {
  background-color: rgba(var(--v-theme-on-surface), 0.05) !important;
  border-radius: 12px;
  min-height: 32px;
  font-size: 0.8125rem;
}

.list-search__field :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
}

.list-search__field :deep(.v-field__prepend-inner) {
  padding-inline-start: 2px;
}

.list-search__field :deep(.v-field__prepend-inner .v-icon) {
  font-size: 18px;
}
</style>
