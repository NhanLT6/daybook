<script setup lang="ts">
import { ref } from 'vue';

export interface SingleFilePickerProps {
  fileTypes?: string;
}

const { fileTypes } = defineProps<SingleFilePickerProps>();

const emit = defineEmits<{
  fileSelected: [file?: File];
}>();

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => fileInput.value?.click();

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  emit('fileSelected', file);
};
</script>

<template>
  <div>
    <VBtn v-bind="$attrs" @click="triggerFileInput">
      <slot />
    </VBtn>
    <input ref="fileInput" type="file" :accept="fileTypes" style="display: none" @change="handleFileChange" />
  </div>
</template>

<style scoped></style>
