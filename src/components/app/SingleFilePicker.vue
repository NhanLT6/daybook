<script setup lang="ts">
import { Comment, computed, ref, useSlots } from 'vue';

export interface SingleFilePickerProps {
  fileTypes?: string;
}

const props = defineProps<SingleFilePickerProps>();

const emit = defineEmits<{
  fileSelected: [file?: File];
}>();

const slots = useSlots();
const fileInput = ref<HTMLInputElement | null>(null);

// True only when the slot contains real content (not just comment nodes)
const hasText = computed(() => !!slots.default && slots.default().some((vn) => vn.type !== Comment));

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  emit('fileSelected', file);
};
</script>

<template>
  <div>
    <VIconBtn v-if="!hasText" v-bind="$attrs" @click="triggerFileInput" />
    <VBtn v-else v-bind="$attrs" @click="triggerFileInput">
      <slot />
    </VBtn>
    <input ref="fileInput" type="file" :accept="props.fileTypes" style="display: none" @change="handleFileChange" />
  </div>
</template>

<style scoped></style>
