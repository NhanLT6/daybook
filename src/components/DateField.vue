<script setup lang="ts">
import { computed, ref } from 'vue';

import dayjs from 'dayjs';

import { useSettingsStore } from '@/stores/settings';

defineOptions({ inheritAttrs: false });

// A date field that opens Vuetify's date picker; the model is a 'YYYY-MM-DD' string
const model = defineModel<string>({ required: true });

const props = withDefaults(defineProps<{ displayFormat?: string; min?: string; hideIcon?: boolean }>(), {
  displayFormat: 'ddd, MMM D, YYYY',
  min: undefined,
});

const settingsStore = useSettingsStore();
const isOpen = ref(false);

const display = computed(() => (model.value ? dayjs(model.value).format(props.displayFormat) : ''));

const pickerModel = computed({
  get: () => (model.value ? dayjs(model.value).toDate() : undefined),
  // Clicking the picked day again clears Vuetify's selection; keep the date instead
  set: (date: Date | undefined) => {
    if (date) model.value = dayjs(date).format('YYYY-MM-DD');
    isOpen.value = false;
  },
});
</script>

<template>
  <VMenu v-model="isOpen" :close-on-content-click="false">
    <template #activator="{ props: activator }">
      <!-- $attrs: label, variant, density, error-messages... go to the text field -->
      <VTextField v-bind="{ ...$attrs, ...activator }" :model-value="display" :append-inner-icon="hideIcon ? undefined : 'mdi-calendar'" readonly />
    </template>
    <VDatePicker
      v-model="pickerModel"
      :min="min"
      :first-day-of-week="settingsStore.firstDayOfWeek"
      hide-header
    />
  </VMenu>
</template>
