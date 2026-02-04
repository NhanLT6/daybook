<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';
import { useWorkspace } from '@/composables/useWorkspace';

import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { TimeLog } from '@/interfaces/TimeLog';

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

const { selectedDates = [], editingLog } = defineProps<{
  selectedDates?: Date[];
  editingLog?: TimeLog;
}>();

const emit = defineEmits<{
  submit: [logs: TimeLog[]];
  cancel: [];
  clearDates: [];
}>();

const projectColors = useProjectColors();

const {
  allProjects,
  allTasks,
  sortedProjectTitles,
  pinProject,
  unpinProject,
  isPinned,
  codeReviewDescriptions,
  getTasksByProject,
  initTeamWorkPreset,
} = useWorkspace();

// Initialize default tasks and projects on mount
onMounted(() => {
  initTeamWorkPreset();
});

const tasksOfProject = computed(() =>
  getTasksByProject(projectField.value.value)
    .map((t) => t.title)
    .sort(),
);

const descriptions = computed((): string[] => {
  const isCodeReview = projectField.value.value === 'Team work' && taskField.value.value === 'Code review';
  if (!isCodeReview) return [];

  return [...codeReviewDescriptions.value].sort();
});

const hours = Array.from({ length: 7 }, (_, i) => i + 1);

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

// Edit mode detection
const isEditMode = computed(() => !!editingLog);

const selectedDatesText = computed(() => {
  if (!selectedDatesField.value.value || selectedDatesField.value.value.length === 0) {
    return '';
  }

  const dates = [...selectedDatesField.value.value].sort((a, b) => dayjs(a).diff(dayjs(b)));

  // Use compact format for selected dates display (no year, space-efficient)
  const formatCompact = (date: Date) => {
    const d = dayjs(date);
    // If it's the same year, show just "MMM D" (e.g. "Dec 25")
    // If a different year, show "MMM D, YYYY" for clarity
    if (d.isSame(dayjs(), 'year')) {
      return d.format('MMM D');
    }

    return d.format('MMM D, YYYY');
  };

  if (dates.length === 1) {
    return formatCompact(dates[0]);
  }

  return dates.map((date) => formatCompact(date)).join('; '); // Dates separated by semicolon
});

const onSave = handleSubmit((values) => {
  // Edit mode: Update single log (emit as array with 1 item)
  if (isEditMode.value && editingLog) {
    const updatedLog: TimeLog = {
      id: editingLog.id, // Keep existing ID
      date: dayjs(values.selectedDates[0]).format(shortDateFormat),
      project: values.project!,
      task: values.task!,
      duration: Math.round(values.duration!),
      description: values.description,
    };

    emit('submit', [updatedLog]);
  } else {
    // Create mode: Create multiple logs for selected dates
    const logs = values.selectedDates.map((date) => ({
      id: nanoid(),
      date: dayjs(date).format(shortDateFormat),
      project: values.project!,
      task: values.task!,
      duration: Math.round(values.duration!),
      description: values.description,
    }));

    emit('submit', logs);
  }

  // Save Project and Task if needed
  const isProjectExisting = allProjects.value.map((p) => p.title).includes(values.project!);
  if (!isProjectExisting) allProjects.value.push({ title: values.project! } satisfies Project);

  const isTaskExisting = allTasks.value.map((t) => t.title).includes(values.task!);
  if (!isTaskExisting) allTasks.value.push({ title: values.task!, project: values.project! } satisfies Task);

  resetForm();
});

const onCancel = () => {
  resetForm({
    values: {
      ...emptyLog,
      selectedDates: [],
    },
  });
  emit('cancel');
};

const onClearSelection = () => {
  selectedDatesField.setValue([]);
  emit('clearDates');
};

const onHourClick = (hour: number) => {
  // Add to the existing duration instead of replacing it
  const currentDuration = durationField.value.value || 0;
  setFieldValue('duration', currentDuration + hour * 60);
};

// Single combined watch with clear priority
watch(
  () => ({ dates: selectedDates, editing: editingLog }),
  ({ dates, editing }) => {
    if (editing) {
      // Edit mode: Pre-populate form with log data, but allow date changes from calendar
      resetForm({
        values: {
          selectedDates: dates.length > 0 ? dates : [dayjs(editing.date, shortDateFormat).toDate()],
          project: editing.project,
          task: editing.task,
          duration: editing.duration,
          description: editing.description,
        },
      });
    } else if (dates) {
      // Create mode: Sync with parent's selected dates
      selectedDatesField.setValue(dates, false);
    }
  },
  { immediate: true, deep: true },
);
</script>

<template>
  <div class="pa-4">
    <form class="d-flex flex-column ga-2" autocomplete="off">
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
              color="secondary"
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
        :items="sortedProjectTitles"
        :error-messages="errors.project"
        autocomplete="new-password"
        aria-autocomplete="list"
      >
        <template #item="{ props: itemProps, item }">
          <VHover>
            <template #default="{ isHovering, props: hoverProps }">
              <VListItem v-bind="{ ...itemProps, ...hoverProps }">
                <template #prepend>
                  <VAvatar :color="projectColors.getProjectColor(item.value)" size="small" />
                </template>

                <template #append>
                  <VBtn
                    v-show="isHovering || isPinned(item.value)"
                    :icon="isPinned(item.value) ? 'mdi-pin' : 'mdi-pin-outline'"
                    variant="text"
                    size="x-small"
                    @click.stop="isPinned(item.value) ? unpinProject(item.value) : pinProject(item.value)"
                  />
                </template>
              </VListItem>
            </template>
          </VHover>
        </template>
      </VCombobox>

      <VCombobox
        v-model="taskField.value.value"
        label="Task"
        :items="tasksOfProject"
        :error-messages="errors.task"
        autocomplete="new-password"
        aria-autocomplete="list"
      ></VCombobox>

      <VCombobox
        v-model="descriptionField.value.value"
        label="Description"
        :items="descriptions"
        :error-messages="errors.description"
        autocomplete="new-password"
        aria-autocomplete="list"
        placeholder="Select a ticket or type custom description"
      ></VCombobox>

      <VNumberInput
        v-model="durationField.value.value"
        label="Duration (minute)"
        :error-messages="errors.duration"
        :min="0"
        :step="30"
        :hint="minutesToHourWithMinutes(durationField.value.value)"
        persistent-hint
      />

      <div class="d-flex flex-wrap ga-2">
        <VChip @click="onHourClick(0.25)">+15m</VChip>
        <VChip @click="onHourClick(0.5)">+30m</VChip>
        <VChip v-for="hour in hours" :key="hour" @click="onHourClick(hour)">+{{ hour }}h</VChip>
      </div>

      <div class="d-flex ga-2 mt-4">
        <VBtn class="flex-fill" variant="tonal" prepend-icon="mdi-cancel-outline" @click="onCancel"> Cancel </VBtn>

        <VBtn class="flex-fill" variant="tonal" color="primary" prepend-icon="mdi-content-save-outline" @click="onSave">
          {{ isEditMode ? 'Update Log' : `Save ${selectedDatesField.value.value?.length || 0} Logs` }}
        </VBtn>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
