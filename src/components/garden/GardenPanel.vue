<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch } from 'vue';

import { useGarden } from '@/composables/useGarden';
import { useGardenPip } from '@/composables/useGardenPip';

import type { GardenScene, SpeciesKey } from './gardenScene';

import { useTheme } from 'vuetify';

import { useNow, useResizeObserver } from '@vueuse/core';

import { createGardenScene, MAX_STAGE, NIGHT_MATRIX, paintPlantPreview, SPECIES } from './gardenScene';

const SCENE_HEIGHT = 340;

const { plants, drops, claimDailyDrop, plant, clear, water } = useGarden();

// The day's free drop: on opening, and at midnight for a page left open overnight
const now = useNow({ interval: 60_000 });
watch(() => now.value.toDateString(), claimDailyDrop, { immediate: true });
const theme = useTheme();

const wrap = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
const scene = shallowRef<GardenScene>();
// The night tint is an SVG colour matrix; each garden needs its own filter id
const nightFilterId = `garden-night-${useId()}`;

// ── Status line: a short message over the wall that fades on its own ──
const status = ref('');
let statusTimer: ReturnType<typeof setTimeout> | undefined;
const say = (message: string) => {
  status.value = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.value = ''), 2600);
};

// ── Plant picker: a small menu at the pot that was tapped ──
const pickerOpen = ref(false);
const pickerSlot = ref(-1);
const pickerTarget = ref<[number, number]>([0, 0]);
const speciesList = Object.entries(SPECIES) as [SpeciesKey, (typeof SPECIES)[SpeciesKey]][];

const openPicker = (index: number) => {
  if (!scene.value || !canvas.value) return;
  const anchor = scene.value.slotAnchor(index);
  const rect = canvas.value.getBoundingClientRect();
  pickerSlot.value = index;
  pickerTarget.value = [rect.left + anchor.x, rect.top + anchor.y];
  pickerOpen.value = true;
};

const choose = (species: SpeciesKey) => {
  plant(pickerSlot.value, species);
  pickerOpen.value = false;
  scene.value?.pulse(pickerSlot.value);
  say(`${SPECIES[species].name} planted. Tap the pot to water it.`);
};

// Previews are painted once per picker open, after the canvases mount
const paintPreview = (el: unknown, species: SpeciesKey) => {
  if (el instanceof HTMLCanvasElement) paintPlantPreview(el, species, 44);
};

// ── Taps: empty pot → pick a plant; growing plant → water; grown plant → double-click to replant ──
const slotFromEvent = (event: MouseEvent) => {
  if (!scene.value || !canvas.value) return -1;
  const rect = canvas.value.getBoundingClientRect();
  return scene.value.slotAt(event.clientX - rect.left, event.clientY - rect.top);
};

const onClick = (event: MouseEvent) => {
  const index = slotFromEvent(event);
  if (index < 0 || !scene.value) return;
  const target = plants.value[index];
  if (choosingPip.value) {
    if (!target) {
      say('Pick a pot with a plant in it.');
      return;
    }
    choosingPip.value = false;
    // Still inside the click, so the browser lets the floating window open
    void pip.open(index, pipTheme);
    return;
  }
  if (!target) {
    openPicker(index);
    return;
  }

  const info = SPECIES[target.species];
  if (target.stage >= MAX_STAGE) {
    scene.value.pulse(index);
    say(`${info.name} ${info.done}. Double-click to plant something new.`);
    return;
  }
  if (scene.value.isPouring()) return;

  const fromStage = water(index);
  if (fromStage === null) {
    scene.value.pulse(index);
    say('Out of water. Log something to get another drop.');
    return;
  }
  scene.value.pour(index, fromStage);
  if (fromStage + 1 === MAX_STAGE) say(`${info.name} ${info.done}.`);
};

const onDoubleClick = (event: MouseEvent) => {
  const index = slotFromEvent(event);
  const target = index >= 0 ? plants.value[index] : null;
  if (!target || target.stage < MAX_STAGE || !scene.value) return;
  // The trowel digs the grown plant out, then the empty pot asks for a new one
  scene.value.dig(index, () => {
    clear(index);
    openPicker(index);
  });
};

// ── Scene lifecycle and theme ──
const sceneTheme = computed(() => ({
  dark: theme.current.value.dark,
  primary: theme.current.value.colors.primary,
  onPrimary: theme.current.value.dark ? theme.current.value.colors.background : '#FFFFFF',
}));

// ── Floating window: one plant taken out of the shelf into a picture-in-picture window ──
const pip = useGardenPip();
const choosingPip = ref(false);
// A plain getter, not a computed: the window can outlive this panel, and a computed stops with it
const pipTheme = () => {
  const current = theme.current.value;
  return {
    dark: current.dark,
    primary: current.colors.primary,
    onPrimary: current.dark ? current.colors.background : '#FFFFFF',
    background: current.colors.background,
    onBackground: current.colors['on-background'],
  };
};
const onPipButton = () => {
  if (pip.pipSlot.value !== null) {
    pip.close();
    return;
  }
  choosingPip.value = !choosingPip.value;
  if (choosingPip.value) say('Tap a plant to take it out into its own window.');
};

onMounted(() => {
  if (!canvas.value) return;
  scene.value = createGardenScene(canvas.value, {
    height: SCENE_HEIGHT,
    nightFilterId,
    getPlants: () => plants.value,
    getDrops: () => drops.value,
  });
  scene.value.setTheme(sceneTheme.value);
});

watch(sceneTheme, (value) => scene.value?.setTheme(value));
useResizeObserver(wrap, () => scene.value?.resize());

onBeforeUnmount(() => {
  scene.value?.destroy();
  clearTimeout(statusTimer);
});

const ariaLabel = computed(
  () =>
    `Garden shelf. ${drops.value} ${drops.value === 1 ? 'drop' : 'drops'} of water ready. Tap a pot to plant or water.`,
);
</script>

<template>
  <div ref="wrap" class="garden">
    <!-- Night tint for plants and shelf, used by the scene through ctx.filter -->
    <svg width="0" height="0" class="position-absolute" aria-hidden="true">
      <filter :id="nightFilterId" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix" :values="NIGHT_MATRIX" />
      </filter>
    </svg>

    <canvas
      ref="canvas"
      class="garden-canvas"
      role="img"
      :aria-label="ariaLabel"
      @click="onClick"
      @dblclick="onDoubleClick"
    />

    <!-- Take one plant out into a floating window (browsers with Document Picture-in-Picture only) -->
    <VBtn
      v-if="pip.supported"
      class="garden-pip-btn"
      :icon="
        pip.pipSlot.value !== null
          ? 'mdi-picture-in-picture-bottom-right'
          : 'mdi-picture-in-picture-bottom-right-outline'
      "
      :color="choosingPip ? 'primary' : undefined"
      :variant="choosingPip ? 'tonal' : 'text'"
      size="small"
      density="comfortable"
      :title="pip.pipSlot.value !== null ? 'Close the floating plant' : 'Take a plant out into its own window'"
      @click="onPipButton"
    />

    <!-- Latest message, over the wall -->
    <Transition name="fade">
      <div v-if="status" class="garden-status text-caption">{{ status }}</div>
    </Transition>

    <!-- Plant picker, opened at the tapped pot -->
    <VMenu v-model="pickerOpen" :target="pickerTarget" location="top center" offset="8">
      <VCard class="glass-acrylic pa-2" width="288">
        <div class="text-caption text-medium-emphasis px-1 pb-1">Pick a plant</div>
        <div class="picker-grid">
          <button
            v-for="[key, info] in speciesList"
            :key="key"
            type="button"
            class="picker-item text-caption"
            @click="choose(key)"
          >
            <canvas :ref="(el) => paintPreview(el, key)" class="picker-preview" />
            <span>{{ info.name }}</span>
          </button>
        </div>
      </VCard>
    </VMenu>
  </div>
</template>

<style scoped>
.garden {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.garden-canvas {
  display: block;
  cursor: pointer;
  touch-action: manipulation;
}

.garden-pip-btn {
  position: absolute;
  top: 4px;
  right: 4px;
}

.garden-status {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 16px);
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(var(--v-theme-surface), 0.85);
  color: rgb(var(--v-theme-on-surface));
  text-align: center;
  pointer-events: none;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}

.picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: 8px;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.2;
  text-align: center;
}

.picker-item:hover,
.picker-item:focus-visible {
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.picker-preview {
  width: 44px;
  height: 44px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
