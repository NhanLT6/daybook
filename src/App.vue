<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import { useJira } from '@/composables/useJira';
import { useServerSettings } from '@/composables/useServerSettings';

import AppBackground from '@/components/AppBackground.vue';

import type { AppEvent } from '@/interfaces/Event';

import { useDisplay, useTheme } from 'vuetify';

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

// Single source of truth for all glass visuals — one slider drives both blur and opacity.
// opacity(light) = 0.48 + s*0.44 → 0.48 at 0, 0.83 at 0.8, 0.92 at 1.0
// opacity(dark)  = 0.42 + s*0.44 → 0.42 at 0, 0.77 at 0.8, 0.86 at 1.0
const glassStyle = computed(() => {
  const s = settingsStore.backgroundBlur;
  return {
    '--glass-blur': `${s * 32}px`,
    '--glass-opacity-light': `${0.48 + s * 0.44}`,
    '--glass-opacity-dark': `${0.42 + s * 0.44}`,
  };
});

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

const { smAndDown } = useDisplay();

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
  <VApp :style="glassStyle">
    <VAppBar height="53" class="elevation-0" color="transparent">
      <!-- Centered glass pill: brand + theme toggle + nav (desktop) / hamburger (mobile) -->
      <div class="dock-row">
        <nav class="app-dock glass-acrylic">
          <RouterLink v-if="route.path !== '/'" to="/" class="dock-brand dock-brand--link">Daybook</RouterLink>
          <span v-else class="dock-brand">Daybook</span>

          <span class="dock-spacer" />

          <VIconBtn :icon="themeIcon" size="small" variant="text" @click="toggleTheme" />

          <!-- Desktop nav links -->
          <VBtn
            v-for="(item, i) in navItems"
            :key="i"
            :active="item.to === route.path"
            class="text-none d-none d-sm-flex"
            v-bind="item"
            size="small"
          />

          <!-- Mobile hamburger menu -->
          <VMenu v-if="smAndDown" location="bottom end" :offset="8">
            <template #activator="{ props: menuProps }">
              <VBtn icon="mdi-menu" variant="text" size="small" v-bind="menuProps" />
            </template>

            <VList class="glass-acrylic" rounded="lg" min-width="160">
              <VListItem
                v-for="(item, i) in navItems"
                :key="i"
                :to="item.to"
                :active="item.to === route.path"
                rounded="lg"
              >
                <VListItemTitle>{{ item.text }}</VListItemTitle>
              </VListItem>
            </VList>
          </VMenu>
        </nav>
      </div>
    </VAppBar>

    <VMain style="overflow-y: auto">
      <Toaster position="bottom-center" rich-colors close-button />
      <RouterView />
      <AppBackground />
    </VMain>
  </VApp>
</template>

<style>
:root {
  --header-height: 56px;
  --nv-root-top: var(--header-height);
}

/* Let the custom backgrounds show through */
.v-theme--dark.v-application,
.v-theme--light.v-application {
  background: transparent !important;
}

/* App bar — transparent shell; the glass dock inside handles visuals */
.v-app-bar {
  border-bottom: none !important;
  box-shadow: none !important;
}

/* Strip VToolbar's built-in side padding so dock-row fills edge-to-edge */
.v-app-bar .v-toolbar__content,
.v-app-bar .v-toolbar__extension {
  padding: 0 !important;
}

/* Dock layout */
.dock-row {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 12px 12px 0;
}

.app-dock {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 2px;
  padding: 4px 8px;
  border-radius: 8px;
}

.dock-brand {
  font-size: 0.9375rem;
  font-weight: 600;
  padding: 4px 10px;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.dock-brand--link {
  text-decoration: none;
  color: inherit;
  border-radius: 4px;
  transition: opacity 0.15s;
}

.dock-brand--link:hover {
  opacity: 0.7;
}

/* Pushes brand left, actions right */
.dock-spacer {
  flex: 1;
}
</style>
