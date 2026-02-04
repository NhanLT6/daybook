<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import { useJira } from '@/composables/useJira';

import type { AppEvent } from '@/interfaces/Event';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import { fetchHolidays } from '@/apis/holidayApi';
import { storageKeys } from '@/common/storageKeys';
import { RouterView, useRoute } from 'vue-router';
import { toast, Toaster } from 'vue-sonner';

// Initialize events storage (holidays + custom events)
const events = useStorage<AppEvent[]>(storageKeys.events, []);

// Jira integration
const { syncTicketsToLocalStorage, shouldAutoSync } = useJira();

// Version tracking for release notifications
const lastSeenVersion = useStorage('app-last-seen-version', '');

/**
 * Auto-fetch VN holidays from Calendarific if not already cached for the current year.
 * Merges into the events array — never overwrites custom events.
 */
const autoFetchEvents = async () => {
  const currentYear = new Date().getFullYear();
  const hasHolidaysThisYear = events.value.some((e) => e.type === 'holiday' && e.date.startsWith(String(currentYear)));

  if (!hasHolidaysThisYear) {
    try {
      const holidays = await fetchHolidays(currentYear);
      events.value = [...events.value, ...holidays];
    } catch (error) {
      console.warn('Failed to fetch holidays from Calendarific:', error);
    }
  }
};

/**
 * Auto-sync Jira tickets if enabled and needed (once per day only)
 */
const autoSyncJiraTickets = async () => {
  if (shouldAutoSync()) {
    try {
      const { fetched, saved } = await syncTicketsToLocalStorage();
      toast.success(`Fetched ${fetched} ticket(s), saved ${saved} new ticket(s)`);
    } catch (error) {
      toast.error('Auto-sync Jira tickets failed', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
};

/**
 * Show release notification if app version has changed
 * Runs once on app mount
 */
const showReleaseNotification = () => {
  if (lastSeenVersion.value !== __APP_VERSION__) {
    toast.info('New Update', {
      description: __COMMIT_MESSAGE__,
      duration: 10000,
    });

    lastSeenVersion.value = __APP_VERSION__;
  }
};

// Initialize data on app mount
onMounted(async () => {
  await autoFetchEvents();
  await autoSyncJiraTickets();
  showReleaseNotification();
});

const route = useRoute();

// Theme toggle
const theme = useTheme();
const savedTheme = useStorage<'light' | 'dark'>('app-theme', 'light');

// Initialize theme from storage
theme.global.name.value = savedTheme.value;

const isDarkMode = computed(() => theme.global.name.value === 'dark');
const themeIcon = computed(() => (isDarkMode.value ? 'mdi-weather-sunny' : 'mdi-weather-night'));

const toggleTheme = () => {
  const newTheme = isDarkMode.value ? 'light' : 'dark';
  theme.global.name.value = newTheme;
  savedTheme.value = newTheme;
};

// Sync theme changes to storage
watch(
  () => theme.global.name.value,
  (newTheme) => {
    savedTheme.value = newTheme as 'light' | 'dark';
  },
);

const items = [
  { text: 'Home', to: '/' },
  { text: 'Tasks', to: '/task' },
  { text: 'Settings', to: '/setting' },
];
</script>

<template>
  <VApp>
    <VAppBar density="compact" class="elevation-0" color="page-background">
      <VAppBarTitle>Daybook</VAppBarTitle>

      <!-- Theme toggle button -->
      <VBtn :icon="themeIcon" variant="text" class="mr-2" @click="toggleTheme" />

      <VBtn
        v-for="(item, i) in items"
        :key="i"
        :active="item.to === route.path"
        class="me-2 text-none"
        v-bind="item"
        :to="item.to"
      />
    </VAppBar>

    <VMain>
      <Toaster position="bottom-center" rich-colors close-button />
      <RouterView />
    </VMain>
  </VApp>
</template>

<style>
:root {
  /* Your variables */
  --header-height: 80px;

  /* Add the top padding and place it below the header */
  --nv-root-top: var(--header-height);
}
</style>
