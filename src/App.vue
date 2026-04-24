<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import { useJira } from '@/composables/useJira';
import { useServerSettings } from '@/composables/useServerSettings';

import DawnBackground from '@/components/DawnBackground.vue';
import NightSkyBackground from '@/components/NightSkyBackground.vue';

import type { AppEvent } from '@/interfaces/Event';

import { useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import { fetchHolidays } from '@/apis/holidayApi';
import { storageKeys } from '@/common/storageKeys';
import { useSettingsStore } from '@/stores/settings';
import { RouterView, useRoute } from 'vue-router';
import { toast, Toaster } from 'vue-sonner';

const events = useStorage<AppEvent[]>(storageKeys.events, []);
const { syncTicketsToLocalStorage, shouldAutoSync } = useJira();
const lastSeenVersion = useStorage('app-last-seen-version', '');
const settingsStore = useSettingsStore();
const { loadSettings, migrateJiraFromLocalStorage } = useServerSettings();

const autoFetchEvents = async () => {
  const currentYear = new Date().getFullYear();
  const hasHolidaysThisYear = events.value.some((e) => e.type === 'holiday' && e.date.startsWith(String(currentYear)));
  if (!hasHolidaysThisYear) {
    const holidays = await fetchHolidays(currentYear);
    events.value = [...events.value, ...holidays];
  }
};

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

const showReleaseNotification = () => {
  if (lastSeenVersion.value !== __APP_VERSION__) {
    toast.info('New Update', { description: __COMMIT_MESSAGE__, duration: 10000 });
    lastSeenVersion.value = __APP_VERSION__;
  }
};

/**
 * Load server-side settings (Gemini + Jira) on app mount.
 * Also handles one-time migration of Jira config from localStorage.
 */
const initServerSettings = async () => {
  const serverSettings = await loadSettings();
  if (!serverSettings) return; // silently fail — server may be unreachable locally

  const jiraConfig = await migrateJiraFromLocalStorage(settingsStore.jiraConfig, serverSettings);
  settingsStore.populateFromServer(jiraConfig, serverSettings.geminiConfig);
};

onMounted(async () => {
  await initServerSettings();
  await autoFetchEvents();
  await autoSyncJiraTickets();
  showReleaseNotification();
});

const route = useRoute();

// Theme toggle
const theme = useTheme();
const savedTheme = useStorage<'light' | 'dark'>('app-theme', 'light');
theme.global.name.value = savedTheme.value;

const isDarkMode = computed(() => theme.global.name.value === 'dark');
const themeIcon = computed(() => (isDarkMode.value ? 'mdi-weather-sunny' : 'mdi-weather-night'));

const toggleTheme = () => {
  const newTheme = isDarkMode.value ? 'light' : 'dark';
  theme.global.name.value = newTheme;
  savedTheme.value = newTheme;
};

watch(
  () => theme.global.name.value,
  (newTheme) => {
    savedTheme.value = newTheme as 'light' | 'dark';
  },
);

const navItems = [
  { text: 'Home', to: '/' },
  { text: 'Tasks', to: '/task' },
  { text: 'Events', to: '/events' },
  { text: 'Settings', to: '/setting' },
];
</script>

<template>
  <VApp>
    <VAppBar density="compact" class="elevation-0" color="transparent">
      <VAppBarTitle>Daybook</VAppBarTitle>

      <VBtn :icon="themeIcon" variant="text" class="mr-2" size="36" @click="toggleTheme" />

      <VBtn
        v-for="(item, i) in navItems"
        :key="i"
        :active="item.to === route.path"
        class="me-2 text-none"
        v-bind="item"
        :to="item.to"
      />
    </VAppBar>

    <VMain style="overflow-y: auto">
      <Toaster position="bottom-center" rich-colors close-button />
      <RouterView />
      <NightSkyBackground v-if="isDarkMode" />
      <DawnBackground v-else />
    </VMain>
  </VApp>
</template>

<style>
:root {
  --header-height: 80px;
  --nv-root-top: var(--header-height);
}

/* Let the custom backgrounds show through */
.v-theme--dark.v-application,
.v-theme--light.v-application {
  background: transparent !important;
}

/* Glassmorphism — dark mode */
.v-theme--dark .v-card {
  background: rgba(28, 28, 28, 0.58) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
}

.v-theme--dark .glass-header {
  background: rgba(28, 28, 28, 0.72) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* App bar — blends into the page, no visual separation from content */
.v-app-bar {
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  border-bottom: none !important;
  box-shadow: none !important;
}

/* Glassmorphism — light mode */
.v-theme--light .v-card {
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.7) !important;
}

.v-theme--light .glass-header {
  background: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
</style>
