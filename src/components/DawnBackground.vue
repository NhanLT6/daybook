<!-- components/DawnBackground.vue — light theme background -->
<template>
  <div class="dawn-sky">
    <div v-for="blob in blobs" :key="`b${blob.id}`" class="blob" :style="blob.style" />
    <div v-for="mote in motes" :key="`m${mote.id}`" class="mote" :style="mote.style" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Particle {
  id: number;
  style: Record<string, string | number>;
}

// Watercolor wash palette — soft sage green + cool grey-blue to complement the light theme
const blobColors = [
  'rgba(56, 142, 60, 0.22)',
  'rgba(100, 170, 105, 0.18)',
  'rgba(140, 200, 145, 0.20)',
  'rgba(160, 195, 220, 0.18)',
  'rgba(190, 215, 230, 0.22)',
];

// Tiny mote colors — pale, barely-there
const moteColors = [
  'rgba(56, 142, 60, 0.55)',
  'rgba(100, 170, 105, 0.45)',
  'rgba(150, 190, 210, 0.50)',
  'rgba(255, 255, 255, 0.80)',
];

const blobs = ref<Particle[]>([]);
const motes = ref<Particle[]>([]);

onMounted(() => {
  // 12 large soft blobs — the watercolor wash layer
  blobs.value = Array.from({ length: 12 }, (_, i) => {
    const size = Math.random() * 220 + 130;
    const color = blobColors[Math.floor(Math.random() * blobColors.length)];
    return {
      id: i,
      style: {
        left: `${Math.random() * 110 - 5}%`,
        top: `${Math.random() * 110 - 5}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        filter: `blur(${Math.random() * 12 + 20}px)`,
        '--drift-delay': `-${Math.random() * 10}s`,
        '--drift-dur': `${Math.random() * 3 + 4}s`,
        '--tx': `${(Math.random() - 0.5) * 280}px`,
        '--ty': `${(Math.random() - 0.5) * 280}px`,
      },
    };
  });

  // 110 tiny motes — dust in morning light
  motes.value = Array.from({ length: 110 }, (_, i) => {
    const size = Math.random() * 2.5 + 0.8;
    const color = moteColors[Math.floor(Math.random() * moteColors.length)];
    return {
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        opacity: 0.3 + Math.random() * 0.5,
        boxShadow: `0 0 ${size * 2}px rgba(56, 142, 60, 0.35)`,
        '--twinkle-delay': `${Math.random() * 8}s`,
        '--twinkle-dur': `${Math.random() * 4 + 4}s`,
        '--drift-delay': `-${Math.random() * 15}s`,
        '--drift-dur': `${Math.random() * 6 + 8}s`,
        '--tx': `${(Math.random() - 0.5) * 160}px`,
        '--ty': `${(Math.random() - 0.5) * 160}px`,
      },
    };
  });
});
</script>

<style scoped>
.dawn-sky {
  position: fixed;
  inset: 0;
  background: linear-gradient(145deg, #f2f5f9 0%, #eaeff4 45%, #edf3ee 100%);
  z-index: -1;
  overflow: hidden;
}

.blob {
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
