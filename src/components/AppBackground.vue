<template>
  <div class="app-background" :class="isDark ? 'dark' : 'light'">
    <div v-for="p in blobs" :key="`bl${p.id}`" class="blob" :style="p.style" />
    <div v-for="p in orbs" :key="`or${p.id}`" class="orb" :style="p.style" />
    <div v-for="p in wisps" :key="`wi${p.id}`" class="wisp" :style="p.style" />
    <div v-for="p in motes" :key="`mo${p.id}`" class="mote" :style="p.style" />
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
  'rgba(56, 142, 60, 0.20)', // green
  'rgba(0, 150, 136, 0.18)', // teal
  'rgba(80, 130, 210, 0.18)', // blue
  'rgba(130, 100, 190, 0.17)', // lavender
  'rgba(210, 155, 50, 0.16)', // amber
  'rgba(220, 110, 100, 0.15)', // rose
];

const darkColors = [
  'rgba(56, 142, 60, 0.12)', // green
  'rgba(0, 130, 118, 0.11)', // teal
  'rgba(60, 100, 185, 0.11)', // blue
  'rgba(110, 70, 165, 0.11)', // purple
  'rgba(175, 120, 30, 0.10)', // amber
  'rgba(185, 70, 70, 0.10)', // rose
];

const lightMoteColors = [
  { color: 'rgba(56, 142, 60, 0.60)', glow: 'rgba(56, 142, 60, 0.35)' },
  { color: 'rgba(0, 150, 136, 0.55)', glow: 'rgba(0, 150, 136, 0.30)' },
  { color: 'rgba(80, 130, 210, 0.55)', glow: 'rgba(80, 130, 210, 0.30)' },
  { color: 'rgba(130, 100, 190, 0.50)', glow: 'rgba(130, 100, 190, 0.28)' },
  { color: 'rgba(210, 155, 50, 0.55)', glow: 'rgba(210, 155, 50, 0.30)' },
  { color: 'rgba(220, 110, 100, 0.50)', glow: 'rgba(220, 110, 100, 0.28)' },
  { color: 'rgba(255, 255, 255, 0.70)', glow: 'rgba(200, 220, 255, 0.30)' },
];

const darkMoteColors = [
  { color: 'rgba(76, 175, 80, 0.45)', glow: 'rgba(76, 175, 80, 0.25)' },
  { color: 'rgba(0, 180, 160, 0.40)', glow: 'rgba(0, 180, 160, 0.22)' },
  { color: 'rgba(100, 150, 230, 0.40)', glow: 'rgba(100, 150, 230, 0.22)' },
  { color: 'rgba(160, 110, 210, 0.38)', glow: 'rgba(160, 110, 210, 0.20)' },
  { color: 'rgba(230, 170, 60, 0.38)', glow: 'rgba(230, 170, 60, 0.20)' },
  { color: 'rgba(230, 100, 100, 0.35)', glow: 'rgba(230, 100, 100, 0.20)' },
  { color: 'rgba(200, 200, 200, 0.30)', glow: 'rgba(200, 200, 200, 0.15)' },
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
const motes = ref<Particle[]>([]);

function generateParticles(dark: boolean) {
  const palette = dark ? darkColors : lightColors;
  const motePalette = dark ? darkMoteColors : lightMoteColors;

  // Large blobs — 18 (was 12)
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
        filter: `blur(${Math.random() * 12 + 20}px)`,
        ...driftVars(280),
      },
    };
  });

  // Medium-large orbs — 24
  orbs.value = Array.from({ length: 24 }, (_, i) => {
    const size = Math.random() * 65 + 45;
    return {
      id: i,
      style: {
        left: `${Math.random() * 105 - 2}%`,
        top: `${Math.random() * 105 - 2}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: pick(palette),
        filter: `blur(${Math.random() * 6 + 8}px)`,
        ...driftVars(200),
      },
    };
  });

  // Medium-small wisps — 30
  wisps.value = Array.from({ length: 30 }, (_, i) => {
    const size = Math.random() * 28 + 12;
    return {
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: pick(palette),
        filter: `blur(${Math.random() * 3 + 3}px)`,
        opacity: dark ? 0.4 + Math.random() * 0.3 : 0.5 + Math.random() * 0.3,
        ...driftVars(160),
      },
    };
  });

  // Tiny motes — 165 (was 110)
  motes.value = Array.from({ length: 165 }, (_, i) => {
    const size = Math.random() * 2.5 + 0.8;
    const { color, glow } = pick(motePalette);
    return {
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        opacity: dark ? 0.2 + Math.random() * 0.4 : 0.3 + Math.random() * 0.5,
        boxShadow: `0 0 ${size * 2}px ${glow}`,
        '--twinkle-delay': `${Math.random() * 8}s`,
        '--twinkle-dur': `${Math.random() * 4 + 4}s`,
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
  background: linear-gradient(145deg, #f2f5f9 0%, #eaeff4 45%, #edf3ee 100%);
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

.mote {
  position: absolute;
  border-radius: 50%;
  animation:
    twinkle var(--twinkle-dur) var(--twinkle-delay) ease-in-out infinite,
    drift var(--drift-dur) var(--drift-delay) ease-in-out infinite;
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.1;
    transform: scale(0.7);
  }
  50% {
    opacity: 1;
    transform: scale(1.4);
  }
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
