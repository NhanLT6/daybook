<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useDisplay } from 'vuetify'
import { useAiChat } from '@/composables/useAiChat'
import { useUiStore } from '@/stores/ui'
import AiChatMessage from './AiChatMessage.vue'
import type { ExtractedLog } from '@/interfaces/AiChat'
import type { Project } from '@/interfaces/Project'
import type { Task } from '@/interfaces/Task'

const props = defineProps<{
  projects: Project[]
  tasks: Task[]
}>()

const emit = defineEmits<{
  saveLogs: [logs: ExtractedLog[]]
}>()

const { lgAndUp } = useDisplay()
const uiStore = useUiStore()
const { messages, isLoading, error, latestLogsMessageId, sendMessage } = useAiChat()

const inputText = ref('')
const attachedFile = ref<File | null>(null)
const attachedPreview = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const messagesEndRef = ref<HTMLDivElement | null>(null)

// Scroll to bottom on new messages
watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
  },
)

const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text && !attachedFile.value) return

  const file = attachedFile.value
  inputText.value = ''
  attachedFile.value = null
  attachedPreview.value = null

  await sendMessage(text, file, props.projects, props.tasks)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  attachedFile.value = file
  attachedPreview.value = URL.createObjectURL(file)
}

const handlePaste = (event: ClipboardEvent) => {
  const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
    i.type.startsWith('image/'),
  )
  if (!item) return
  event.preventDefault()
  const file = item.getAsFile()
  if (!file) return
  attachedFile.value = file
  attachedPreview.value = URL.createObjectURL(file)
}

const removeAttachment = () => {
  attachedFile.value = null
  attachedPreview.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const handleSaveLogs = (logs: ExtractedLog[]) => {
  emit('saveLogs', logs)
}

const clearError = () => {
  error.value = null
}
</script>

<template>
  <VNavigationDrawer
    v-model="uiStore.aiChatOpen"
    location="right"
    :temporary="!lgAndUp"
    width="360"
    class="ai-chat-panel"
  >
    <!-- Panel header -->
    <div class="d-flex align-center pa-3 border-b">
      <VIcon icon="mdi-creation" color="primary" class="mr-2" />
      <span class="text-subtitle-2 font-weight-semibold">AI Assistant</span>
      <VSpacer />
      <VBtn
        v-if="!lgAndUp"
        icon="mdi-close"
        variant="text"
        size="small"
        @click="uiStore.aiChatOpen = false"
      />
    </div>

    <!-- Messages area -->
    <div class="messages-area pa-3 d-flex flex-column ga-3">
      <!-- Empty state -->
      <div
        v-if="!messages.length"
        class="d-flex flex-column align-center justify-center text-center"
        style="min-height: 200px"
      >
        <VIcon icon="mdi-creation" size="36" color="primary" class="mb-3" opacity="0.5" />
        <p class="text-body-2 text-medium-emphasis mb-1">Describe your work or paste a screenshot</p>
        <p class="text-caption text-disabled">e.g. "DS-1234 for 2h this morning"</p>
      </div>

      <!-- Message list -->
      <AiChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :is-saveable="msg.id === latestLogsMessageId"
        @save-logs="handleSaveLogs"
      />

      <!-- Loading indicator -->
      <div v-if="isLoading" class="d-flex align-center ga-2">
        <VAvatar size="28" color="primary" class="flex-shrink-0">
          <VIcon icon="mdi-creation" size="16" />
        </VAvatar>
        <VCard color="surface-variant" rounded="lg rounded-ts-sm" elevation="0" class="pa-3">
          <div class="d-flex ga-1 align-center">
            <VProgressCircular size="14" width="2" indeterminate color="primary" />
            <span class="text-caption text-medium-emphasis ml-1">Thinking…</span>
          </div>
        </VCard>
      </div>

      <!-- Error message -->
      <VAlert v-if="error" type="error" variant="tonal" density="compact" closable @click:close="clearError">
        {{ error }}
      </VAlert>

      <!-- Scroll anchor -->
      <div ref="messagesEndRef" />
    </div>

    <!-- Input area (pinned to bottom) -->
    <template #append>
      <div class="input-area pa-3 border-t">
        <!-- Image attachment preview -->
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
          <!-- File attach button -->
          <VBtn
            icon="mdi-image-plus"
            variant="text"
            size="small"
            color="default"
            @click="fileInputRef?.click()"
          />
          <input
            ref="fileInputRef"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="d-none"
            @change="handleFileSelect"
          />

          <!-- Text input -->
          <VTextarea
            v-model="inputText"
            placeholder="Describe your work or paste a screenshot…"
            variant="outlined"
            density="compact"
            rows="1"
            auto-grow
            max-rows="4"
            hide-details
            class="flex-grow-1"
            @keydown="handleKeydown"
            @paste="handlePaste"
          />

          <!-- Send button -->
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
