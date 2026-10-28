<script setup lang="ts">
import { computed } from 'vue';

import type { ChatLog } from '@/interfaces/AiChat';

import dayjs from 'dayjs';

import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { ticketKeyOf } from '@/common/extractedLogs';
import { useDateDisplay } from '@/composables/useDateDisplay';

const props = defineProps<{
  log: ChatLog;
}>();

const { formatInternalDateForDisplay } = useDateDisplay();

// Same icons as the chat's / menu, so a ticket, a project and a task read the same everywhere
const projectIcon = computed(() => (ticketKeyOf(props.log.project) ? 'mdi-ticket-outline' : 'mdi-folder-outline'));

// When: "Today" / "Yesterday" read faster than a date; anything else gets its weekday
const dateLabel = computed(() => {
  const date = dayjs(props.log.date);
  const today = dayjs().startOf('day');
  if (date.isSame(today, 'day')) return 'Today';
  if (date.isSame(today.subtract(1, 'day'), 'day')) return 'Yesterday';
  return `${date.format('ddd')} ${formatInternalDateForDisplay(props.log.date)}`;
});

// How much: hours and minutes like the log list; a plan has none yet, "the rest" says where it came from
const amount = computed(() => {
  const { duration, restOfDay } = props.log;
  if (restOfDay && duration == null) return { text: 'Nothing left to fill', hint: undefined, error: true };
  if (duration == null) return { text: 'Plan', hint: 'no time yet', error: false };
  return { text: minutesToHourWithMinutes(duration), hint: restOfDay ? 'rest of the day' : undefined, error: false };
});
</script>

<template>
  <!-- One extracted log: what (project, task, note), then when and how much on one line -->
  <VCard color="surface-variant" variant="tonal" rounded="lg" class="log-card px-3 py-2">
    <!-- What -->
    <div class="log-line" :title="log.project">
      <VIcon :icon="projectIcon" size="16" class="text-medium-emphasis" aria-label="Project" />
      <span class="text-body-2 font-weight-medium text-truncate">{{ log.project }}</span>
      <span v-if="log.newProject" class="new-tag">New</span>
    </div>
    <div v-if="log.task" class="log-line" :title="log.task">
      <VIcon icon="mdi-subdirectory-arrow-right" size="16" class="text-medium-emphasis" aria-label="Task" />
      <span class="text-body-2 text-truncate">{{ log.task }}</span>
      <span v-if="log.newTask" class="new-tag">New</span>
    </div>
    <p v-if="log.description" class="log-note text-caption text-medium-emphasis mb-0">{{ log.description }}</p>

    <!-- When + how much -->
    <div class="log-line log-when mt-1 text-caption">
      <VIcon icon="mdi-calendar-outline" size="14" class="text-medium-emphasis" />
      <span class="text-medium-emphasis">{{ dateLabel }}</span>
      <span class="text-medium-emphasis">·</span>
      <span class="font-weight-medium" :class="amount.error ? 'text-error' : 'text-primary'">{{ amount.text }}</span>
      <span v-if="amount.hint" class="text-medium-emphasis">{{ amount.hint }}</span>
    </div>
  </VCard>
</template>

<style scoped>
.log-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

/* The note sits under the names it belongs to, lined up with their text */
.log-note {
  padding-left: 22px;
}

.log-when {
  padding-top: 6px;
  border-top: 1px solid rgba(var(--v-border-color), 0.12);
}

/* Quiet outline tag, like the mention chips: a name that Save will create */
.new-tag {
  flex-shrink: 0;
  padding: 0 6px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  font-size: 0.6875rem;
  line-height: 16px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
