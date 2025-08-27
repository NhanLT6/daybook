<script setup lang="ts">
import { computed, watch } from 'vue';

import { useDateDisplay } from '@/composables/useDateDisplay';
import { useDefaultTasksProjects } from '@/composables/useDefaultTasksProjects';
import { useProjectColors } from '@/composables/useProjectColors';

import type { XeroLog } from '@/interfaces/XeroLog';
import type { XeroProject } from '@/interfaces/XeroProject';
import type { XeroTask } from '@/interfaces/XeroTask';

import { useField, useForm } from 'vee-validate';
import { array, date, number, object, string } from 'yup';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { nanoid } from 'nanoid';

interface BulkLogFormData {
  id?: string;
  selectedDates: Date[];
  project?: string;
  task?: string;
  duration?: number;
  description?: string;
}

const { selectedDates } = defineProps<{
  selectedDates: Date[];
}>();

const emit = defineEmits<{
  submit: [logs: XeroLog[]];
  cancel: [];
}>();

const projectColors = useProjectColors();
const { tasks, projects, projectItems, taskItems } = useDefaultTasksProjects();

const taskItemsForProject = computed(() => taskItems.value(projectField.value.value));

const validationSchema = object({
  selectedDates: array(date()).min(1, 'At least one date must be selected'),
  project: string().required('Required'),
  task: string().required('Required'),
  duration: number().required('Required').min(1, 'Must be greater than 0'),
  description: string(),
});

const emptyLog: BulkLogFormData = {
  id: undefined,
  selectedDates: [],
  project: undefined,
  task: undefined,
  duration: undefined,
  description: undefined,
};

const { errors, handleSubmit, resetForm, setFieldValue } = useForm<BulkLogFormData>({
  initialValues: emptyLog,
  validationSchema,
  validateOnMount: false,
});

const selectedDatesField = useField<Date[]>('selectedDates');
const projectField = useField<string>('project');
const taskField = useField<string>('task');
const durationField = useField<number>('duration');
const descriptionField = useField<string>('description');

// Watch for prop changes after fields are declared
watch(
  () => selectedDates,
  (newDates) => {
    // Only update if dates actually changed to avoid unnecessary validation
    if (JSON.stringify(selectedDatesField.value.value) !== JSON.stringify(newDates)) {
      selectedDatesField.setValue(newDates, false); // false = don't validate
    }
  },
  { immediate: true },
);

const selectedDatesText = computed(() => {
  if (!selectedDatesField.value.value || selectedDatesField.value.value.length === 0) {
    return '';
  }

  const dates = [...selectedDatesField.value.value].sort((a, b) => dayjs(a).diff(dayjs(b)));

  // Use compact format for selected dates display (no year, space-efficient)
  const formatCompact = (date: Date) => {
    const d = dayjs(date);
    // If it's current month, show just "MMM D" (e.g., "Dec 25")
    // If different month/year, show "MMM D, YYYY" for clarity
    if (d.isSame(dayjs(), 'month') && d.isSame(dayjs(), 'year')) {
      return d.format('MMM D');
    }
    return d.format('MMM D, YYYY');
  };

  if (dates.length === 1) {
    return formatCompact(dates[0]);
  }

  return dates.map((date) => formatCompact(date)).join(', ');
});

const onSave = handleSubmit((values) => {
  // Create multiple logs for selected dates
  const logs = values.selectedDates.map((date) => ({
    id: nanoid(),
    date: dayjs(date).format(shortDateFormat),
    project: values.project!,
    task: values.task!,
    duration: Math.round(values.duration!),
    description: values.description,
  }));

  emit('submit', logs);

  // Save Project and Task if needed
  const isProjectExisting = projects.value.map((p) => p.title).includes(values.project!);
  if (!isProjectExisting) projects.value.push({ title: values.project! } satisfies XeroProject);

  const isTaskExisting = tasks.value.map((t) => t.title).includes(values.task!);
  if (!isTaskExisting) tasks.value.push({ title: values.task!, project: values.project! } satisfies XeroTask);

  resetForm({
    values: {
      ...emptyLog,
      selectedDates: [], // Clear selected dates after save
    },
  });
});

const onCancel = () => {
  resetForm({
    values: {
      ...emptyLog,
      selectedDates: [], // Clear selected dates on cancel
    },
  });
  emit('cancel');
};

const onClearSelection = () => {
  selectedDatesField.setValue([]);
  emit('cancel');
};

const hours = Array.from({ length: 7 }, (_, i) => i + 1);

const onHourClick = (hour: number) => {
  setFieldValue('duration', hour * 60);
};
</script>

<template>
  <div class="pa-4">
    <form class="d-flex flex-column ga-2">
      <VTextarea
        label="Selected Dates"
        readonly
        :model-value="selectedDatesText"
        :error-messages="errors.selectedDates"
        auto-grow
        rows="1"
        max-rows="3"
      >
        <template #append-inner>
          <VFadeTransition>
            <VBtn
              v-if="selectedDatesField.value.value?.length > 0"
              icon="mdi-close-circle-outline"
              variant="plain"
              color="grey-darken-1"
              size="small"
              @click="onClearSelection"
            >
              <VIcon size="18">mdi-close-circle-outline</VIcon>
              <VTooltip activator="parent" location="top"> Clear selection </VTooltip>
            </VBtn>
          </VFadeTransition>
        </template>
      </VTextarea>

      <VCombobox
        v-model="projectField.value.value"
        label="Project"
        :items="projectItems"
        :error-messages="errors.project"
        autocomplete="false"
      >
        <template #item="{ props, item }">
          <VListItem v-bind="props">
            <template #prepend>
              <VAvatar :color="projectColors.getProjectColor(item.value)" size="small" />
            </template>
          </VListItem>
        </template>
      </VCombobox>

      <VCombobox
        v-model="taskField.value.value"
        label="Task"
        :items="taskItemsForProject"
        :error-messages="errors.task"
      ></VCombobox>

      <VTextField v-model="descriptionField.value.value" label="Description" :error-messages="errors.description" />

      <VNumberInput
        v-model="durationField.value.value"
        label="Duration (minute)"
        :error-messages="errors.duration"
        :min="0"
        :step="30"
        :hint="minutesToHourWithMinutes(durationField.value.value)"
        persistent-hint
      />

      <div class="d-flex ga-2">
        <VChip @click="onHourClick(0.25)">15m</VChip>
        <VChip @click="onHourClick(0.5)">30m</VChip>
        <VChip v-for="hour in hours" :key="hour" @click="onHourClick(hour)">{{ hour }}h</VChip>
      </div>

      <div class="d-flex ga-2 mt-4">
        <VBtn type="submit" class="flex-fill" variant="tonal" prepend-icon="mdi-cancel-outline" @click="onCancel">
          Cancel
        </VBtn>

        <VBtn
          type="submit"
          class="flex-fill"
          variant="tonal"
          color="green-darken-3"
          prepend-icon="mdi-content-save-outline"
          @click="onSave"
        >
          Save {{ selectedDatesField.value.value?.length || 0 }} Logs
        </VBtn>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
