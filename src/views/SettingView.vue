<script setup lang="ts">
import { computed } from 'vue';

import { useSettingsStore } from '@/stores/settings';

import dayjs from 'dayjs';

const settingsStore = useSettingsStore();

// Create a preview of current date format
const dateFormatPreview = computed(() => {
  const today = dayjs();
  return today.format(settingsStore.dateDisplayFormat);
});

// Create a computed property for weekend display
const selectedWeekendPattern = computed({
  get: () => {
    // Find the pattern that matches current weekend days
    const current = settingsStore.weekendPatterns.find(pattern => 
      JSON.stringify(pattern.value.sort()) === JSON.stringify([...settingsStore.weekendDays].sort())
    );
    return current || settingsStore.weekendPatterns[0];
  },
  set: (pattern) => {
    settingsStore.weekendDays = pattern.value;
  }
});

</script>

<template>
  <VRow justify="start">
    <VCol cols="12" md="6" lg="4">
      <form class="d-flex flex-column ga-2">
        <!-- Date Display Format -->
        <VSelect
          v-model="settingsStore.dateDisplayFormat"
          :items="settingsStore.dateFormatOptions"
          label="Date Display Format"
          item-title="label"
          item-value="value"
          persistent-hint
          :hint="`Preview: ${dateFormatPreview}. This affects how dates are displayed in the interface only. Import/export formats remain unchanged.`"
        >
          <template #item="{ props, item }">
            <VListItem v-bind="props" :subtitle="item.raw.example" />
          </template>
        </VSelect>

        <!-- First day of week -->
        <VSelect
          v-model="settingsStore.firstDayOfWeek"
          :items="settingsStore.firstDayOfWeekOptions"
          label="First day of week"
          item-title="label"
          item-value="value"
          persistent-hint
          hint="This option changes which day is the first day of the week in Calendar component"
        >
        </VSelect>

        <!-- Weekend days -->
        <VSelect
          v-model="selectedWeekendPattern"
          :items="settingsStore.weekendPatterns"
          label="Weekend days"
          item-title="label"
          return-object
          persistent-hint
          hint="This option changes which days are highlighted as weekend days in Calendar and affects time tracking calculations"
        >
          <template #item="{ props, item }">
            <VListItem v-bind="props" :subtitle="item.raw.description" />
          </template>
        </VSelect>


      </form>
    </VCol>
  </VRow>
</template>

<style scoped></style>
