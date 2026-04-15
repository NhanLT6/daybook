<script setup lang="ts">
import type { ExtractedLog } from '@/interfaces/AiChat'

defineProps<{
  log: ExtractedLog
}>()
</script>

<template>
  <!-- Single extracted log displayed inside an AI chat bubble -->
  <VCard variant="outlined" rounded="lg" class="log-card pa-2">
    <div class="d-flex align-center ga-2">
      <!-- Colored dot accent -->
      <div class="log-dot bg-primary rounded-circle flex-shrink-0" />

      <div class="flex-grow-1 min-width-0">
        <div class="d-flex align-center ga-1 flex-wrap">
          <span class="text-body-2 font-weight-medium text-truncate">{{ log.project }}</span>
          <span class="text-caption text-medium-emphasis">·</span>
          <span class="text-caption text-medium-emphasis text-truncate">{{ log.task }}</span>
        </div>
        <div class="d-flex align-center ga-1 mt-1">
          <VIcon icon="mdi-calendar-outline" size="12" class="text-medium-emphasis" />
          <span class="text-caption text-medium-emphasis">{{ log.date }}</span>
        </div>
        <p v-if="log.description" class="text-caption text-medium-emphasis mt-1 mb-0">
          {{ log.description }}
        </p>
      </div>

      <!-- Duration chip -->
      <VChip size="small" variant="tonal" color="primary" class="flex-shrink-0">
        {{ log.duration }} min
      </VChip>
    </div>
  </VCard>
</template>

<style scoped>
.log-card {
  border-color: rgba(var(--v-theme-on-surface), 0.12);
}

.log-dot {
  width: 8px;
  height: 8px;
}

.min-width-0 {
  min-width: 0;
}
</style>
