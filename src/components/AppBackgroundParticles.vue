<template>
  <div class="app-background" :class="isDark ? 'dark' : 'light'">
    <div v-for="p in blobs" :key="`bl${p.id}`" class="blob" :style="p.style" />
    <div v-for="p in orbs" :key="`or${p.id}`" class="orb" :style="p.style" />
    <div v-for="p in wisps" :key="`wi${p.id}`" class="wisp" :style="p.style" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { useTheme } from 'vuetify';

interface Particle {
  id: number;
  style: Record<string, string | number>;
}

const theme = useTheme();
const isDark = computed(() => theme.global.current.value.dark);

// 6-hue palette — green, teal, blue, lavender, amber, rose
const lightColors = [
  'rgba(56, 142, 60, 0.13)', // green
  'rgba(0, 150, 136, 0.11)', // teal
  'rgba(80, 130, 210, 0.11)', // blue
  'rgba(130, 100, 190, 0.10)', // lavender
  'rgba(210, 155, 50, 0.10)', // amber
  'rgba(220, 110, 100, 0.09)', // rose
];

const darkColors = [
  'rgba(56, 142, 60, 0.12)', // green
  'rgba(0, 130, 118, 0.11)', // teal
  'rgba(60, 100, 185, 0.11)', // blue
  'rgba(110, 70, 165, 0.11)', // purple
  'rgba(175, 120, 30, 0.10)', // amber
  'rgba(185, 70, 70, 0.10)', // rose
];

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function driftVars(range: number) {
  return {
    '--drift-delay': `-${Math.random() * 15}s`,
    '--drift-dur': `${Math.random() * 6 + 8}s`,
    '--tx': `${(Math.random() - 0.5) * range}px`,
    '--ty': `${(Math.random() - 0.5) * range}px`,
  };
}

const blobs = ref<Particle[]>([]);
const orbs = ref<Particle[]>([]);
const wisps = ref<Particle[]>([]);

function generateParticles(dark: boolean) {
  const palette = dark ? darkColors : lightColors;

  // Large blobs — 18
  blobs.value = Array.from({ length: 18 }, (_, i) => {
    const size = Math.random() * 220 + 130;
    return {
      id: i,
      style: {
        left: `${Math.random() * 110 - 5}%`,
        top: `${Math.random() * 110 - 5}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: pick(palette),
        filter: `blur(${Math.random() * 4 + 7}px)`,
        ...driftVars(280),
      },
    };
  });

  // Medium-large orbs — 24
  orbs.value = Array.from({ length: 24 }, (_, i) => {
    const size = Math.random() * 90 + 70;
    return {
      id: i,
      style: {
        left: `${Math.random() * 105 - 2}%`,
        top: `${Math.random() * 105 - 2}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: pick(palette),
        filter: `blur(${Math.random() * 2 + 2}px)`,
        ...driftVars(200),
      },
    };
  });

  // Medium-small wisps — 30
  wisps.value = Array.from({ length: 30 }, (_, i) => {
    const size = Math.random() * 45 + 22;
    return {
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: pick(palette),
        filter: `blur(${Math.random() * 1.5 + 1}px)`,
        opacity: dark ? 0.4 + Math.random() * 0.3 : 0.3 + Math.random() * 0.2,
        ...driftVars(160),
      },
    };
  });
}

onMounted(() => generateParticles(isDark.value));
watch(isDark, (dark) => generateParticles(dark));
</script>

<style scoped>
.app-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  transition: background 0.4s ease;
}

.app-background.light {
  background: linear-gradient(145deg, #b4bec9 0%, #abb6c2 45%, #b2beb4 100%);
}

.app-background.dark {
  background: linear-gradient(145deg, #2a2a2a 0%, #252528 45%, #272b27 100%);
}

.blob,
.orb,
.wisp {
  position: absolute;
  border-radius: 50%;
  animation: drift var(--drift-dur) var(--drift-delay) ease-in-out infinite;
}

@keyframes drift {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: var(--tx) var(--ty);
  }
}
</style>
