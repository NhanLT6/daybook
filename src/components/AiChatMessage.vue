<script setup lang="ts">
import type { ChatMessage, ExtractedLog } from '@/interfaces/AiChat';

import AiLogCard from './AiLogCard.vue';

const props = defineProps<{
  message: ChatMessage;
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

const handleSave = () => {
  if (props.message.extractedLogs?.length) {
    emit('saveLogs', props.message.extractedLogs);
  }
};

const copyMessage = () => {
  if (props.message.content) {
    navigator.clipboard.writeText(props.message.content);
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
              v-if="message.imageBase64"
              :src="message.imageBase64"
              rounded="lg"
              class="mb-2 position-relative"
              style="z-index: 1"
              width="200"
              max-height="160"
              cover
            />
            <p
              v-if="message.content"
              class="text-body-2 mb-0 message-text"
              style="white-space: pre-wrap; word-break: break-word"
            >
              {{ message.content }}
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
        <!-- Image attachment -->
        <VImg
          v-if="message.imageBase64"
          :src="message.imageBase64"
          rounded="lg"
          class="mb-2 position-relative"
          style="z-index: 1"
          width="200"
          max-height="160"
          cover
        />

        <!-- Message text -->
        <p
          v-if="message.content"
          class="text-body-2 mb-0 message-text"
          style="white-space: pre-wrap; word-break: break-word"
        >
          {{ message.content }}
        </p>

        <!-- Extracted log cards + action area -->
        <template v-if="message.extractedLogs?.length">
          <div class="d-flex flex-column ga-2 mt-3">
            <AiLogCard v-for="(log, i) in message.extractedLogs" :key="i" :log="log" />
          </div>

          <div class="d-flex ga-2 justify-end mt-3">
            <!-- Discarded state -->
            <template v-if="message.saveState === 'discarded'">
              <VChip size="small" prepend-icon="mdi-close-circle-outline" variant="tonal">Discarded</VChip>
            </template>

            <!-- Saved state: undo available or committed -->
            <template v-else-if="message.saveState === 'saved'">
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
                Save {{ message.extractedLogs.length }} log{{ message.extractedLogs.length > 1 ? 's' : '' }}
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
