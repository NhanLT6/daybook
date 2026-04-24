<script setup lang="ts">
import { computed } from 'vue';

import { stripJsonBlock } from '@/composables/useAiChat';

import type { DaybookUIMessage, ExtractedLog } from '@/interfaces/AiChat';
import type { FileUIPart, TextUIPart } from 'ai';

import AiLogCard from './AiLogCard.vue';

const props = defineProps<{
  message: DaybookUIMessage;
  isSaveable: boolean;
  isUndoable: boolean;
  canRetry: boolean;
}>();

const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]];
  discard: [];
  undo: [];
  retry: [];
}>();

const textPart = computed(() => props.message.parts.find((p): p is TextUIPart => p.type === 'text'));

const filePart = computed(() => props.message.parts.find((p): p is FileUIPart => p.type === 'file'));

// Strip JSON block only once logs have been extracted (i.e. streaming finished)
const displayText = computed(() => {
  const raw = textPart.value?.text ?? '';
  return props.message.metadata?.extractedLogs !== undefined ? stripJsonBlock(raw) : raw;
});

const extractedLogs = computed(() => props.message.metadata?.extractedLogs);
const saveState = computed(() => props.message.metadata?.saveState);

const handleSave = () => {
  if (extractedLogs.value?.length) {
    emit('saveLogs', extractedLogs.value);
  }
};

const copyMessage = () => {
  if (displayText.value) {
    navigator.clipboard.writeText(displayText.value);
  }
};
</script>

<template>
  <div :class="['d-flex ga-2', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <!-- AI avatar -->
    <VAvatar v-if="message.role === 'assistant'" size="28" color="primary" class="mt-1 flex-shrink-0">
      <VIcon icon="mdi-creation" size="16" />
    </VAvatar>

    <!-- User message with hover actions -->
    <VHover v-if="message.role === 'user'" v-slot="{ isHovering, props: hoverProps }">
      <div v-bind="hoverProps" class="d-flex flex-column align-end">
        <VCard
          color="primary"
          variant="tonal"
          :elevation="0"
          rounded="lg rounded-te-sm"
          class="message-card"
          :style="{ maxWidth: '88%' }"
        >
          <VCardText class="pa-3">
            <VImg
              v-if="filePart"
              :src="filePart.url"
              rounded="lg"
              class="mb-2 position-relative"
              style="z-index: 1"
              width="200"
              max-height="160"
              cover
            />
            <p
              v-if="displayText"
              class="text-body-2 mb-0 message-text"
              style="white-space: pre-wrap; word-break: break-word"
            >
              {{ displayText }}
            </p>
          </VCardText>
        </VCard>

        <!-- Hover action row — visibility avoids d-flex !important overriding display:none, and keeps space to prevent content shift -->
        <div :style="{ visibility: isHovering ? 'visible' : 'hidden' }" class="d-flex justify-end ga-1 mt-n4">
          <VBtn icon="mdi-content-copy" size="small" variant="tonal" density="comfortable" @click="copyMessage" />
          <VBtn
            v-if="canRetry"
            icon="mdi-refresh"
            size="small"
            variant="tonal"
            density="comfortable"
            color="error"
            @click="emit('retry')"
          />
        </div>
      </div>
    </VHover>

    <!-- AI message -->
    <VCard
      v-else
      color="container"
      variant="elevated"
      :elevation="0"
      rounded="lg rounded-ts-sm"
      class="message-card"
      :style="{ maxWidth: '88%' }"
    >
      <VCardText class="pa-3">
        <p
          v-if="displayText"
          class="text-body-2 mb-0 message-text"
          style="white-space: pre-wrap; word-break: break-word"
        >
          {{ displayText }}
        </p>

        <!-- Extracted log cards + action area -->
        <template v-if="extractedLogs?.length">
          <div class="d-flex flex-column ga-2 mt-3">
            <AiLogCard v-for="(log, i) in extractedLogs" :key="i" :log="log" />
          </div>

          <div class="d-flex ga-2 justify-end mt-3">
            <!-- Discarded state -->
            <template v-if="saveState === 'discarded'">
              <VChip size="small" prepend-icon="mdi-close-circle-outline" variant="tonal">Discarded</VChip>
            </template>

            <!-- Saved state: undo available or committed -->
            <template v-else-if="saveState === 'saved'">
              <VBtn size="small" color="primary" variant="tonal" :disabled="!isUndoable" @click="emit('undo')">
                Undo
              </VBtn>
            </template>

            <!-- Pending state: save + discard -->
            <template v-else>
              <VBtn size="small" variant="text" color="default" :disabled="!isSaveable" @click="emit('discard')">
                Discard
              </VBtn>
              <VBtn size="small" color="primary" variant="tonal" :disabled="!isSaveable" @click="handleSave">
                Save {{ extractedLogs.length }} log{{ extractedLogs.length > 1 ? 's' : '' }}
              </VBtn>
            </template>
          </div>
        </template>
      </VCardText>
    </VCard>
  </div>
</template>

<style scoped>
.message-card {
  word-break: break-word;
}
</style>
