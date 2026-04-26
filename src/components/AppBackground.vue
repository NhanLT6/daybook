<template>
  <div v-if="settingsStore.backgroundImageUrl" class="app-background-image" :style="imageStyle" />
  <AppBackgroundParticles v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useSettingsStore } from '@/stores/settings';

import AppBackgroundParticles from './AppBackgroundParticles.vue';

const settingsStore = useSettingsStore();

const imageStyle = computed(() => {
  const mode = settingsStore.backgroundImageMode;
  return {
    backgroundImage: `url(${settingsStore.backgroundImageUrl})`,
    backgroundSize: mode === 'fill' ? '100% 100%' : mode === 'tile' ? 'auto' : mode,
    backgroundRepeat: mode === 'tile' ? 'repeat' : 'no-repeat',
    backgroundPosition: 'center',
  };
});
</script>

<style scoped>
.app-background-image {
  position: fixed;
  inset: 0;
  z-index: -1;
}
</style>
