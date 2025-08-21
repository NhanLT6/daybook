<script setup lang="ts">
import { computed, watch } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';

import type { XeroLog } from '@/interfaces/XeroLog';
import type { XeroProject } from '@/interfaces/XeroProject';
import type { XeroTask } from '@/interfaces/XeroTask';

import { useStorage } from '@vueuse/core';

import { useField, useForm } from 'vee-validate';
import { array, date, number, object, string } from 'yup';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { storageKeys } from '@/common/storageKeys';
import { uniq, uniqBy } from 'lodash';
import { nanoid } from 'nanoid';

interface BulkLogFormData {
  id?: string;
  selectedDates: Date[];
  project?: string;
  task?: string;
  duration?: number;
  description?: string;
}

const { selectedDates, item: logItem } = defineProps<{
  selectedDates: Date[];
  item?: XeroLog;
}>();

const emit = defineEmits<{
  submit: [logs: XeroLog[]];
  cancel: [];
}>();

const projectColors = useProjectColors();

const tasks = useStorage<XeroTask[]>(storageKeys.xeroTasks, []);
const projects = useStorage<XeroProject[]>(storageKeys.xeroProjects, []);

const defaultTasks = [
  { title: 'Daily meeting', project: 'Team work' },
  { title: 'Code review', project: 'Team work' },
  { title: 'Retro', project: 'Team work' },
  { title: 'Grooming', project: 'Team work' },
  { title: 'Planning', project: 'Team work' },
  { title: 'Demo', project: 'Team work' },
  { title: 'Team meeting', project: 'Team work' },
];

const defaultProjects = uniqBy(
  defaultTasks.map((task) => ({ title: task.project })),
  'title',
);

const projectItems = computed(() =>
  uniq(uniqBy([...projects.value, ...defaultProjects], 'title').map((project) => project.title)),
);

const taskItems = computed(() =>
  uniq(
    uniqBy(
      [...tasks.value, ...defaultTasks].filter((t) => t.project === projectField.value.value),
      'title',
    ).map((task) => task.title),
  ),
);

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

const { errors, handleSubmit, resetForm, setFieldValue, setValues } = useForm<BulkLogFormData>({
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
    selectedDatesField.setValue(newDates);
  },
);

// Watch for logItem changes to populate form for editing
watch(
  () => logItem,
  () => {
    const newValue = !!logItem ? xeroLogToFormData(logItem!) : emptyLog;
    setValues(newValue);
  },
);

const selectedDatesText = computed(() => {
  if (!selectedDatesField.value.value || selectedDatesField.value.value.length === 0) {
    return '';
  }

  const dates = [...selectedDatesField.value.value].sort((a, b) => dayjs(a).diff(dayjs(b)));

  if (dates.length === 1) {
    return dayjs(dates[0]).format('MMM D, YYYY');
  }

  return dates.map((date) => dayjs(date).format('MMM D')).join(', ');
});

const isEditMode = computed(() => !!logItem);

const onSave = handleSubmit((values) => {
  let logs: XeroLog[];

  // Edit mode: update single existing log
  if (logItem && values.id) {
    const updatedLog: XeroLog = formDataToXeroLog(values);
    logs = [updatedLog];
  } else {
    // Bulk mode: create multiple logs
    logs = values.selectedDates.map((date) => ({
      id: nanoid(),
      date: dayjs(date).format(shortDateFormat),
      project: values.project!,
      task: values.task!,
      duration: Math.round(values.duration!),
      description: values.description,
    }));
  }

  emit('submit', logs);

  // Save Project and Task if needed
  const isProjectExisting = projects.value.map((p) => p.title).includes(values.project!);
  if (!isProjectExisting) projects.value.push({ title: values.project! } satisfies XeroProject);

  const isTaskExisting = tasks.value.map((t) => t.title).includes(values.task!);
  if (!isTaskExisting) tasks.value.push({ title: values.task!, project: values.project! } satisfies XeroTask);

  resetForm();
});

const onCancel = () => {
  resetForm();
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

// Helper functions for editing functionality
const formDataToXeroLog = (formData: BulkLogFormData): XeroLog => {
  return {
    id: formData.id ?? nanoid(),
    date: dayjs(formData.selectedDates[0]).format(shortDateFormat),
    project: formData.project!,
    task: formData.task!,
    duration: formData.duration!,
    description: formData.description,
  };
};

const xeroLogToFormData = (log: XeroLog): BulkLogFormData => {
  return {
    id: log.id,
    selectedDates: [dayjs(log.date, shortDateFormat).toDate()],
    project: log.project,
    task: log.task,
    duration: log.duration,
    description: log.description ?? '',
  };
};
</script>

<template>
  <div class="pa-4">
    <form class="d-flex flex-column ga-2">
      <VTextField
        label="Selected Dates"
        readonly
        :model-value="selectedDatesText"
        :error-messages="errors.selectedDates"
      >
        <template #append-inner>
          <VFadeTransition>
            <VBtn
              v-if="selectedDatesField.value.value?.length > 0"
              icon="mdi-close-circle"
              variant="plain"
              color="grey-darken-1"
              size="small"
              @click="onClearSelection"
            >
              <VIcon size="18">mdi-close-circle</VIcon>
              <VTooltip activator="parent" location="top"> Clear selection </VTooltip>
            </VBtn>
          </VFadeTransition>
        </template>
      </VTextField>

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
        :items="taskItems"
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
        <VBtn type="submit" class="flex-fill" variant="tonal" prepend-icon="mdi-cancel" @click="onCancel">
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
          {{ isEditMode ? 'Update Log' : `Save ${selectedDatesField.value.value?.length || 0} Logs` }}
        </VBtn>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
