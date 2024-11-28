<script setup lang="ts">
import { defineEmits, defineProps, ref } from 'vue';

export interface SingleFilePickerProps {
  fileTypes?: string;
}

const { fileTypes } = defineProps<SingleFilePickerProps>();

const emit = defineEmits<{
  fileSelected: [file?: File];
}>();

const fileInput = ref();
const selectedFile = ref();

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    selectedFile.value = file;
    emit('fileSelected', file);
  }
};
</script>

<template>
  <div>
    <VBtn icon="mdi-tray-arrow-up" v-bind="$attrs" @click="triggerFileInput" />
    <input ref="fileInput" type="file" :accept="fileTypes" style="display: none" @change="handleFileChange" />
  </div>
</template>

<style scoped></style>
