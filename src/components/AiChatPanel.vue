<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import { useAiChat } from '@/composables/useAiChat';
import { fetchCatchUpItems, onCatchUpView } from '@/composables/useCatchUpSummary';

import type { ExtractedLog } from '@/interfaces/AiChat';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { TextUIPart } from 'ai';

import { useRouter } from 'vue-router';

import AiChatMessage from './AiChatMessage.vue';

const props = defineProps<{
  projects: Project[];
  tasks: Task[];
}>();

const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]];
  undoLogs: [];
}>();

const {
  messages,
  isLoading,
  error,
  latestLogsMessageId,
  savedLogsMessageId,
  sendMessage,
  markSaved,
  markUndone,
  markDiscarded,
  injectCatchUp,
} = useAiChat();
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

// ID of the last user message — used to show the retry button on error
const lastUserMessageId = computed(() => [...messages.value].reverse().find((m) => m.role === 'user')?.id ?? null);

const handleSaveLogs = (messageId: string, logs: ExtractedLog[]) => {
  markSaved(messageId);
  emit('saveLogs', logs);
};

const handleUndo = (messageId: string) => {
  const msg = messages.value.find((m) => m.id === messageId);
  markUndone(messageId);
  if (msg?.metadata?.extractedLogs?.length) emit('undoLogs');
};

const handleDiscard = (messageId: string) => {
  markDiscarded(messageId);
};

const handleRetry = async (messageId: string) => {
  const msg = messages.value.find((m) => m.id === messageId);
  const text = msg?.parts.find((p): p is TextUIPart => p.type === 'text')?.text ?? '';
  await sendMessage(text, null, props.projects, props.tasks);
};

const clearError = () => {
  error.value = null;
};

const isCatchUpLoading = ref(false);

const handleCatchUp = async () => {
  if (isCatchUpLoading.value || isLoading.value) return;
  isCatchUpLoading.value = true;
  try {
    const items = await fetchCatchUpItems();
    if (items?.length) {
      injectCatchUp(items);
    } else {
      error.value = 'No recent logs to summarize.';
    }
  } catch (err) {
    const axiosErr = err as { response?: { data?: { error?: string } } };
    error.value = axiosErr.response?.data?.error ?? (err instanceof Error ? err.message : 'Failed to load catch-up.');
  } finally {
    isCatchUpLoading.value = false;
  }
};

onMounted(() => {
  const off = onCatchUpView((items) => {
    injectCatchUp(items);
  });
  onUnmounted(off);
});
</script>

<template>
  <VCard class="ma-2 d-flex flex-column overflow-hidden" style="flex: 1; min-height: 0">
    <!-- Messages wrapper: positioned context so floating button doesn't scroll -->
    <div class="messages-wrapper">
      <!-- Scrollable messages area -->
      <div
        class="messages-area pa-3 d-flex flex-column ga-3 overflow-y-auto"
        :class="{ 'drag-over': isDragOver }"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop.prevent="handleDrop"
      >
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
          :is-undoable="msg.metadata?.saveState === 'saved' && msg.id === savedLogsMessageId"
          :can-retry="msg.id === lastUserMessageId && !!error"
          @save-logs="(logs) => handleSaveLogs(msg.id, logs)"
          @undo="() => handleUndo(msg.id)"
          @discard="() => handleDiscard(msg.id)"
          @retry="() => handleRetry(msg.id)"
        />

        <!-- Loading message -->
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

        <!-- Error message -->
        <div v-if="error" class="d-flex align-center ga-2">
          <VAvatar size="28" color="error" class="flex-shrink-0">
            <VIcon icon="mdi-alert-circle-outline" size="16" />
          </VAvatar>
          <VCard color="error" variant="tonal" elevation="0" rounded="lg rounded-ts-sm" style="max-width: 88%">
            <VCardText class="pa-3 d-flex align-center ga-2">
              <!-- Config error: no dismiss button — the error won't go away until the server is configured -->
              <template v-if="isConfigError">
                <span class="text-body-2 mb-0">AI is not available on this deployment.</span>
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

      <!-- Floating catch-up button — anchored to wrapper, never scrolls with messages -->
      <VBtn
        class="catchup-fab"
        :class="{ 'catchup-fab--loading': isCatchUpLoading }"
        size="small"
        variant="tonal"
        color="primary"
        :disabled="isLoading"
        @click="handleCatchUp"
      >
        <!-- Icon and spinner share the same fixed-size slot; CSS cross-fades between them -->
        <span class="fab-icon-area">
          <VProgressCircular class="fab-spinner" size="14" width="2" indeterminate />
          <VIcon class="fab-icon" icon="mdi-history" size="small" />
        </span>
        <span class="fab-label">Catch up</span>
      </VBtn>
    </div>

    <!-- Input area (sticky at bottom) -->
    <div class="input-area pa-3 border-t">
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
  </VCard>
</template>

<style scoped>
.messages-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 8px;
}

.catchup-fab {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 1;
  min-width: 0 !important;
  overflow: hidden;
}

/* Fixed-size slot that holds icon and spinner stacked on top of each other */
.catchup-fab .fab-icon-area {
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.catchup-fab .fab-spinner,
.catchup-fab .fab-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: opacity 0.18s ease;
}

/* Default: icon visible, spinner hidden */
.catchup-fab .fab-spinner { opacity: 0; }
.catchup-fab .fab-icon { opacity: 1; }

/* Loading: spinner visible, icon hidden */
.catchup-fab--loading .fab-spinner { opacity: 1; }
.catchup-fab--loading .fab-icon { opacity: 0; }

/* Label collapses like the notification island's idle shrink */
.catchup-fab .fab-label {
  max-width: 80px;
  overflow: hidden;
  white-space: nowrap;
  margin-left: 6px;
  transition:
    max-width 0.24s cubic-bezier(0.4, 1.02, 0.5, 1),
    margin-left 0.24s ease;
}

.catchup-fab--loading .fab-label {
  max-width: 0;
  margin-left: 0;
}

.border-t {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.input-area {
  transition: background-color 0.15s ease;
}

.drag-over {
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
