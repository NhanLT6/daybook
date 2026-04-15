<script setup lang="ts">
import type { ChatMessage, ExtractedLog } from '@/interfaces/AiChat'
import AiLogCard from './AiLogCard.vue'

const props = defineProps<{
  message: ChatMessage
  // Whether this specific message's Save button is active
  isSaveable: boolean
}>()

const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]]
}>()

const handleSave = () => {
  if (props.message.extractedLogs?.length) {
    emit('saveLogs', props.message.extractedLogs)
  }
}
</script>

<template>
  <div :class="['d-flex ga-2', message.role === 'user' ? 'justify-end' : 'justify-start']">

    <!-- AI avatar -->
    <VAvatar v-if="message.role === 'assistant'" size="28" color="primary" class="mt-1 flex-shrink-0">
      <VIcon icon="mdi-creation" size="16" />
    </VAvatar>

    <!-- Message card -->
    <VCard
      :color="message.role === 'user' ? 'primary' : 'surface-variant'"
      :rounded="message.role === 'user' ? 'lg rounded-te-sm' : 'lg rounded-ts-sm'"
      class="message-card"
      :style="{ maxWidth: '88%' }"
      elevation="0"
    >
      <VCardText class="pa-3">

        <!-- Image attachment (user messages) -->
        <VImg
          v-if="message.imageBase64"
          :src="message.imageBase64"
          rounded="lg"
          class="mb-2"
          max-height="160"
          cover
        />

        <!-- Message text -->
        <p
          v-if="message.content"
          class="text-body-2 mb-0 message-text"
          :class="message.role === 'user' ? 'text-on-primary' : ''"
          style="white-space: pre-wrap; word-break: break-word;"
        >{{ message.content }}</p>

        <!-- Extracted log cards (AI messages only) -->
        <template v-if="message.extractedLogs?.length">
          <div class="d-flex flex-column ga-2 mt-3">
            <AiLogCard
              v-for="(log, i) in message.extractedLogs"
              :key="i"
              :log="log"
            />
          </div>

          <!-- Save / Discard actions -->
          <div class="d-flex ga-2 justify-end mt-3">
            <VBtn
              size="small"
              variant="text"
              color="default"
              :disabled="!isSaveable"
            >
              Discard
            </VBtn>
            <VBtn
              size="small"
              color="primary"
              variant="tonal"
              :disabled="!isSaveable"
              @click="handleSave"
            >
              Save {{ message.extractedLogs.length }} log{{ message.extractedLogs.length > 1 ? 's' : '' }}
            </VBtn>
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

/* Ensure text contrast inside primary-colored user bubble */
.message-text.text-on-primary {
  color: rgb(var(--v-theme-on-primary));
}
</style>
