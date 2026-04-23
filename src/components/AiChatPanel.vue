<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useAiChat } from '@/composables/useAiChat';
import { useRouter } from 'vue-router';

import type { ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import AiChatMessage from './AiChatMessage.vue';

const props = defineProps<{
  projects: Project[];
  tasks: Task[];
}>();

const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]];
}>();

const { messages, isLoading, error, latestLogsMessageId, sendMessage } = useAiChat();
const router = useRouter();

const isConfigError = computed(() => error.value?.includes('not configured') ?? false);

const inputText = ref('');
const attachedFile = ref<File | null>(null);
const attachedPreview = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const messagesEndRef = ref<HTMLDivElement | null>(null);
const isDragOver = ref(false);

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  },
);

const handleSend = async () => {
  const text = inputText.value.trim();
  if (!text && !attachedFile.value) return;

  const file = attachedFile.value;
  inputText.value = '';
  attachedFile.value = null;
  attachedPreview.value = null;

  await sendMessage(text, file, props.projects, props.tasks);
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const attachImage = (file: File) => {
  attachedFile.value = file;
  attachedPreview.value = URL.createObjectURL(file);
};

const handleFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) attachImage(file);
};

const handlePaste = (event: ClipboardEvent) => {
  const item = Array.from(event.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
  if (!item) return;
  event.preventDefault();
  const file = item.getAsFile();
  if (file) attachImage(file);
};

const handleDrop = (event: DragEvent) => {
  isDragOver.value = false;
  const file = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
  if (file) attachImage(file);
};

const removeAttachment = () => {
  attachedFile.value = null;
  attachedPreview.value = null;
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const handleSaveLogs = (logs: ExtractedLog[]) => {
  emit('saveLogs', logs);
};

const clearError = () => {
  error.value = null;
};
</script>

<template>
  <div class="d-flex flex-column" style="flex: 1; min-height: 0">
    <!-- Messages area -->
    <div class="messages-area pa-3 d-flex flex-column ga-3 flex-grow-1 overflow-y-auto">
      <div
        v-if="!messages.length && !error"
        class="d-flex flex-column align-center justify-center text-center"
        style="min-height: 200px"
      >
        <VIcon icon="mdi-creation" size="36" color="primary" class="mb-3" opacity="0.5" />
        <p class="text-body-2 text-medium-emphasis mb-1">Describe your work or paste a screenshot</p>
        <p class="text-caption text-disabled">e.g. "DS-1234 for 2h this morning"</p>
      </div>

      <AiChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :is-saveable="msg.id === latestLogsMessageId"
        @save-logs="handleSaveLogs"
      />

      <div v-if="isLoading" class="d-flex align-center ga-2">
        <VAvatar size="28" color="primary" class="flex-shrink-0">
          <VIcon icon="mdi-creation" size="16" />
        </VAvatar>
        <VCard color="container" variant="elevated" elevation="0" rounded="lg rounded-ts-sm" class="pa-3">
          <div class="d-flex ga-1 align-center">
            <VProgressCircular size="14" width="2" indeterminate color="primary" />
            <span class="text-caption text-medium-emphasis ml-1">Thinking…</span>
          </div>
        </VCard>
      </div>

      <div v-if="error" class="d-flex align-center ga-2">
        <VAvatar size="28" color="error" class="flex-shrink-0">
          <VIcon icon="mdi-alert-circle-outline" size="16" />
        </VAvatar>
        <VCard color="error" variant="tonal" elevation="0" rounded="lg rounded-ts-sm" style="max-width: 88%">
          <VCardText class="pa-3 d-flex align-center ga-2">
            <!-- Config error: render "Settings" as a clickable link, no dismiss button -->
            <template v-if="isConfigError">
              <span class="text-body-2 mb-0">
                AI Assistant is not configured. Add your Gemini API key in
                <a class="error-link" @click.prevent="router.push('/setting')">Settings</a>.
              </span>
            </template>
            <template v-else>
              <span class="text-body-2 mb-0">{{ error }}</span>
              <VBtn
                icon="mdi-close"
                size="x-small"
                variant="text"
                color="error"
                class="flex-shrink-0"
                @click="clearError"
              />
            </template>
          </VCardText>
        </VCard>
      </div>

      <div ref="messagesEndRef" />
    </div>

    <!-- Input area (sticky at bottom) -->
    <div
      class="input-area pa-3 border-t"
      :class="{ 'drag-over': isDragOver }"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @drop.prevent="handleDrop"
    >
      <div v-if="attachedPreview" class="mb-2 position-relative" style="width: fit-content">
        <VImg :src="attachedPreview" width="80" height="60" cover rounded="lg" />

        <VBtn
          size="x-small"
          variant="elevated"
          icon="mdi-close"
          density="comfortable"
          style="position: absolute; top: -6px; right: -6px"
          @click="removeAttachment"
        />
      </div>

      <div class="d-flex ga-2 align-end">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="d-none"
          @change="handleFileSelect"
        />
        <VBtn icon="mdi-image-outline" variant="text" size="small" color="default" @click="fileInputRef?.click()" />

        <VTextarea
          v-model="inputText"
          :placeholder="isDragOver ? 'Drop image here…' : 'Describe your work…'"
          rows="1"
          auto-grow
          max-rows="4"
          hide-details
          flat
          class="flex-grow-1"
          @keydown="handleKeydown"
          @paste="handlePaste"
        >
          <template #append-inner>
            <VBtn
              icon="mdi-send"
              size="small"
              variant="text"
              :disabled="isLoading || (!inputText.trim() && !attachedFile)"
              @click="handleSend"
            >
              <template #default>
                <VIcon color="primary" />
              </template>
            </VBtn>
          </template>
        </VTextarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}

.border-t {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.input-area {
  transition: background-color 0.15s ease;
}

.input-area.drag-over {
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.error-link {
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  text-underline-offset: 2px;
  text-decoration: underline;
}
</style>
