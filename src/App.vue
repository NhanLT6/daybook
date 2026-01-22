<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import { useJira } from '@/composables/useJira';

import type { Holiday } from '@/apis/holidayApi';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import { fetchVnHolidays } from '@/apis/holidayApi';
import { storageKeys } from '@/common/storageKeys';
import { RouterView, useRoute } from 'vue-router';
import { toast, Toaster } from 'vue-sonner';

// Initialize holidays for current year
const holidays = useStorage<Holiday[]>(storageKeys.holidays, []);

// Jira integration
const { syncTicketsToLocalStorage, shouldAutoSync } = useJira();

// Version tracking for release notifications
const lastSeenVersion = useStorage('app-last-seen-version', '');

/**
 * Auto-fetch VN holidays if not already cached for the current year
 * Runs once on app mount
 */
const autoFetchHolidays = async () => {
  if (holidays.value.length === 0) {
    try {
      holidays.value = await fetchVnHolidays();
    } catch (error) {
      console.warn('Failed to fetch holidays:', error);
      holidays.value = [];
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
  await autoFetchHolidays();
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
    <VAppBar>
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
      <div class="pa-4">
        <Toaster position="bottom-center" rich-colors close-button />
        <RouterView />
      </div>
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
