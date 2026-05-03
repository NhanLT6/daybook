<template>
  <video :src="src" autoplay loop muted playsinline class="bg-video" />
</template>

<script setup lang="ts">
defineProps<{ src: string }>();
</script>

<style scoped>
.bg-video {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}
</style>
