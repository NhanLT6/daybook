<script setup lang="ts">
import { computed, ref } from 'vue';

import type { DaybookUIMessage, ExtractedLog } from '@/interfaces/AiChat';
import type { AddEventInput, AddNoteInput, AddedItemOutput } from '@/interfaces/aiTools';
import type { CatchUpRenderItem } from '@/interfaces/CatchUp';
import type { FileUIPart, TextUIPart } from 'ai';

import { getToolName, isToolUIPart } from 'ai';

import dayjs from 'dayjs';

import { parseChatCommand } from '@/common/chatCommands';
import { removeAddedItem } from '@/composables/useAiChat';

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

// A reply that used a tool has text in several steps (before and after the tool call)
const textParts = computed(() => props.message.parts.filter((p): p is TextUIPart => p.type === 'text'));

const filePart = computed(() => props.message.parts.find((p): p is FileUIPart => p.type === 'file'));

const displayText = computed(() =>
  textParts.value
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join('\n\n'),
);

// Shows the user the answer came from their notes, not from the model's guess
const readNotes = computed(() =>
  props.message.parts.some((p) => isToolUIPart(p) && getToolName(p) === 'searchNotes'),
);

// User messages: a leading /command shows as a chip, the rest as the message text
const userCommand = computed(() => (props.message.role === 'user' ? parseChatCommand(displayText.value) : undefined));
const userText = computed(() => (userCommand.value?.command ? userCommand.value.rest : displayText.value));

// Notes and events the model saved in this reply, each with its own Undo
interface AddedItem {
  key: string;
  tool: 'addNote' | 'addEvent';
  id: string;
  icon: string;
  color: string;
  label: string;
}

const eventLabel = (e: AddEventInput) => {
  const fmt = (d: string) => dayjs(d).format('ddd D MMM');
  const days = e.endDate ? `${fmt(e.date)} – ${fmt(e.endDate)}` : fmt(e.date);
  const time = e.startTime ? ` ${e.startTime}${e.endTime ? `–${e.endTime}` : ''}` : '';
  return `${e.title} · ${days}${time}`;
};

const addedItems = computed<AddedItem[]>(() =>
  props.message.parts.flatMap((p) => {
    if (!isToolUIPart(p) || p.state !== 'output-available') return [];
    const name = getToolName(p);
    if (name !== 'addNote' && name !== 'addEvent') return [];
    const output = p.output as AddedItemOutput;
    if (!output.saved || !output.id) return [];
    return [
      name === 'addNote'
        ? {
            key: p.toolCallId,
            tool: name,
            id: output.id,
            icon: 'mdi-note-check-outline',
            color: 'cmd-note',
            label: (p.input as AddNoteInput).text.split('\n')[0],
          }
        : {
            key: p.toolCallId,
            tool: name,
            id: output.id,
            icon: 'mdi-calendar-check',
            color: 'cmd-event',
            label: eventLabel(p.input as AddEventInput),
          },
    ];
  }),
);

const undoneKeys = ref(new Set<string>());

const undoAdded = async (item: AddedItem) => {
  await removeAddedItem(item.tool, item.id);
  undoneKeys.value = new Set(undoneKeys.value).add(item.key);
};

const tool = computed(() => props.message.metadata?.tool);
const extractedLogs = computed(() => props.message.metadata?.extractedLogs);
const saveState = computed(() => props.message.metadata?.saveState);
const catchUpItems = computed<CatchUpRenderItem[] | undefined>(() => props.message.metadata?.catchUpItems);
const catchUpHasGroups = computed(() => catchUpItems.value?.some((i) => i.group) ?? false);
const catchUpDidItems = computed(() => catchUpItems.value?.filter((i) => i.group === 'did') ?? []);
const catchUpTodoItems = computed(() => catchUpItems.value?.filter((i) => i.group === 'todo') ?? []);
const catchUpNoteItems = computed(() => catchUpItems.value?.filter((i) => i.group === 'notes') ?? []);

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
  <!-- User message: tonal bubble on the right, copy / retry on hover -->
  <div v-if="message.role === 'user'" class="user-row">
    <div class="chat-msg is-me">
      <img v-if="filePart?.url" :src="filePart.url" alt="Attached image" class="message-image" />
      <!-- Slash command chip, e.g. /note -->
      <span
        v-if="userCommand?.command"
        class="command-chip me-1"
        :style="{ '--chip-color': `var(--v-theme-${userCommand.command.color})` }"
      >
        <VIcon :icon="userCommand.command.icon" size="14" />/{{ userCommand.command.name }}
      </span>
      <span v-if="userText" class="message-text">{{ userText }}</span>
    </div>

    <div class="message-actions" :class="{ 'is-pinned': canRetry }">
      <VIconBtn icon="mdi-content-copy" size="x-small" variant="text" v-tooltip="'Copy'" @click="copyMessage" />
      <VIconBtn
        v-if="canRetry"
        icon="mdi-refresh"
        icon-color="error"
        size="x-small"
        variant="text"
        v-tooltip="'Retry'"
        @click="emit('retry')"
      />
    </div>
  </div>

  <!-- AI message: white bubble on the left -->
  <div v-else class="chat-msg is-ai ai-message">
    <!-- searchNotes marker -->
    <div v-if="readNotes" class="d-flex align-center ga-1 mb-1 text-caption text-medium-emphasis">
      <VIcon icon="mdi-note-text-outline" size="14" />
      Checked your notes
    </div>

    <!-- Plain text (conversational or streaming) — hidden for catchUp (text is AI context only) -->
    <p v-if="displayText && tool !== 'catchUp'" class="mb-0 message-text">{{ displayText }}</p>

    <!-- catchUp tool result -->
    <template v-if="tool === 'catchUp' && catchUpItems?.length">
      <!-- Grouped: Did / Todo / From your notes sections, each only when it has items -->
      <template v-if="catchUpHasGroups">
        <template v-if="catchUpDidItems.length">
          <p class="catchup-group-header">Did</p>
          <ul class="catchup-list">
            <li
              v-for="(entry, idx) in catchUpDidItems"
              :key="idx"
              class="catchup-item"
              :class="{ 'is-ongoing': entry.ongoing }"
            >
              {{ entry.text }}<span v-if="entry.effortLabel" class="catchup-effort"> · {{ entry.effortLabel }}</span>
            </li>
          </ul>
        </template>
        <template v-if="catchUpTodoItems.length">
          <p class="catchup-group-header mt-2">Todo</p>
          <ul class="catchup-list">
            <li v-for="(entry, idx) in catchUpTodoItems" :key="idx" class="catchup-item">
              {{ entry.text }}
            </li>
          </ul>
        </template>
        <template v-if="catchUpNoteItems.length">
          <p class="catchup-group-header mt-2">From your notes</p>
          <ul class="catchup-list">
            <li v-for="(entry, idx) in catchUpNoteItems" :key="idx" class="catchup-item">
              {{ entry.text }}
            </li>
          </ul>
        </template>
      </template>

      <!-- No groups: flat list -->
      <ul v-else class="catchup-list">
        <li
          v-for="(entry, idx) in catchUpItems"
          :key="idx"
          class="catchup-item"
          :class="{ 'is-ongoing': entry.ongoing }"
        >
          {{ entry.text }}<span v-if="entry.effortLabel" class="catchup-effort"> · {{ entry.effortLabel }}</span>
        </li>
      </ul>
    </template>

    <!-- addNote / addEvent results: what was saved, each undoable -->
    <div v-if="addedItems.length" class="d-flex flex-column ga-1 mt-2">
      <div v-for="item in addedItems" :key="item.key" class="added-item d-flex align-center ga-2">
        <VIcon :icon="item.icon" size="16" :color="undoneKeys.has(item.key) ? undefined : item.color" />
        <span class="flex-grow-1 text-truncate" :class="{ 'is-undone': undoneKeys.has(item.key) }">
          {{ item.label }}
        </span>
        <span v-if="undoneKeys.has(item.key)" class="text-caption text-medium-emphasis">Removed</span>
        <VBtn v-else size="x-small" variant="text" color="primary" @click="undoAdded(item)">Undo</VBtn>
      </div>
    </div>

    <!-- extractLogs tool result + action area -->
    <template v-if="tool === 'extractLogs' && extractedLogs?.length">
      <div class="d-flex flex-column ga-2 mt-2">
        <AiLogCard v-for="(log, i) in extractedLogs" :key="i" :log="log" />
      </div>

      <div class="d-flex ga-2 justify-end align-center mt-2">
        <!-- Discarded state -->
        <span v-if="saveState === 'discarded'" class="text-caption text-medium-emphasis">Discarded</span>

        <!-- Saved state: undo available or committed -->
        <template v-else-if="saveState === 'saved'">
          <span v-if="!isUndoable" class="text-caption text-medium-emphasis">Saved</span>
          <VBtn v-else size="small" rounded="pill" color="primary" variant="tonal" @click="emit('undo')">Undo</VBtn>
        </template>

        <!-- Pending state: save + discard -->
        <template v-else>
          <VBtn size="small" rounded="pill" variant="text" :disabled="!isSaveable" @click="emit('discard')">
            Discard
          </VBtn>
          <VBtn size="small" rounded="pill" color="primary" variant="tonal" :disabled="!isSaveable" @click="handleSave">
            Save {{ extractedLogs.length }} log{{ extractedLogs.length > 1 ? 's' : '' }}
          </VBtn>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.user-row {
  align-self: flex-end;
  max-width: 86%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.user-row .chat-msg {
  max-width: 100%;
}

.message-text {
  white-space: pre-wrap;
}

.message-image {
  display: block;
  width: 200px;
  max-width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 6px;
}

/* Copy / retry: on hover, or always while a retry is offered */
.message-actions {
  display: flex;
  gap: 2px;
  height: 0;
  overflow: visible;
  opacity: 0;
  transition: opacity 0.15s;
}

.user-row:hover .message-actions,
.message-actions.is-pinned {
  height: auto;
  opacity: 1;
}

.ai-message {
  width: fit-content;
}

.added-item {
  min-width: 0;
}

.added-item .is-undone {
  text-decoration: line-through;
  opacity: 0.6;
}

.catchup-list {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 1.5;
}

.catchup-item {
  position: relative;
  padding-left: 16px;
  margin-bottom: 4px;
}

.catchup-item::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 0.55em;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(140, 140, 140, 0.6);
}

.catchup-item.is-ongoing::before {
  background: #f5b301;
}

.catchup-effort {
  color: rgba(140, 140, 140, 0.85);
  font-variant-numeric: tabular-nums;
}

.catchup-group-header {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(140, 140, 140, 0.85);
  margin: 4px 0 2px;
}
</style>
