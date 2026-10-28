<script setup lang="ts">
import { computed } from 'vue';

import type { ExtractedLog } from '@/interfaces/AiChat';

const props = defineProps<{
  log: ExtractedLog;
}>();

const durationLabel = computed(() => {
  const { duration, restOfDay } = props.log;
  if (restOfDay) return duration != null ? `Rest · ${duration} min` : 'Nothing left';
  return duration != null ? `${duration} min` : 'Plan';
});
</script>

<template>
  <!-- Single extracted log displayed inside an AI chat bubble -->
  <VCard color="surface-variant" variant="tonal" rounded="lg" class="log-card pa-2">
    <div class="d-flex align-center ga-2">
      <!-- Colored dot accent -->
      <div class="log-dot bg-primary rounded-circle flex-shrink-0" />

      <div class="flex-grow-1 min-width-0">
        <!-- Project · task on one line (long names truncate) so every card reads title, date, note -->
        <div class="d-flex align-center ga-1" :title="log.task ? `${log.project} › ${log.task}` : log.project">
          <span class="text-body-2 font-weight-medium text-truncate">{{ log.project }}</span>
          <template v-if="log.task">
            <span class="text-caption text-medium-emphasis flex-shrink-0">·</span>
            <span class="text-caption text-medium-emphasis text-truncate flex-shrink-0 task-name">{{ log.task }}</span>
          </template>
        </div>
        <div class="d-flex align-center ga-1 mt-1">
          <VIcon icon="mdi-calendar-outline" size="12" class="text-medium-emphasis" />
          <span class="text-caption text-medium-emphasis">{{ log.date }}</span>
        </div>
        <p v-if="log.description" class="text-caption text-medium-emphasis mt-1 mb-0">
          {{ log.description }}
        </p>
      </div>

      <!-- Duration chip: plan entries have no logged time yet; "the rest" is worked out from the daily target -->
      <VChip
        size="small"
        variant="tonal"
        :color="log.restOfDay && log.duration == null ? 'error' : 'primary'"
        class="flex-shrink-0"
        :title="log.restOfDay ? 'Daily target minus what is already logged that day' : undefined"
      >
        {{ durationLabel }}
      </VChip>
    </div>
  </VCard>
</template>

<style scoped>
.log-dot {
  width: 8px;
  height: 8px;
}

.min-width-0 {
  min-width: 0;
}

/* The task gives way first only past 45%, so a long ticket title still leaves it readable */
.task-name {
  max-width: 45%;
}
</style>
