<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useAiChat } from '@/composables/useAiChat';

import type { ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useDisplay } from 'vuetify';

import { useUiStore } from '@/stores/ui';

import AiChatMessage from './AiChatMessage.vue';

const props = defineProps<{
  projects: Project[];
  tasks: Task[];
  inline?: boolean;
}>();

const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]];
}>();

const { lgAndUp } = useDisplay();
const uiStore = useUiStore();

// On large screens the panel is always visible (permanent drawer).
// On small screens it's controlled by the store toggle.
const chatOpen = computed({
  get: () => lgAndUp.value || uiStore.aiChatOpen,
  set: (val) => {
    uiStore.aiChatOpen = val;
  },
});
const { messages, isLoading, error, latestLogsMessageId, sendMessage } = useAiChat();

const inputText = ref('');
const attachedFile = ref<File | null>(null);
const attachedPreview = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const messagesEndRef = ref<HTMLDivElement | null>(null);

// Scroll to bottom on new messages
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

const handleFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  attachedFile.value = file;
  attachedPreview.value = URL.createObjectURL(file);
};

const handlePaste = (event: ClipboardEvent) => {
  const item = Array.from(event.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
  if (!item) return;
  event.preventDefault();
  const file = item.getAsFile();
  if (!file) return;
  attachedFile.value = file;
  attachedPreview.value = URL.createObjectURL(file);
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
  <!-- Inline mode: plain flex column, used inside tabs -->
  <div v-if="props.inline" class="d-flex flex-column fill-height">
    <!-- Panel header -->
    <div class="d-flex align-center pa-3 border-b">
      <VIcon icon="mdi-creation" color="primary" class="mr-2" />
      <span class="text-subtitle-2 font-weight-semibold">AI Assistant</span>
    </div>

    <!-- Messages area -->
    <div class="messages-area pa-3 d-flex flex-column ga-3 flex-grow-1 overflow-y-auto">
      <div
        v-if="!messages.length"
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

      <VAlert v-if="error" type="error" variant="tonal" density="compact" closable @click:close="clearError">
        {{ error }}
      </VAlert>

      <div ref="messagesEndRef" />
    </div>

    <!-- Input area (normal flow, not pinned via slot) -->
    <div class="input-area pa-3 border-t">
      <div v-if="attachedPreview" class="mb-2 position-relative" style="width: fit-content">
        <VImg :src="attachedPreview" width="80" height="60" cover rounded="lg" />
        <VBtn
          icon="mdi-close-circle"
          size="x-small"
          color="error"
          style="position: absolute; top: -6px; right: -6px"
          @click="removeAttachment"
        />
      </div>
      <div class="d-flex ga-2 align-end">
        <VBtn icon="mdi-image-plus" variant="text" size="small" color="default" @click="fileInputRef?.click()" />
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          class="d-none"
          @change="handleFileSelect"
        />
        <VTextarea
          v-model="inputText"
          placeholder="Describe your work or paste a screenshot…"
          rows="1"
          auto-grow
          max-rows="4"
          hide-details
          flat
          class="flex-grow-1"
          @keydown="handleKeydown"
          @paste="handlePaste"
        />
        <VBtn
          icon="mdi-send"
          color="primary"
          size="small"
          :disabled="isLoading || (!inputText.trim() && !attachedFile)"
          @click="handleSend"
        />
      </div>
    </div>
  </div>

  <!-- Drawer mode: original behavior (mobile toggle + large screen permanent) -->
  <VNavigationDrawer v-else v-model="chatOpen" location="right" :temporary="!lgAndUp" width="500" class="ai-chat-panel">
    <!-- Panel header -->
    <div class="d-flex align-center pa-3 border-b">
      <VIcon icon="mdi-creation" color="primary" class="mr-2" />
      <span class="text-subtitle-2 font-weight-semibold">AI Assistant</span>
      <VSpacer />
      <VBtn v-if="!lgAndUp" icon="mdi-close" variant="text" size="small" @click="uiStore.aiChatOpen = false" />
    </div>

    <!-- Messages area -->
    <div class="messages-area pa-3 d-flex flex-column ga-3">
      <div
        v-if="!messages.length"
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

      <VAlert v-if="error" type="error" variant="tonal" density="compact" closable @click:close="clearError">
        {{ error }}
      </VAlert>

      <div ref="messagesEndRef" />
    </div>

    <!-- Input area (pinned to bottom) -->
    <template #append>
      <div class="input-area pa-3 border-t">
        <div v-if="attachedPreview" class="mb-2 position-relative" style="width: fit-content">
          <VImg :src="attachedPreview" width="80" height="60" cover rounded="lg" />
          <VBtn
            icon="mdi-close-circle"
            size="x-small"
            color="error"
            style="position: absolute; top: -6px; right: -6px"
            @click="removeAttachment"
          />
        </div>

        <div class="d-flex ga-2 align-end">
          <VBtn icon="mdi-image-plus" variant="text" size="small" color="default" @click="fileInputRef?.click()" />
          <input
            ref="fileInputRef"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="d-none"
            @change="handleFileSelect"
          />
          <VTextarea
            v-model="inputText"
            placeholder="Describe your work or paste a screenshot…"
            rows="1"
            auto-grow
            max-rows="4"
            hide-details
            flat
            class="flex-grow-1"
            @keydown="handleKeydown"
            @paste="handlePaste"
          />
          <VBtn
            icon="mdi-send"
            color="primary"
            size="small"
            :disabled="isLoading || (!inputText.trim() && !attachedFile)"
            @click="handleSend"
          />
        </div>
      </div>
    </template>
  </VNavigationDrawer>
</template>

<style scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  /* Round the left edge of the right-side drawer to match app card style */
  border-radius: 12px 0 0 12px !important;
  overflow: hidden;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.border-t {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
