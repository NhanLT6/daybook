<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';

import { useAuth } from '@/composables/useAuth';
import { useAuthDialog } from '@/composables/useAuthDialog';
import { useEvents } from '@/composables/useEvents';
import { useGreetingNotifications } from '@/composables/useGreetingNotifications';
import { useInsightsDrawer } from '@/composables/useInsightsDrawer';
import { useJira } from '@/composables/useJira';
import { useServerSettings } from '@/composables/useServerSettings';

import AppBackground from '@/components/AppBackground.vue';
import AuthMenu from '@/components/AuthMenu.vue';
import ChatBar from '@/components/ChatBar.vue';

import { useDisplay, useTheme } from 'vuetify';

import { useStorage } from '@vueuse/core';

import { fetchHolidays } from '@/apis/holidayApi';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { useSettingsStore } from '@/stores/settings';
import { RouterView, useRoute } from 'vue-router';

const { events, addEvent, replaceAll, ready } = useEvents();
const { isAuthenticated, isAuthConfigured, user, signOut, ready: authReady } = useAuth();
const { openAuthDialog } = useAuthDialog();

const userInitial = computed(() => (user.value?.name || user.value?.email || '?').slice(0, 1).toUpperCase());
const { syncTicketsToLocalStorage, shouldAutoSync } = useJira();
const { startGreetingNotifications } = useGreetingNotifications();
const settingsStore = useSettingsStore();
const notificationCenter = useNotificationCenterStore();
const { loadSettings, migrateJiraFromLocalStorage } = useServerSettings();
let stopGreetingNotifications: (() => void) | undefined;

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
  await ready;
  const currentYear = new Date().getFullYear();
  const holidaysThisYear = events.value.filter((e) => e.type === 'holiday' && e.date.startsWith(String(currentYear)));
  if (!holidaysThisYear.length) {
    const holidays = await fetchHolidays(currentYear);
    // fetchHolidays swallows API failures and returns [] — rewriting the collection
    // with nothing new to add would be a pure risk to the user's own events.
    if (holidays.length) await replaceAll([...events.value, ...holidays]);
    return;
  }

  // Holidays saved before the dayOff flag count every observance as a day off; fetch once more to
  // learn which ones are, and patch only that flag so any edits to the events stay.
  if (holidaysThisYear.every((e) => e.dayOff === undefined)) {
    const dayOffById = new Map((await fetchHolidays(currentYear)).map((h) => [h.id, h.dayOff]));
    for (const event of holidaysThisYear) {
      const dayOff = dayOffById.get(event.id);
      if (dayOff !== undefined) await addEvent({ ...event, dayOff });
    }
  }
};

const autoSyncJiraTickets = async () => {
  if (shouldAutoSync()) {
    try {
      const { fetched, saved } = await syncTicketsToLocalStorage();
      notificationCenter.success('Jira tickets synced', {
        message: `Fetched ${fetched} ticket(s), saved ${saved} new ticket(s)`,
      });
    } catch (error) {
      notificationCenter.error('Auto-sync Jira tickets failed', {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }
};

/**
 * Load server-side settings (AI + Jira) for the signed-in user.
 * Also handles one-time migration of Jira config from localStorage.
 * Signed out this resolves to null and the app runs on local data alone.
 */
const initServerSettings = async () => {
  const serverSettings = await loadSettings();
  if (!serverSettings) return; // signed out, or the server is unreachable locally

  const jiraConfig = await migrateJiraFromLocalStorage(settingsStore.jiraConfig, serverSettings);
  settingsStore.populateFromServer(jiraConfig, serverSettings.aiConfig, serverSettings.aiGatewayAvailable);
};

onMounted(async () => {
  stopGreetingNotifications = startGreetingNotifications();
  await authReady; // settle the session first so the settings call carries a token
  await initServerSettings();
  await autoFetchEvents();
  await autoSyncJiraTickets();
});

// Credentials live per account, so re-read them whenever the signed-in user changes.
watch(isAuthenticated, async (signedIn, wasSignedIn) => {
  if (signedIn === wasSignedIn) return;
  if (signedIn) {
    await initServerSettings();
    await autoSyncJiraTickets();
  } else {
    settingsStore.resetServerConfigs();
  }
});

onUnmounted(() => {
  stopGreetingNotifications?.();
});

const route = useRoute();

// Small screens toggle Insights from the hamburger menu; on desktop the Home card header owns the toggle
const { toggle: toggleInsights } = useInsightsDrawer();

const { smAndDown } = useDisplay();

// Theme toggle
const theme = useTheme();
const savedTheme = useStorage<'light' | 'dark'>('app-theme', 'light');
theme.change(savedTheme.value);

const isDarkMode = computed(() => theme.global.name.value === 'dark');
const themeIcon = computed(() => (isDarkMode.value ? 'mdi-weather-sunny' : 'mdi-weather-night'));

const toggleTheme = () => {
  const newTheme = isDarkMode.value ? 'light' : 'dark';
  theme.change(newTheme);
  savedTheme.value = newTheme;
};

watch(
  () => theme.global.name.value,
  (newTheme) => {
    savedTheme.value = newTheme as 'light' | 'dark';
  },
);

// Desktop rail: the pages, each with an outline icon that fills in while it is the current page
const railItems = [
  { text: 'Home', to: '/', icon: 'mdi-home-outline', activeIcon: 'mdi-home' },
  { text: 'Notes', to: '/notes', icon: 'mdi-sticker-text-outline', activeIcon: 'mdi-sticker-text' },
  { text: 'Tasks', to: '/task', icon: 'mdi-format-list-checks', activeIcon: 'mdi-format-list-checks' },
  { text: 'Events', to: '/events', icon: 'mdi-calendar-month-outline', activeIcon: 'mdi-calendar-month' },
];

// Mobile hamburger menu: same pages plus Settings, which the rail keeps at its foot
const navItems = [...railItems.map(({ text, to }) => ({ text, to })), { text: 'Settings', to: '/setting' }];
</script>

<template>
  <VApp :style="glassStyle">
    <!-- Desktop: floating glass nav rail on the left; there is no top bar at all -->
    <VNavigationDrawer v-if="!smAndDown" permanent rail :rail-width="80" floating class="app-rail-shell">
      <nav class="app-rail glass-acrylic" aria-label="Main">
        <!-- App icon (same drawing as public/favicon.svg), inlined so it follows the app theme, not the OS -->
        <RouterLink to="/" class="rail-brand" aria-label="Daybook" title="Daybook">
          <svg viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle class="rail-brand__track" cx="16" cy="16" r="12.5" stroke-width="4" />
            <circle
              class="rail-brand__arc"
              cx="16"
              cy="16"
              r="12.5"
              stroke-width="4"
              stroke-dasharray="58.9 78.5"
              transform="rotate(-90 16 16)"
            />
            <path class="rail-brand__check" d="M10.5 16.5 14.5 20.5 21.5 12" stroke-width="3.2" />
          </svg>
        </RouterLink>

        <RouterLink
          v-for="item in railItems"
          :key="item.to"
          :to="item.to"
          class="rail-item"
          :class="{ 'rail-item--active': item.to === route.path }"
        >
          <span class="rail-item__pill">
            <VIcon :icon="item.to === route.path ? item.activeIcon : item.icon" size="20" />
          </span>
          {{ item.text }}
        </RouterLink>

        <span class="rail-spacer" />

        <VBtn
          icon
          variant="text"
          rounded="lg"
          :width="40"
          :height="40"
          :aria-label="isDarkMode ? 'Light mode' : 'Dark mode'"
          @click="toggleTheme"
        >
          <VIcon :icon="themeIcon" size="20" />
          <VTooltip activator="parent" location="end" :text="isDarkMode ? 'Light mode' : 'Dark mode'" />
        </VBtn>

        <VBtn
          icon
          variant="text"
          rounded="lg"
          :width="40"
          :height="40"
          to="/setting"
          :active="route.path === '/setting'"
          aria-label="Settings"
        >
          <VIcon :icon="route.path === '/setting' ? 'mdi-cog' : 'mdi-cog-outline'" size="20" />
          <VTooltip activator="parent" location="end" text="Settings" />
        </VBtn>

        <!-- Account avatar (or sign-in) at the very foot, like most apps -->
        <AuthMenu rail />
      </nav>
    </VNavigationDrawer>

    <!-- Small screens: compact glass top bar with the brand and a hamburger menu.
         53px: sized for the dock row; see the geometry note at .dock-row below before changing it -->
    <VAppBar v-else height="53" class="elevation-0" color="transparent">
      <div class="dock-row">
        <nav class="app-dock glass-acrylic">
          <RouterLink v-if="route.path !== '/'" to="/" class="dock-brand dock-brand--link">Daybook</RouterLink>
          <span v-else class="dock-brand">Daybook</span>

          <span class="dock-spacer" />

          <!-- Nav links where they fit (sm), the hamburger holds them on every small screen -->
          <VBtn
            v-for="(item, i) in navItems"
            :key="i"
            :active="item.to === route.path"
            class="text-none d-none d-sm-flex"
            v-bind="item"
            size="small"
          />

          <VMenu location="bottom end" :offset="8">
            <template #activator="{ props: menuProps }">
              <VBtn icon="mdi-menu" variant="text" size="small" v-bind="menuProps" aria-label="Menu" />
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

              <!-- Insights, theme and account live here on small screens to keep the bar short -->
              <VDivider class="my-1" />
              <VListItem
                v-if="route.path === '/'"
                rounded="lg"
                prepend-icon="mdi-chart-box-outline"
                title="Insights"
                @click="toggleInsights"
              />
              <VListItem
                rounded="lg"
                :prepend-icon="themeIcon"
                :title="isDarkMode ? 'Light mode' : 'Dark mode'"
                @click="toggleTheme"
              />

              <template v-if="isAuthConfigured">
                <VDivider class="my-1" />
                <template v-if="isAuthenticated">
                  <VListItem :title="user?.name || 'Signed in'" :subtitle="user?.email">
                    <template #prepend>
                      <VAvatar size="26" color="primary" variant="tonal" class="me-3">
                        <VImg v-if="user?.image" :src="user.image" alt="" />
                        <span v-else class="text-caption">{{ userInitial }}</span>
                      </VAvatar>
                    </template>
                  </VListItem>
                  <VListItem rounded="lg" prepend-icon="mdi-logout" title="Sign out" @click="signOut" />
                </template>
                <VListItem v-else rounded="lg" prepend-icon="mdi-login" title="Sign in" @click="openAuthDialog" />
              </template>
            </VList>
          </VMenu>

          <!-- Renders only the sign-in dialog here; the account entries live in the menu above -->
          <AuthMenu hide-trigger />
        </nav>
      </div>
    </VAppBar>

    <VMain style="overflow-y: auto">
      <RouterView />
      <!-- Touch screens keep the chat bar resting at the bottom: leave room so it covers no content -->
      <div class="chat-bar-spacer" />
      <AppBackground />
    </VMain>

    <!-- Glass chat bar, docked bottom centre on every page -->
    <ChatBar />
  </VApp>
</template>

<style>
/* Let the custom backgrounds show through */
.v-theme--dark.v-application,
.v-theme--light.v-application {
  background: transparent !important;
}

/* Small screens: the Home layout switches to page-scroll (height:auto), so the
   document grows and scrolls. Stop VMain's own overflow from adding a SECOND,
   inset scrollbar — that inset pushed the content cards ~1 scrollbar-width left
   of the full-width app bar, leaving a gap on the right. Let the document own the
   single scrollbar so the fixed app bar and the content align on the right edge. */
@media (max-width: 959px) {
  /* Both axes: with overflow-x left as `hidden`, `overflow-y: visible` computes
     back to `auto` (CSS spec), so VMain would keep its scrollbar. */
  .v-main {
    overflow: visible !important;
  }
}

.chat-bar-spacer {
  display: none;
}
@media (hover: none) {
  .chat-bar-spacer {
    display: block;
    height: 88px;
  }
}

/* Small-screen app bar — transparent shell; the glass dock inside handles visuals */
.v-app-bar {
  border-bottom: none !important;
  box-shadow: none !important;
  overflow: visible !important;
}

/* Strip VToolbar's built-in side padding so dock-row fills edge-to-edge */
.v-app-bar .v-toolbar__content,
.v-app-bar .v-toolbar__extension {
  padding: 0 !important;
  overflow: visible !important;
}

/* Dock layout (small screens only; desktop uses the rail below).
   Vertical geometry, measured (the account lives in the hamburger menu here, so signed in or out match):
     dock       = 4 + 28 (tallest child: a small button) + 4 = 42px
     dock-row   = 12 (padding-top) + 42 = 54px, centred in the 53px app bar, so it overhangs by 1px and
                  sits 0.5px high (row top -0.5, dock 11.5 -> 53.5)
     content    = starts at 65px (53px app bar + the page's own 12px padding)
   So the dock-to-content gap is 11.5px, half a pixel under the 12px gap between cards. That is the
   leftover of the 1px overhang, not a bug; to make it exactly 12px, set the VAppBar height to 54. If the
   dock's height ever changes, the gap changes with it: a taller child stretches the dock and shrinks the gap. */
.dock-row {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 12px 12px 0;
}

.app-dock {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  overflow: visible;
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

/* ── Desktop nav rail ──────────────────────────────────────────────────────────
   The drawer itself is an invisible 80px layout column (so VMain pads past it);
   the glass card inside floats 12px off the window edges like every other card. */
.app-rail-shell {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.app-rail-shell .v-navigation-drawer__content {
  overflow: visible;
}

.app-rail {
  height: calc(100% - 24px);
  margin: 12px 0 12px 12px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 0;
}

/* Brand mark: the app icon, doubles as the Home link */
.rail-brand {
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 8px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  transition: opacity 0.15s;
}

.rail-brand svg {
  width: 36px;
  height: 36px;
}

/* Icon colours as in favicon.svg, keyed to the app theme */
.rail-brand__track {
  stroke: #d2e3d8;
}
.rail-brand__arc {
  stroke: #4a8c6a;
}
.rail-brand__check {
  stroke: #3b7556;
}
.v-theme--dark .rail-brand__track {
  stroke: #2c4237;
}
.v-theme--dark .rail-brand__arc,
.v-theme--dark .rail-brand__check {
  stroke: #7fc29c;
}

.rail-brand:hover {
  opacity: 0.85;
}

.rail-item {
  /* Same footprint language as the brand mark: a 48px-wide tile with its 12px radius, so it sits
     inset from the rail's edges instead of running into them */
  width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 0 6px;
  border-radius: 12px;
  font-size: 10.5px;
  line-height: 1.2;
  text-decoration: none;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  transition: background-color 0.2s;
}

/* The highlight wraps icon and label together, a rounded tile rather than an oval behind the icon */
.rail-item__pill {
  display: grid;
  place-items: center;
  height: 24px;
}

.rail-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.rail-item--active,
.rail-item--active:hover {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
  background: rgba(var(--v-theme-on-surface), 0.1);
}

.rail-item:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.rail-spacer {
  flex: 1;
}

/* Rail buttons read as secondary to the page links */
.app-rail .v-btn {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
