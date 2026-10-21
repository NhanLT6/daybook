<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useCategories } from '@/composables/useCategories';
import { useCollection } from '@/composables/useCollection';
import { useProjectColors } from '@/composables/useProjectColors';
import { useTimeLogs } from '@/composables/useTimeLogs';
import { useWorkspace } from '@/composables/useWorkspace';

import GroupedTable from '@/components/GroupedTable.vue';
import ListPanel from '@/components/ListPanel.vue';

import type { TableColumn, TableGroup } from '@/components/GroupedTable.vue';
import type { Category } from '@/interfaces/Category';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { minutesToHourWithMinutes } from '@/common/DateHelpers';
import { useSettingsStore } from '@/stores/settings';

interface TaskFormData {
  projectTitle: string;
  taskTitle: string;
  categoryId?: string | null;
}

const projectColors = useProjectColors();
const settingsStore = useSettingsStore();
const { sortedCategories, addCategory, renameCategory, deleteCategory } = useCategories();
const { allTasks, allProjects, getTasksByProject, initTeamWorkPreset } = useWorkspace();

// `allTasks`/`allProjects` from useWorkspace are now read-only computeds backed by db
// collections, so direct CRUD in this view (add/rename/delete project & task) writes
// through these same collections instead of mutating the arrays in place.
const tasksCol = useCollection<Task & { id: string }>('tasks');
const projectsCol = useCollection<Project & { id: string }>('projects');

onMounted(() => {
  initTeamWorkPreset();
});

// Create/edit dialog — one discriminated-union state replaces the four mode flags.
type DialogState =
  | { mode: 'new-project'; categoryId: string | null }
  | { mode: 'new-task'; project?: string }
  | { mode: 'edit-project'; project: Project }
  | { mode: 'edit-task'; task: Task };

const dialog = ref<DialogState | null>(null);
const dialogMode = computed(() => dialog.value?.mode ?? null);
const isDialogOpen = computed({
  get: () => dialog.value !== null,
  set: (open) => {
    // VDialog closes itself (outside click / Esc) by setting this false.
    if (!open) closeDialog();
  },
});

const isDeleteProjectDialogOpen = ref(false);
const projectToDelete = ref<string | null>(null);

// ─── Category management dialog ───────────────────────────────
const isCategoryDialogOpen = ref(false);
const editingCategory = ref<Category | null>(null);
const categoryFormName = ref('');

const categoryNameError = computed(() => {
  if (!categoryFormName.value.trim()) return 'Name is required';
  const duplicate = sortedCategories.value.some(
    (c) => c.name.toLowerCase() === categoryFormName.value.trim().toLowerCase() && c.id !== editingCategory.value?.id,
  );
  return duplicate ? 'Category name already exists' : '';
});

const openAddCategory = () => {
  editingCategory.value = null;
  categoryFormName.value = '';
  isCategoryDialogOpen.value = true;
};

const openEditCategory = (cat: Category) => {
  editingCategory.value = cat;
  categoryFormName.value = cat.name;
  isCategoryDialogOpen.value = true;
};

const saveCategoryForm = () => {
  if (categoryNameError.value) return;
  if (editingCategory.value) {
    renameCategory(editingCategory.value.id, categoryFormName.value);
  } else {
    addCategory(categoryFormName.value);
  }
  isCategoryDialogOpen.value = false;
};

// ─── Project groups ───────────────────────────────────────────

interface ProjectWithTasks extends Project {
  tasks: Task[];
}

interface ProjectGroup {
  categoryId: string | null;
  categoryName: string | null;
  projects: ProjectWithTasks[];
}

// Attach each project's tasks once here so the template reads `project.tasks`
// instead of calling getTasksByProject() several times per row.
const withTasks = (projects: Project[]): ProjectWithTasks[] =>
  projects.map((p) => ({ ...p, tasks: getTasksByProject(p.title) }));

const projectGroups = computed<ProjectGroup[]>(() => {
  if (!settingsStore.useCategories) {
    return [{ categoryId: null, categoryName: null, projects: withTasks(allProjects.value) }];
  }

  const groups: ProjectGroup[] = sortedCategories.value.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    projects: withTasks(allProjects.value.filter((p) => p.categoryId === cat.id)),
  }));

  // Uncategorized group (only shown if there are projects without a valid category)
  const uncategorized = allProjects.value.filter(
    (p) => !p.categoryId || !sortedCategories.value.find((c) => c.id === p.categoryId),
  );
  if (uncategorized.length > 0) {
    groups.push({ categoryId: null, categoryName: 'Uncategorized', projects: withTasks(uncategorized) });
  }

  return groups;
});

// ─── Search ───────────────────────────────────────────────────
// A project whose title matches keeps all its tasks; otherwise only the matching
// tasks stay, and projects/groups left empty drop out.
const searchText = ref('');
const searchQuery = computed(() => (searchText.value ?? '').trim().toLowerCase());

const visibleGroups = computed<ProjectGroup[]>(() => {
  const q = searchQuery.value;
  if (!q) return projectGroups.value;

  return projectGroups.value
    .map((group) => ({
      ...group,
      projects: group.projects
        .map((p) =>
          p.title.toLowerCase().includes(q)
            ? p
            : { ...p, tasks: p.tasks.filter((t) => t.title.toLowerCase().includes(q)) },
        )
        .filter((p) => p.title.toLowerCase().includes(q) || p.tasks.length > 0),
    }))
    .filter((group) => group.projects.length > 0);
});

// ─── Table ────────────────────────────────────────────────────
// Hours this month and the last day logged, per task and per project, so the wide
// table carries something useful in its columns.
const { logs } = useTimeLogs();

interface Usage {
  monthMinutes: number;
  lastDate: string | null;
}

const usage = computed(() => {
  const monthPrefix = dayjs().format('YYYY-MM-');
  const byKey = new Map<string, Usage>();
  const bump = (key: string, date: string, minutes: number) => {
    const u = byKey.get(key) ?? { monthMinutes: 0, lastDate: null };
    if (date.startsWith(monthPrefix)) u.monthMinutes += minutes;
    if (!u.lastDate || date > u.lastDate) u.lastDate = date;
    byKey.set(key, u);
  };
  for (const log of logs.value) {
    if (log.type !== 'log') continue;
    bump(log.project, log.date, log.duration ?? 0);
    if (log.task) bump(taskId({ title: log.task, project: log.project }), log.date, log.duration ?? 0);
  }
  return byKey;
});

const hoursLabel = (key: string) => {
  const minutes = usage.value.get(key)?.monthMinutes ?? 0;
  return minutes ? minutesToHourWithMinutes(minutes) : '—';
};

const lastLoggedLabel = (key: string) => {
  const last = usage.value.get(key)?.lastDate;
  if (!last) return '—';
  const d = dayjs(last, isoDateFormat);
  return d.isSame(dayjs(), 'year') ? d.format('MMM D') : d.format('MMM D, YYYY');
};

const columns: TableColumn[] = [
  { key: 'title', title: 'Task' },
  { key: 'month', title: 'This month', width: 120, align: 'end', hideBelow: 'sm' },
  { key: 'last', title: 'Last logged', width: 140, align: 'end', hideBelow: 'sm' },
];

// One table group per project; in categories mode each category opens a section
const tableGroups = computed<(TableGroup<Task> & { project: ProjectWithTasks; categoryId: string | null })[]>(() =>
  visibleGroups.value.flatMap((group) =>
    group.projects.map((project) => ({
      key: project.title,
      rows: project.tasks,
      block: settingsStore.useCategories ? (group.categoryId ?? 'uncategorized') : undefined,
      blockLabel: settingsStore.useCategories ? (group.categoryName ?? undefined) : undefined,
      project,
      categoryId: group.categoryId,
    })),
  ),
);

// Categories with no projects yet still need a place to add one
const emptyCategories = computed(() =>
  settingsStore.useCategories && !searchQuery.value
    ? sortedCategories.value.filter((c) => !allProjects.value.some((p) => p.categoryId === c.id))
    : [],
);

// ─── Form ─────────────────────────────────────────────────────

const validationSchema = computed(() =>
  object({
    projectTitle: string().required('Project name is required'),
    taskTitle:
      dialogMode.value === 'new-project' || dialogMode.value === 'edit-project'
        ? string().optional()
        : string().required('Task name is required'),
    categoryId: string().optional().nullable(),
  }),
);

const { errors, handleSubmit, resetForm } = useForm<TaskFormData>({
  initialValues: {
    projectTitle: undefined,
    taskTitle: undefined,
    categoryId: undefined,
  },
  validationSchema: validationSchema,
  validateOnMount: false,
});

const projectField = useField<string>('projectTitle');
const taskField = useField<string>('taskTitle');
const categoryField = useField<string | null | undefined>('categoryId');

const editTask = (task: Task) => {
  dialog.value = { mode: 'edit-task', task };
  resetForm({ values: { projectTitle: task.project, taskTitle: task.title, categoryId: undefined } });
};

const editProject = (project: Project) => {
  dialog.value = { mode: 'edit-project', project };
  resetForm({ values: { projectTitle: project.title, taskTitle: '', categoryId: project.categoryId ?? null } });
};

const createNewProject = (forCategoryId?: string | null) => {
  dialog.value = { mode: 'new-project', categoryId: forCategoryId ?? null };
  resetForm({ values: { projectTitle: undefined, taskTitle: undefined, categoryId: forCategoryId ?? null } });
};

const createNewTask = (forProjectTitle?: string) => {
  dialog.value = { mode: 'new-task', project: forProjectTitle };
  resetForm({ values: { projectTitle: forProjectTitle || undefined, taskTitle: undefined, categoryId: undefined } });
};

const taskId = (t: { title: string; project: string }) => `${t.project}::${t.title}`;

const upsertTask = (title: string, project: string) => {
  if (allTasks.value.some((t) => t.title === title && t.project === project)) return;
  const created = { title, project };
  void tasksCol.add({ ...created, id: taskId(created) });
};

const onSave = handleSubmit((values) => {
  const state = dialog.value;
  if (!state) return;

  if (state.mode === 'new-project' || state.mode === 'edit-project') {
    const editing = state.mode === 'edit-project' ? state.project : null;
    const projectExists = allProjects.value.some((p) => p.title === values.projectTitle);

    if (editing) {
      if (editing.title !== values.projectTitle) {
        // Project/task ids are keyed by title, so a rename is remove-then-add under
        // the new id — for the project and for every task pointing at it.
        void projectsCol.remove(editing.title);
        void projectsCol.add({
          title: values.projectTitle,
          categoryId: values.categoryId ?? undefined,
          id: values.projectTitle,
        });

        for (const task of allTasks.value.filter((t) => t.project === editing.title)) {
          void tasksCol.remove(taskId(task));
          const renamed = { title: task.title, project: values.projectTitle };
          void tasksCol.add({ ...renamed, id: taskId(renamed) });
        }
      } else {
        // Same title — only categoryId can have changed.
        void projectsCol.upsert({
          title: editing.title,
          categoryId: values.categoryId ?? undefined,
          id: editing.title,
        });
      }
    } else if (!projectExists) {
      void projectsCol.add({
        title: values.projectTitle,
        categoryId: values.categoryId ?? undefined,
        id: values.projectTitle,
      });
    }

    // New project with an optional task name → create that task too.
    if (state.mode === 'new-project' && values.taskTitle?.trim()) {
      upsertTask(values.taskTitle, values.projectTitle);
    }
  } else {
    // new-task or edit-task
    const editing = state.mode === 'edit-task' ? state.task : null;
    if (editing) {
      void tasksCol.remove(taskId(editing));
      const renamed = { title: values.taskTitle, project: values.projectTitle };
      void tasksCol.add({ ...renamed, id: taskId(renamed) });
    } else {
      upsertTask(values.taskTitle, values.projectTitle);
    }
  }

  closeDialog();
});

const closeDialog = () => {
  resetForm();
  dialog.value = null;
};

const onCancel = closeDialog;

const confirmDeleteProject = (projectTitle: string) => {
  const tasksInProject = getTasksByProject(projectTitle).length;

  if (tasksInProject === 0) {
    void projectsCol.remove(projectTitle);
    return;
  }

  projectToDelete.value = projectTitle;
  isDeleteProjectDialogOpen.value = true;
};

const executeDeleteProject = () => {
  if (projectToDelete.value) {
    void projectsCol.remove(projectToDelete.value);
    for (const task of allTasks.value.filter((t) => t.project === projectToDelete.value)) {
      void tasksCol.remove(taskId(task));
    }

    projectToDelete.value = null;
    isDeleteProjectDialogOpen.value = false;
  }
};

const cancelDeleteProject = () => {
  projectToDelete.value = null;
  isDeleteProjectDialogOpen.value = false;
};

const deleteTaskDirectly = (taskTitle: string, projectTitle: string) => {
  void tasksCol.remove(taskId({ title: taskTitle, project: projectTitle }));
};

const dialogTitles: Record<NonNullable<typeof dialogMode.value>, string> = {
  'new-project': 'New Project',
  'new-task': 'New Task',
  'edit-project': 'Edit Project',
  'edit-task': 'Edit Task',
};
const currentMode = computed(() => (dialogMode.value ? dialogTitles[dialogMode.value] : 'Task Management'));

const saveTooltips: Record<NonNullable<typeof dialogMode.value>, string> = {
  'new-project': 'Create new project',
  'new-task': 'Create new task',
  'edit-project': 'Save project changes',
  'edit-task': 'Save task changes',
};
const saveTooltip = computed(() => (dialogMode.value ? saveTooltips[dialogMode.value] : ''));

const showTaskField = computed(
  () => dialogMode.value === 'new-task' || dialogMode.value === 'edit-task' || dialogMode.value === 'new-project',
);
</script>

<template>
  <div class="page-fill">
    <!-- Modal Dialog for Creating/Editing Projects and Tasks -->
    <VDialog v-model="isDialogOpen" max-width="500px">
      <VCard>
        <VCardTitle>
          <VToolbar class="bg-transparent">
            <VToolbarTitle>{{ currentMode }}</VToolbarTitle>
          </VToolbar>
        </VCardTitle>

        <VCardText>
          <form class="d-flex flex-column ga-4">
            <VTextField
              v-model="projectField.value.value"
              label="Project Name"
              :error-messages="errors.projectTitle"
              :disabled="dialogMode === 'edit-task'"
            />

            <!-- Category dropdown — only when categories feature is enabled -->
            <VSelect
              v-if="settingsStore.useCategories && (dialogMode === 'new-project' || dialogMode === 'edit-project')"
              v-model="categoryField.value.value"
              :items="sortedCategories"
              item-title="name"
              item-value="id"
              label="Category"
              clearable
              hint="Optional — leave blank for Uncategorized"
              persistent-hint
            />

            <VTextField
              v-if="showTaskField"
              v-model="taskField.value.value"
              label="Task Name"
              :error-messages="errors.taskTitle"
              :hint="dialogMode === 'new-project' ? 'This field is optional when creating a project' : ''"
              :persistent-hint="dialogMode === 'new-project'"
            />
          </form>
        </VCardText>

        <!-- Modal Action Buttons -->
        <VCardActions class="pa-4">
          <VSpacer />

          <VBtn variant="text" prepend-icon="mdi-cancel" v-tooltip="'Cancel editing and close dialog'" @click="onCancel">
            Cancel
          </VBtn>

          <VBtn
            variant="tonal"
            color="primary"
            prepend-icon="mdi-content-save-outline"
            v-tooltip="saveTooltip"
            @click="onSave"
          >
            Save
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Main content: one glass card, the shared list shell spans its full width -->
    <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
      <ListPanel
        v-model:search="searchText"
        class="flex-grow-1"
        title="Projects & Tasks"
        :count="allProjects.length"
        search-placeholder="Search tasks"
      >
        <template #actions>
          <!-- New Category (categories mode only) -->
          <VBtn
            v-if="settingsStore.useCategories"
            variant="text"
            rounded="lg"
            height="32"
            prepend-icon="mdi-shape-plus-outline"
            class="list-icon-on-xs"
            v-tooltip="'Add a new category'"
            @click="openAddCategory"
          >
            <span class="d-none d-sm-inline">New Category</span>
          </VBtn>

          <!-- New Project -->
          <VBtn
            color="primary"
            variant="tonal"
            rounded="lg"
            height="32"
            prepend-icon="mdi-plus"
            class="list-icon-on-xs"
            v-tooltip="'Create a new project'"
            @click="createNewProject()"
          >
            <span class="d-none d-sm-inline">New Project</span>
          </VBtn>
        </template>

        <!-- Projects as table groups, their tasks as rows -->
        <GroupedTable
          v-if="tableGroups.length > 0"
          :columns="columns"
          :groups="tableGroups"
          :row-key="(task) => taskId(task)"
          @row-click="editTask"
        >
          <!-- Category section: name + rename / delete / add project -->
          <template #block-label="{ label, group }">
            <div class="d-flex align-center ga-1">
              <span class="flex-grow-1">{{ label }}</span>
              <template v-if="group.categoryId">
                <VIconBtn
                  icon="mdi-pencil-outline"
                  aria-label="Rename category"
                  size="28"
                  icon-size="16"
                  rounded="lg"
                  variant="text"
                  v-tooltip="'Rename category'"
                  @click="openEditCategory(sortedCategories.find((c) => c.id === group.categoryId)!)"
                />
                <VIconBtn
                  icon="mdi-trash-can-outline"
                  aria-label="Delete category"
                  size="28"
                  icon-size="16"
                  rounded="lg"
                  variant="text"
                  v-tooltip="'Delete category (projects become Uncategorized)'"
                  @click="deleteCategory(group.categoryId!)"
                />
              </template>
              <VIconBtn
                icon="mdi-plus"
                aria-label="New project in category"
                size="28"
                icon-size="16"
                rounded="lg"
                variant="text"
                v-tooltip="`New project in ${label}`"
                @click="createNewProject(group.categoryId)"
              />
            </div>
          </template>

          <!-- Project row: colour dot, name, task count; month total; actions -->
          <template #group="{ group }">
            <span
              class="project-dot"
              :style="{ backgroundColor: projectColors.getProjectColor(group.project.title) }"
            />
            <span class="project-title">{{ group.project.title }}</span>
            <span class="project-count">{{ group.project.tasks.length }}</span>
          </template>

          <template #group.month="{ group }">{{ hoursLabel(group.project.title) }}</template>
          <template #group.last="{ group }">{{ lastLoggedLabel(group.project.title) }}</template>

          <template #group-actions="{ group }">
            <VIconBtn
              icon="mdi-plus"
              aria-label="Add task"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="'Add new task to this project'"
              @click="createNewTask(group.project.title)"
            />
            <VIconBtn
              icon="mdi-pencil-outline"
              aria-label="Edit project"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="'Edit project'"
              @click="editProject(group.project)"
            />
            <VIconBtn
              icon="mdi-trash-can-outline"
              aria-label="Delete project"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="`Delete project${group.project.tasks.length > 0 ? ' and all its tasks' : ''}`"
              @click="confirmDeleteProject(group.project.title)"
            />
          </template>

          <template #cell.title="{ row }">
            <span class="task-title">{{ row.title }}</span>
          </template>

          <template #cell.month="{ row }">
            <span class="text-medium-emphasis">{{ hoursLabel(taskId(row)) }}</span>
          </template>

          <template #cell.last="{ row }">
            <span class="text-medium-emphasis">{{ lastLoggedLabel(taskId(row)) }}</span>
          </template>

          <template #actions="{ row }">
            <VIconBtn
              icon="mdi-pencil-outline"
              aria-label="Edit task"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="'Edit task name'"
              @click="editTask(row)"
            />
            <VIconBtn
              icon="mdi-trash-can-outline"
              aria-label="Delete task"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="'Delete this task'"
              @click="deleteTaskDirectly(row.title, row.project)"
            />
          </template>

          <!-- Project without tasks -->
          <template #group-empty="{ group }">
            <span class="task-indent">No tasks yet.</span>
            <a
              href="#"
              class="text-decoration-none text-primary ms-1"
              @click.prevent="createNewTask(group.project.title)"
            >
              Add one
            </a>
          </template>
        </GroupedTable>

        <!-- Categories that have no projects yet -->
        <div v-for="cat in emptyCategories" :key="cat.id" class="empty-category">
          <span class="flex-grow-1">{{ cat.name }}</span>
          <VBtn variant="text" size="small" prepend-icon="mdi-plus" @click="createNewProject(cat.id)">
            New Project
          </VBtn>
        </div>

        <!-- No search results -->
        <div v-if="tableGroups.length === 0 && allProjects.length > 0" class="list-empty">
          <VIcon icon="mdi-magnify-close" />
          <div>No projects or tasks match "{{ searchText }}"</div>
        </div>

        <!-- No projects at all -->
        <div v-else-if="allProjects.length === 0" class="list-empty">
          <VIcon icon="mdi-folder-plus-outline" />
          <div>No projects yet. Create your first project to get started.</div>
        </div>
      </ListPanel>
    </VCard>
  </div>

  <!-- Confirmation Dialog - Project Deletion -->
  <VDialog v-model="isDeleteProjectDialogOpen" max-width="400px">
    <VCard>
      <VCardTitle>Delete Project</VCardTitle>

      <VCardText>
        <p class="mb-2">
          Are you sure you want to delete the project <strong>"{{ projectToDelete }}"</strong>?
        </p>

        <p class="text-error">
          This will also delete all {{ getTasksByProject(projectToDelete!).length || 0 }} task(s) in this project.
        </p>
      </VCardText>

      <VCardActions class="pa-4">
        <VSpacer />

        <VBtn variant="text" v-tooltip="'Cancel deletion'" @click="cancelDeleteProject">Cancel</VBtn>

        <VBtn
          variant="tonal"
          color="error"
          v-tooltip="'Permanently delete project and all its tasks'"
          @click="executeDeleteProject"
        >
          Delete Project
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>

  <!-- Category Add/Rename Dialog -->
  <VDialog v-model="isCategoryDialogOpen" max-width="400px">
    <VCard>
      <VCardTitle>{{ editingCategory ? 'Rename Category' : 'New Category' }}</VCardTitle>
      <VCardText>
        <VTextField
          v-model="categoryFormName"
          label="Category name"
          autofocus
          :error-messages="categoryNameError ? [categoryNameError] : []"
          @keyup.enter="saveCategoryForm"
        />
      </VCardText>
      <VCardActions class="pa-4">
        <VSpacer />
        <VBtn variant="text" @click="isCategoryDialogOpen = false">Cancel</VBtn>
        <VBtn variant="tonal" color="primary" :disabled="!!categoryNameError" @click="saveCategoryForm">
          {{ editingCategory ? 'Rename' : 'Add' }}
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.project-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.project-title {
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.project-count {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

/* Task names line up under the project name (dot 10px + 8px gap) */
.task-title,
.task-indent {
  padding-inline-start: 18px;
}

/* A wrapped task name stays indented */
.task-title {
  display: block;
}

.empty-category {
  display: flex;
  align-items: center;
  padding: 18px 12px 4px 18px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
