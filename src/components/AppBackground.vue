<template>
  <AppBackgroundVideo v-if="settingsStore.isBackgroundVideo" :src="settingsStore.backgroundUrl" />
  <div v-else-if="settingsStore.backgroundUrl" class="app-background-image" :style="imageStyle" />
  <div v-else class="app-background-static" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useSettingsStore } from '@/stores/settings';

import AppBackgroundVideo from './AppBackgroundVideo.vue';

const settingsStore = useSettingsStore();

const imageStyle = computed(() => {
  const mode = settingsStore.backgroundImageMode;
  return {
    backgroundImage: `url(${settingsStore.backgroundUrl})`,
    backgroundSize: mode === 'fill' ? '100% 100%' : mode === 'tile' ? 'auto' : mode,
    backgroundRepeat: mode === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: 'center',
  };
});
</script>

<style scoped>
.app-background-image,
.app-background-static {
  position: fixed;
  inset: 0;
  z-index: -1;
}

/* Default backdrop: flat, mid-tone so glass panels still read against it.
   Glass panels are semi-opaque white/black over this, so a lighter light
   backdrop makes panels glare; dark stays a lifted charcoal, not black. */
.app-background-static {
  transition: background-color 0.4s ease;
}

.v-theme--light .app-background-static {
  background-color: #a5afbb;
}

.v-theme--dark .app-background-static {
  background-color: #313337;
}
</style>
