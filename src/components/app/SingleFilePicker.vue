<script setup lang="ts">
import { ref } from 'vue';

export interface SingleFilePickerProps {
  fileTypes?: string;
  text?: string;
}

const { fileTypes, text } = defineProps<SingleFilePickerProps>();

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
    <VBtn v-if="!!text" v-bind="$attrs" @click="triggerFileInput">{{ text }}</VBtn>
    <VBtn v-else icon="mdi-tray-arrow-up" v-bind="$attrs" @click="triggerFileInput" />

    <input ref="fileInput" type="file" :accept="fileTypes" style="display: none" @change="handleFileChange" />
  </div>
</template>

<style scoped></style>
