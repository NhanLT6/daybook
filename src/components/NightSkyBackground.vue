<!-- components/NightSkyBackground.vue -->
<template>
  <div class="starry-sky">
    <div class="nebula" />
    <div v-for="star in stars" :key="star.id" class="star" :style="star.style" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

interface Star {
  id: number;
  style: Record<string, string | number>;
}

const starColors = [
  'rgba(255, 255, 255, 1)',
  'rgba(200, 220, 255, 1)',
  'rgba(255, 245, 210, 1)',
  'rgba(180, 210, 255, 1)',
];

const starCount = 220;
const stars = ref<Star[]>([]);

onMounted(() => {
  stars.value = Array.from({ length: starCount }, (_, i) => {
    const tier = Math.random();
    let size: number;
    let opacity: number;
    let boxShadow: string;

    if (tier > 0.95) {
      size = Math.random() * 1.5 + 2.5;
      opacity = 0.9 + Math.random() * 0.1;
      boxShadow = `0 0 ${size * 3}px rgba(180, 220, 255, 0.9), 0 0 ${size * 7}px rgba(160, 200, 255, 0.4)`;
    } else if (tier > 0.7) {
      size = Math.random() * 1.2 + 1;
      opacity = 0.6 + Math.random() * 0.35;
      boxShadow = `0 0 ${size * 2}px rgba(255, 255, 255, 0.65)`;
    } else {
      size = Math.random() * 0.7 + 0.3;
      opacity = 0.25 + Math.random() * 0.45;
      boxShadow = `0 0 ${size}px rgba(255, 255, 255, 0.35)`;
    }

    const color = starColors[Math.floor(Math.random() * starColors.length)];

    return {
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        width: `${size}px`,
        height: `${size}px`,
        background: color,
        boxShadow,
        opacity,
        '--twinkle-delay': `${Math.random() * 8}s`,
        '--twinkle-dur': `${Math.random() * 4 + 3}s`,
        // Negative delay starts the drift mid-cycle so stars are already spread on load
        '--drift-delay': `-${Math.random() * 25}s`,
        '--drift-dur': `${Math.random() * 12 + 12}s`,
        '--tx': `${(Math.random() - 0.5) * 130}px`,
        '--ty': `${(Math.random() - 0.5) * 130}px`,
      },
    };
  });
});
</script>

<style scoped>
.starry-sky {
  position: fixed;
  inset: 0;
  background: linear-gradient(to bottom, #080808 0%, #0f0f0f 55%, #131313 100%);
  z-index: -1;
  overflow: hidden;
}

.nebula {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 65% 45% at 15% 55%, rgba(160, 165, 170, 0.04) 0%, transparent 70%),
    radial-gradient(ellipse 55% 38% at 82% 25%, rgba(140, 145, 150, 0.03) 0%, transparent 70%),
    radial-gradient(ellipse 45% 55% at 50% 88%, rgba(130, 135, 140, 0.03) 0%, transparent 70%);
  pointer-events: none;
}

.star {
  position: absolute;
  border-radius: 50%;
  animation:
    twinkle var(--twinkle-dur) var(--twinkle-delay) ease-in-out infinite,
    drift var(--drift-dur) var(--drift-delay) ease-in-out infinite;
}

/* scale only — translate is handled separately so they don't conflict */
@keyframes twinkle {
  0%,
  100% {
    opacity: 0.15;
    transform: scale(0.7);
  }
  50% {
    opacity: 1;
    transform: scale(1.3);
  }
}

/* CSS `translate` property is independent of `transform`, no conflict */
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
