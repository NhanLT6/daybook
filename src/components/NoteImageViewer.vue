<script setup lang="ts">
// Click-to-zoom for note images. VDialog gives Esc / outside-click dismiss and a focus trap for free;
// `target` makes its default transition grow out of the clicked image.
const open = defineModel<boolean>({ required: true });

defineProps<{ src?: string; alt?: string; target?: HTMLElement }>();

const emit = defineEmits<{ closed: [] }>();
</script>

<template>
  <VDialog v-model="open" :target="target" width="auto" class="note-image-viewer" @after-leave="emit('closed')">
    <!-- Clicking the image itself also dismisses, like the scrim around it -->
    <img :src="src" :alt="alt || 'Note image'" class="note-image-viewer__img" @click="open = false" />
  </VDialog>
</template>

<style>
/* Unscoped: VDialog teleports its content out of this component */
.note-image-viewer .v-overlay__scrim {
  opacity: 0.85;
}

.note-image-viewer__img {
  display: block;
  max-width: 95vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  cursor: zoom-out;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}
</style>
