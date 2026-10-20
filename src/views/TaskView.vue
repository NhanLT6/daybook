<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useCategories } from '@/composables/useCategories';
import { useCollection } from '@/composables/useCollection';
import { useProjectColors } from '@/composables/useProjectColors';
import { useWorkspace } from '@/composables/useWorkspace';

import type { Category } from '@/interfaces/Category';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

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

          <VTooltip>
            <template #activator="{ props }">
              <VBtn variant="text" prepend-icon="mdi-cancel" @click="onCancel" v-bind="props">Cancel</VBtn>
            </template>
            Cancel editing and close dialog
          </VTooltip>

          <VTooltip>
            <template #activator="{ props }">
              <VBtn
                variant="tonal"
                color="primary"
                prepend-icon="mdi-content-save-outline"
                @click="onSave"
                v-bind="props"
              >
                Save
              </VBtn>
            </template>
            {{
              dialogMode === 'new-project'
                ? 'Create new project'
                : dialogMode === 'new-task'
                  ? 'Create new task'
                  : dialogMode === 'edit-project'
                    ? 'Save project changes'
                    : 'Save task changes'
            }}
          </VTooltip>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Main content: big card fills the space, inner container keeps content narrow -->
    <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
      <!-- Toolbar, styled like the Logs toolbar: title + count, search, actions -->
      <div class="task-toolbar flex-shrink-0">
        <div class="page-inner task-toolbar__inner">
          <h3 class="task-toolbar__title">Projects & Tasks</h3>
          <span class="task-toolbar__count">{{ allProjects.length }}</span>

          <!-- Search: matches project and task names -->
          <div class="task-search">
            <VTextField
              v-model="searchText"
              placeholder="Search tasks"
              prepend-inner-icon="mdi-magnify"
              variant="solo"
              flat
              density="compact"
              hide-details
              single-line
              clearable
              class="task-search__field"
              @click:clear="searchText = ''"
            />
          </div>

          <VSpacer />

          <!-- New Category (categories mode only) -->
          <VBtn
            v-if="settingsStore.useCategories"
            class="text-none"
            variant="text"
            rounded="lg"
            height="32"
            prepend-icon="mdi-shape-plus-outline"
            v-tooltip="'Add a new category'"
            @click="openAddCategory"
          >
            <span class="d-none d-sm-inline">New Category</span>
          </VBtn>

          <!-- New Project -->
          <VBtn
            class="task-toolbar__new text-none"
            color="primary"
            variant="tonal"
            rounded="lg"
            height="32"
            prepend-icon="mdi-plus"
            v-tooltip="'Create a new project'"
            @click="createNewProject()"
          >
            <span class="d-none d-sm-inline">New Project</span>
          </VBtn>
        </div>
      </div>

      <!-- Scrollable body; inner container keeps projects/tasks at a comfortable width -->
      <div class="tasks-body flex-grow-1 overflow-y-auto">
        <VContainer class="page-inner pt-2">
          <!-- Projects grouped by category -->
          <template v-if="visibleGroups.length > 0">
            <section
              v-for="group in visibleGroups"
              :key="group.categoryId ?? 'uncategorized'"
              class="project-group"
              :class="{ 'project-group--categorized': settingsStore.useCategories }"
            >
              <!-- Category section header (only when categories enabled) -->
              <div v-if="settingsStore.useCategories" class="category-row">
                <span class="category-row__name">{{ group.categoryName }}</span>

                <template v-if="group.categoryId">
                  <VIconBtn
                    icon="mdi-pencil-outline"
                    aria-label="Rename category"
                    size="28"
                    icon-size="16"
                    rounded="lg"
                    variant="text"
                    class="row-action"
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
                    class="row-action"
                    v-tooltip="'Delete category (projects become Uncategorized)'"
                    @click="deleteCategory(group.categoryId!)"
                  />
                </template>
              </div>

              <!-- Projects in this group, a hairline between each -->
              <div v-for="project in group.projects" :key="project.title" class="project-block">
                <!-- Project row -->
                <div class="project-row">
                  <span
                    class="project-dot"
                    :style="{ backgroundColor: projectColors.getProjectColor(project.title) }"
                  />

                  <span class="project-title">{{ project.title }}</span>
                  <span class="project-count">{{ project.tasks.length }}</span>

                  <VSpacer />

                  <div class="d-flex flex-shrink-0">
                    <VIconBtn
                      icon="mdi-pencil-outline"
                      aria-label="Edit project"
                      size="32"
                      icon-size="18"
                      rounded="lg"
                      variant="text"
                      class="row-action"
                      v-tooltip="'Edit project'"
                      @click="editProject(project)"
                    />
                    <VIconBtn
                      icon="mdi-trash-can-outline"
                      aria-label="Delete project"
                      size="32"
                      icon-size="18"
                      rounded="lg"
                      variant="text"
                      class="row-action"
                      v-tooltip="`Delete project${project.tasks.length > 0 ? ' and all its tasks' : ''}`"
                      @click="confirmDeleteProject(project.title)"
                    />
                    <VIconBtn
                      icon="mdi-plus"
                      aria-label="Add task"
                      size="32"
                      icon-size="18"
                      rounded="lg"
                      variant="text"
                      v-tooltip="'Add new task to this project'"
                      @click="createNewTask(project.title)"
                    />
                  </div>
                </div>

                <!-- Tasks under this project, indented to the title -->
                <ul v-if="project.tasks.length" class="task-rows">
                  <li
                    v-for="task in project.tasks"
                    :key="task.title"
                    class="task-row"
                    @click="editTask({ title: task.title, project: project.title })"
                  >
                    <span class="text-truncate flex-grow-1">{{ task.title }}</span>

                    <VIconBtn
                      icon="mdi-pencil-outline"
                      aria-label="Edit task"
                      size="28"
                      icon-size="16"
                      rounded="lg"
                      variant="text"
                      class="row-action"
                      v-tooltip="'Edit task name'"
                      @click.stop="editTask({ title: task.title, project: project.title })"
                    />
                    <VIconBtn
                      icon="mdi-trash-can-outline"
                      aria-label="Delete task"
                      size="28"
                      icon-size="16"
                      rounded="lg"
                      variant="text"
                      class="row-action"
                      v-tooltip="'Delete this task'"
                      @click.stop="deleteTaskDirectly(task.title, project.title)"
                    />
                  </li>
                </ul>

                <!-- Empty task state -->
                <div v-else class="task-empty">
                  No tasks yet.
                  <a
                    href="#"
                    class="text-decoration-none text-primary ms-1"
                    @click.prevent="createNewTask(project.title)"
                  >
                    Add one
                  </a>
                </div>
              </div>

              <!-- + New Project within category (categories mode only) -->
              <div v-if="settingsStore.useCategories && !searchQuery" class="py-2">
                <VBtn
                  class="text-none"
                  variant="text"
                  prepend-icon="mdi-plus"
                  size="small"
                  @click="createNewProject(group.categoryId)"
                >
                  New Project in {{ group.categoryName }}
                </VBtn>
              </div>
            </section>
          </template>

          <!-- No search results -->
          <div v-else-if="allProjects.length > 0" class="text-center py-8 text-medium-emphasis">
            <VIcon size="48" class="mb-3">mdi-magnify-close</VIcon>
            <div>No projects or tasks match "{{ searchText }}"</div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-8 text-medium-emphasis">
            <VIcon size="64" class="mb-4">mdi-folder-plus-outline</VIcon>
            <div class="text-h6 mb-2">No projects yet</div>
            <div>Create your first project to get started</div>
          </div>
        </VContainer>
      </div>
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

        <VTooltip>
          <template #activator="{ props }">
            <VBtn variant="text" @click="cancelDeleteProject" v-bind="props">Cancel</VBtn>
          </template>
          Cancel deletion
        </VTooltip>

        <VTooltip>
          <template #activator="{ props }">
            <VBtn variant="tonal" color="error" @click="executeDeleteProject" v-bind="props">Delete Project</VBtn>
          </template>
          Permanently delete project and all its tasks
        </VTooltip>
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
/* ── Toolbar: mirrors LogList's toolbar (hairline below, compact tinted search) ── */
.task-toolbar {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.09);
}

.task-toolbar__inner {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 auto;
  padding: 10px 16px;
}

.task-toolbar .v-btn {
  letter-spacing: normal;
}

.task-toolbar__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: nowrap;
}

.task-toolbar__count,
.project-count {
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

.task-toolbar__count {
  margin-left: 2px;
}

.task-search {
  flex: 1 1 280px;
  min-width: 120px;
  max-width: 280px;
  margin-left: 10px;
}

/* Out-specifies .glass-acrylic .v-field's solid surface, as in LogList */
.task-search__field :deep(.v-field) {
  background-color: rgba(var(--v-theme-on-surface), 0.05) !important;
  border-radius: 12px;
  min-height: 32px;
  font-size: 0.8125rem;
}

.task-search__field :deep(.v-field__input) {
  min-height: 32px;
  padding-top: 0;
  padding-bottom: 0;
}

.task-search__field :deep(.v-field__prepend-inner) {
  padding-inline-start: 2px;
}

.task-search__field :deep(.v-field__prepend-inner .v-icon) {
  font-size: 18px;
}

/* Phones: New Project shrinks to its + icon so search keeps the room */
@media (max-width: 599px) {
  .task-toolbar__new {
    min-width: 32px;
    padding-inline: 6px;
  }

  .task-toolbar__new :deep(.v-btn__prepend) {
    margin-inline: 0;
  }
}

/* ── Category header: small muted label, its own hairline ── */
.project-group--categorized + .project-group--categorized {
  margin-top: 16px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 4px 6px 8px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.09);
}

.category-row__name {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* ── Project block: hairline between projects is the grouping ── */
.project-block {
  padding: 6px 0 10px;
}

.project-block + .project-block {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.09);
}

.project-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 4px 8px;
}

.project-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}

.project-title {
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

/* ── Task rows: indented to the project title, soft hover tint ── */
.task-rows {
  list-style: none;
  margin: 0;
  padding: 0 0 0 22px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 36px;
  padding: 2px 4px 2px 10px;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.task-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.task-empty {
  padding: 4px 0 2px 32px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Secondary actions stay quiet until the row is hovered (pointer devices only) */
@media (hover: hover) {
  .row-action {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .task-row:hover .row-action,
  .project-row:hover .row-action,
  .category-row:hover .row-action,
  .row-action:focus-visible {
    opacity: 1;
  }
}
</style>
