<script setup lang="ts">
import { onBeforeUnmount } from 'vue';

import { useGardenFocus } from '@/composables/useGardenFocus';

import GardenPanel from '@/components/garden/GardenPanel.vue';

import { onKeyStroke } from '@vueuse/core';

import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();
const { gardenFocus } = useGardenFocus();
onKeyStroke('Escape', () => {
  gardenFocus.value = false;
});
onBeforeUnmount(() => {
  gardenFocus.value = false;
});
</script>

<template>
  <section
    v-if="settings.showGarden"
    class="garden-page"
    :class="{ 'garden-page--focus': gardenFocus }"
    aria-label="Garden"
  >
    <div class="garden-world">
      <GardenPanel fill />
      <VBtn
        class="garden-fullscreen"
        variant="flat"
        :icon="gardenFocus ? 'mdi-arrow-collapse' : 'mdi-arrow-expand'"
        :aria-label="gardenFocus ? 'Exit fullscreen' : 'Fullscreen'"
        :title="gardenFocus ? 'Exit fullscreen' : 'Fullscreen'"
        :aria-pressed="gardenFocus"
        @click="gardenFocus = !gardenFocus"
      />
    </div>
  </section>
  <section v-else class="garden-disabled">
    <p class="text-medium-emphasis">Enable Garden in Settings.</p>
    <VBtn to="/setting" color="primary" variant="tonal">Go to Settings</VBtn>
  </section>
</template>

<style scoped>
.garden-page {
  flex: 1 0 auto;
  height: calc(100dvh - var(--v-layout-top, 0px));
  min-height: 0;
  padding: 8px;
}
.garden-world {
  position: relative;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
}
.garden-page--focus {
  height: 100dvh;
  padding: 0;
}
.garden-page--focus .garden-world,
.garden-page--focus :deep(.garden) {
  border-radius: 0;
}
.garden-fullscreen {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(var(--v-theme-surface), 0.85);
  color: rgb(var(--v-theme-on-surface));
}
.garden-disabled {
  margin: auto;
  padding: 24px;
  text-align: center;
  display: grid;
  justify-items: center;
  gap: 16px;
}
</style>
