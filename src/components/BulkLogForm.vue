<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { useCategories } from '@/composables/useCategories';
import { useProjectColors } from '@/composables/useProjectColors';
import { useWorkspace } from '@/composables/useWorkspace';

import CalendarOverview from '@/components/CalendarOverview.vue';

import type { Task } from '@/interfaces/Task';
import type { TimeLog } from '@/interfaces/TimeLog';

import { useField, useForm } from 'vee-validate';
import { array, date, number, object, string } from 'yup';

import dayjs from 'dayjs';

import { shortDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { useSettingsStore } from '@/stores/settings';
import { nanoid } from 'nanoid';

interface BulkLogFormData {
  selectedDates: Date[];
  project?: string;
  task?: string;
  duration?: number;
  description?: string;
  categoryName?: string;
}

const selectedDates = defineModel<Date[]>('selectedDates', { default: () => [] });

const { editingLog } = defineProps<{
  editingLog?: TimeLog;
}>();

const emit = defineEmits<{
  submit: [logs: TimeLog[]];
  cancel: [];
  monthChanged: [month: number];
}>();

const projectColors = useProjectColors();
const settingsStore = useSettingsStore();
const { sortedCategories, addCategory } = useCategories();

const {
  allProjects,
  allTasks,
  myProjects,
  sortedProjectItems,
  pinProject,
  unpinProject,
  isPinned,
  codeReviewDescriptions,
  getTasksByProject,
  initTeamWorkPreset,
} = useWorkspace();

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
  categoryName: string().optional(),
});

const emptyLog: BulkLogFormData = {
  selectedDates: [],
  project: undefined,
  task: undefined,
  duration: undefined,
  description: undefined,
  categoryName: undefined,
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
const categoryNameField = useField<string>('categoryName');

const isEditMode = computed(() => !!editingLog);

// Category field is disabled in edit mode, or when an existing project is selected
// (category changes for existing projects are done in the Tasks page)
const isCategoryDisabled = computed(() => {
  if (isEditMode.value) return true;
  const projectTitle = projectField.value.value;
  if (!projectTitle) return false;
  return myProjects.value.some((p) => p.title === projectTitle);
});

const formEl = ref<HTMLElement>();

const scrollToFirstError = async () => {
  await nextTick();
  formEl.value?.querySelector<HTMLElement>('.v-input--error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

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

  // Save Project (with category if applicable) and Task if needed
  // Use myProjects (includes Jira + team-work preset) to match the same check used for isCategoryDisabled,
  // preventing duplicate entries for projects that exist outside allProjects
  const isProjectExisting = myProjects.value.some((p) => p.title === values.project!);
  if (!isProjectExisting) {
    let categoryId: string | undefined;
    if (settingsStore.useCategories && values.categoryName?.trim()) {
      // Find existing category by name or create a new one
      const existingCat = sortedCategories.value.find(
        (c) => c.name.toLowerCase() === values.categoryName!.trim().toLowerCase(),
      );
      categoryId = existingCat ? existingCat.id : addCategory(values.categoryName.trim()).id;
    }
    allProjects.value.push({ title: values.project!, categoryId });
  }

  const isTaskExisting = allTasks.value.some((t) => t.title === values.task!);
  if (!isTaskExisting) allTasks.value.push({ title: values.task!, project: values.project! } satisfies Task);

  resetForm({ values: emptyLog });
  selectedDates.value = [];
}, scrollToFirstError);

const onCancel = () => {
  resetForm({ values: { ...emptyLog, selectedDates: [] } });
  selectedDates.value = [];
  emit('cancel');
};

const onCalendarMonthChanged = (month: number) => {
  emit('monthChanged', month);
};

// Filter for project dropdown: header items always show, regular items filtered by title
const projectFilter = (_value: string, query: string, item?: { raw: unknown }) => {
  const raw = item?.raw as { title?: string; header?: boolean } | undefined;
  if (raw?.header) return true;
  return String(raw?.title ?? '')
    .toLowerCase()
    .includes(query.toLowerCase());
};

// VCombobox can return the whole item object when items are objects — normalize to string
const onProjectUpdate = (v: unknown) => {
  projectField.setValue(v && typeof v === 'object' ? (v as { title: string }).title : (v as string));
};

// Clear category in real-time while the user types a non-existing project name.
// VCombobox may not emit update:model-value during typing, so we use @update:search
// to handle the case where the user types something new and loses focus without selecting.
const onProjectSearch = (searchText: string | null | undefined) => {
  if (!settingsStore.useCategories || isEditMode.value) return;
  if (!searchText) return;
  const existingProject = myProjects.value.find((p) => p.title === searchText);
  if (!existingProject) {
    categoryNameField.setValue('', false);
  }
};

const onCategoryUpdate = (v: unknown) => {
  categoryNameField.setValue(v && typeof v === 'object' ? (v as { name: string }).name : (v as string));
};

const onHourClick = (hour: number) => {
  // Add to the existing duration instead of replacing it
  const currentDuration = durationField.value.value || 0;
  setFieldValue('duration', currentDuration + hour * 60);
};

// Single combined watch with clear priority
watch(
  () => ({ dates: selectedDates.value, editing: editingLog }),
  ({ dates, editing }) => {
    if (editing) {
      // Edit mode: Pre-populate form with log data, but allow date changes from calendar
      // Look up the project's current category for display (field is disabled in edit mode)
      const existingProject = myProjects.value.find((p) => p.title === editing.project);
      const catName = sortedCategories.value.find((c) => c.id === existingProject?.categoryId)?.name;
      resetForm({
        values: {
          selectedDates: dates.length > 0 ? dates : [dayjs(editing.date, shortDateFormat).toDate()],
          project: editing.project,
          task: editing.task,
          duration: editing.duration,
          description: editing.description,
          categoryName: catName,
        },
      });
    } else if (dates) {
      // Create mode: Sync with parent's selected dates
      selectedDatesField.setValue(dates, false);
    }
  },
  { immediate: true, deep: true },
);

// In create mode: auto-fill (disabled) category when an existing project is selected.
// Clearing on new project names is handled by onProjectSearch (fires during typing).
watch(
  () => projectField.value.value,
  (projectTitle) => {
    if (!settingsStore.useCategories || isEditMode.value) return;
    const existingProject = myProjects.value.find((p) => p.title === projectTitle);
    if (existingProject) {
      const catName = sortedCategories.value.find((c) => c.id === existingProject.categoryId)?.name ?? '';
      categoryNameField.setValue(catName, false);
    }
  },
);
</script>

<template>
  <div class="pa-4">
    <form ref="formEl" class="d-flex flex-column ga-2" autocomplete="off">
      <CalendarOverview
        v-model:selected-dates="selectedDates"
        :single-date-mode="!!editingLog"
        @month-changed="onCalendarMonthChanged"
      />

      <VCombobox
        :model-value="projectField.value.value"
        @update:model-value="onProjectUpdate"
        @update:search="onProjectSearch"
        label="Project"
        :items="sortedProjectItems"
        item-title="title"
        item-value="title"
        :custom-filter="projectFilter"
        :error-messages="errors.project"
        autocomplete="new-password"
        aria-autocomplete="list"
      >
        <template #item="{ props: itemProps, item }">
          <!-- Category subheader -->
          <VListSubheader v-if="item.raw.header" :title="item.raw.title" />

          <!-- Regular project item -->
          <VHover v-else>
            <template #default="{ isHovering, props: hoverProps }">
              <VListItem v-bind="{ ...itemProps, ...hoverProps }" :subtitle="item.raw.categoryName">
                <template #prepend>
                  <VAvatar :color="projectColors.getProjectColor(item.raw.title)" size="small" />
                </template>

                <template #append>
                  <VBtn
                    v-show="isHovering || isPinned(item.raw.title)"
                    :icon="isPinned(item.raw.title) ? 'mdi-pin' : 'mdi-pin-outline'"
                    variant="text"
                    size="x-small"
                    @click.stop="isPinned(item.raw.title) ? unpinProject(item.raw.title) : pinProject(item.raw.title)"
                  />
                </template>
              </VListItem>
            </template>
          </VHover>
        </template>
      </VCombobox>

      <!-- Category field: only shown when categories are enabled -->
      <!-- Editable only for new projects; disabled for existing ones (manage in Tasks page) -->
      <VCombobox
        v-if="settingsStore.useCategories"
        :model-value="categoryNameField.value.value"
        @update:model-value="onCategoryUpdate"
        label="Category"
        :items="sortedCategories"
        item-title="name"
        item-value="name"
        :disabled="isCategoryDisabled"
        :error-messages="errors.categoryName"
        autocomplete="new-password"
        aria-autocomplete="list"
        placeholder="Select or create a category"
        :hint="
          isCategoryDisabled
            ? isEditMode
              ? 'Category is per project, not per log. Change it in the Tasks page.'
              : 'To reassign, edit the project in Tasks page.'
            : undefined
        "
        :persistent-hint="isCategoryDisabled"
      ></VCombobox>

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

      <div class="d-flex flex-wrap ga-2 mb-4">
        <VBtn class="rounded-xl" variant="flat" density="comfortable" @click="onHourClick(0.25)">+15m</VBtn>
        <VBtn class="rounded-xl" variant="flat" density="comfortable"  @click="onHourClick(0.5)">+30m</VBtn>
        <VBtn class="rounded-xl" variant="flat" density="comfortable"  v-for="hour in hours" :key="hour" @click="onHourClick(hour)">+{{ hour }}h</VBtn>
      </div>

      <!-- Sticky so Cancel/Save stay visible when form overflows on small screens -->
      <VCard class="d-flex ga-2 pa-2 form-actions rounded-lg">
        <VBtn class="flex-fill" variant="tonal" prepend-icon="mdi-cancel" @click="onCancel"> Cancel </VBtn>

        <VBtn class="flex-fill" variant="tonal" color="primary" prepend-icon="mdi-content-save-outline" @click="onSave">
          {{ isEditMode ? 'Update Log' : `Save ${selectedDatesField.value.value?.length || 0} Logs` }}
        </VBtn>
      </VCard>
    </form>
  </div>
</template>

<style scoped>
/* Stick to bottom of scrolling container on small screens;
   on large screens (no overflow) behaves as normal flow */
.form-actions {
  position: sticky;
  bottom: 4px;
  padding-top: 8px;
}
</style>
