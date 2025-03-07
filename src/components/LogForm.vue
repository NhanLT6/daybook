<script setup lang="ts">
import { computed, watch } from 'vue';

import type { XeroLog } from '@/interfaces/XeroLog';
import type { XeroProject } from '@/interfaces/XeroProject';
import type { XeroTask } from '@/interfaces/XeroTask';

import { useStorage } from '@vueuse/core';

import { useField, useForm } from 'vee-validate';
import { date, number, object, string } from 'yup';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { storageKeys } from '@/common/storageKeys';
import { nanoid } from 'nanoid';

interface LogFormData {
  id?: string;
  date?: Date;
  project?: string;
  task?: string;
  duration?: number;
  description?: string;
}

const { item, selectedDate } = defineProps<{
  item?: XeroLog;
  selectedDate?: Date;
}>();

const emit = defineEmits<{
  selectedDateChanged: [selectedDate: Date];
  submit: [log: XeroLog];
}>();

watch(
  () => selectedDate,
  () => {
    if (selectedDate) dateField.setValue(selectedDate);
  },
);

watch(
  () => item,
  () => {
    const newValue = !!item ? xeroLogToFormData(item!) : emptyLog;
    setValues(newValue);
  },
);

const tasks = useStorage<XeroTask[]>(storageKeys.xeroTasks, []);
const projects = useStorage<XeroProject[]>(storageKeys.xeroProjects, []);

const projectItems = computed(() => projects.value.map((project) => project.title));
const taskItems = computed(() =>
  tasks.value.filter((t) => t.project === projectField.value.value).map((task) => task.title),
);

const onSelectedDateChanged = (selectedDate: string) => {
  emit('selectedDateChanged', dayjs(selectedDate).toDate());
};

const validationSchema = object({
  date: date().required('Required'),
  project: string().required('Required'),
  task: string().required('Required'),
  duration: number().required('Required').min(1, 'Must be greater than 0'),
  description: string(),
});

const emptyLog: LogFormData = {
  id: undefined,
  date: selectedDate,
  project: undefined,
  task: undefined,
  duration: undefined,
  description: undefined,
};

const { errors, handleSubmit, resetForm, setValues, setFieldValue } = useForm<LogFormData>({
  initialValues: emptyLog,
  validationSchema,
});

const dateField = useField<Date>('date');
const projectField = useField<string>('project');
const taskField = useField<string>('task');
const durationField = useField<number>('duration');
const descriptionField = useField<string>('description');

const onSave = handleSubmit((values) => {
  // Emit log
  const newLog: LogFormData = {
    id: values.id,
    date: values.date!,
    project: values.project!,
    task: values.task!,
    duration: Math.round(values.duration!),
    description: values.description,
  };

  const xeroLog = formDataToXeroLog(newLog);

  emit('submit', xeroLog);

  // Save Project and Task if needed
  const isProjectExisting = projects.value.map((p) => p.title).includes(xeroLog.project);
  if (!isProjectExisting) projects.value.push({ title: xeroLog.project } satisfies XeroProject);

  const isTaskExisting = tasks.value.map((t) => t.title).includes(xeroLog.task);
  if (!isTaskExisting) tasks.value.push({ title: xeroLog.task, project: xeroLog.project } satisfies XeroTask);

  resetForm();
  setFieldValue('date', selectedDate); // Retain selected date
});

const onCancel = () => {
  resetForm();
};

const formDataToXeroLog = (formData: LogFormData): XeroLog => {
  return {
    id: formData.id ?? nanoid(),
    date: dayjs(formData.date).format(shortDateFormat),
    project: formData.project!,
    task: formData.task!,
    duration: formData.duration!,
    description: formData.description,
  };
};

const xeroLogToFormData = (log: XeroLog): LogFormData => {
  return {
    id: log.id,
    date: dayjs(log.date, shortDateFormat).toDate(),
    project: log.project,
    task: log.task,
    duration: log.duration,
    description: log.description ?? '',
  };
};

const hours = Array.from({ length: 7 }, (_, i) => i + 1);

const onHourClick = (hour: number) => {
  setFieldValue('duration', hour * 60);
};
</script>

<template>
  <VCard class="mb-4 elevation-0 border">
    <VCardItem>
      <form class="d-flex flex-column ga-2">
        <VDateInput
          v-model="dateField.value.value"
          label="Date"
          append-inner-icon="$calendar"
          prepend-icon=""
          :error-messages="errors.date"
          @update:model-value="onSelectedDateChanged"
        />

        <VCombobox
          v-model="projectField.value.value"
          label="Project"
          :items="projectItems"
          :error-messages="errors.project"
        ></VCombobox>

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
      </form>
    </VCardItem>

    <VCardActions>
      <VBtn type="submit" class="flex-fill" variant="tonal" prepend-icon="mdi-cancel" @click="onCancel"> Cancel </VBtn>

      <VBtn
        type="submit"
        class="flex-fill"
        variant="tonal"
        color="green-darken-3"
        prepend-icon="mdi-content-save-outline"
        @click="onSave"
      >
        Save
      </VBtn>
    </VCardActions>
  </VCard>
</template>

<style scoped></style>
