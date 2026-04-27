<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useCategories } from '@/composables/useCategories';
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

onMounted(() => {
  initTeamWorkPreset();
});

const editingTask = ref<Task | null>(null);
const editingProject = ref<Project | null>(null);
const isNewTask = ref(false);
const isNewProject = ref(false);
const isDialogOpen = ref(false);
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

const projectGroups = computed(() => {
  if (!settingsStore.useCategories) {
    return [{ categoryId: null as string | null, categoryName: null as string | null, projects: allProjects.value }];
  }

  const groups: { categoryId: string | null; categoryName: string; projects: Project[] }[] = [];

  for (const cat of sortedCategories.value) {
    const projects = allProjects.value.filter((p) => p.categoryId === cat.id);
    groups.push({ categoryId: cat.id, categoryName: cat.name, projects });
  }

  // Uncategorized group (only shown if there are projects without a valid category)
  const uncategorized = allProjects.value.filter(
    (p) => !p.categoryId || !sortedCategories.value.find((c) => c.id === p.categoryId),
  );
  if (uncategorized.length > 0) {
    groups.push({ categoryId: null, categoryName: 'Uncategorized', projects: uncategorized });
  }

  return groups;
});

// ─── Form ─────────────────────────────────────────────────────

const validationSchema = computed(() =>
  object({
    projectTitle: string().required('Project name is required'),
    taskTitle:
      isNewProject.value || editingProject.value ? string().optional() : string().required('Task name is required'),
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
  editingTask.value = task;
  editingProject.value = null;
  isNewTask.value = false;
  isNewProject.value = false;
  isDialogOpen.value = true;

  resetForm({
    values: {
      projectTitle: task.project,
      taskTitle: task.title,
      categoryId: undefined,
    },
  });
};

const editProject = (project: Project) => {
  editingProject.value = project;
  editingTask.value = null;
  isNewProject.value = false;
  isNewTask.value = false;
  isDialogOpen.value = true;
  resetForm({
    values: {
      projectTitle: project.title,
      taskTitle: '',
      categoryId: project.categoryId ?? null,
    },
  });
};

const createNewProject = (forCategoryId?: string | null) => {
  editingProject.value = null;
  editingTask.value = null;
  isNewProject.value = true;
  isNewTask.value = false;
  isDialogOpen.value = true;
  resetForm({
    values: {
      projectTitle: undefined,
      taskTitle: undefined,
      categoryId: forCategoryId ?? null,
    },
  });
};

const createNewTask = (forProjectTitle?: string) => {
  editingTask.value = null;
  editingProject.value = null;
  isNewTask.value = true;
  isNewProject.value = false;
  isDialogOpen.value = true;
  resetForm({
    values: {
      projectTitle: forProjectTitle || undefined,
      taskTitle: undefined,
      categoryId: undefined,
    },
  });
};

const onSave = handleSubmit((values) => {
  if (isNewProject.value || editingProject.value) {
    const isProjectExisting = allProjects.value.map((p) => p.title).includes(values.projectTitle);
    if (!isProjectExisting) {
      allProjects.value.push({
        title: values.projectTitle,
        categoryId: values.categoryId ?? undefined,
      });
    } else if (editingProject.value && editingProject.value.title !== values.projectTitle) {
      const projectIndex = allProjects.value.findIndex((p) => p.title === editingProject.value!.title);
      if (projectIndex >= 0) {
        allProjects.value[projectIndex] = {
          ...allProjects.value[projectIndex],
          title: values.projectTitle,
          categoryId: values.categoryId ?? undefined,
        };
        allTasks.value.forEach((task) => {
          if (task.project === editingProject.value!.title) {
            task.project = values.projectTitle;
          }
        });
      }
    } else if (editingProject.value) {
      // Same title, just update categoryId
      const projectIndex = allProjects.value.findIndex((p) => p.title === editingProject.value!.title);
      if (projectIndex >= 0) {
        allProjects.value[projectIndex] = {
          ...allProjects.value[projectIndex],
          categoryId: values.categoryId ?? undefined,
        };
      }
    }

    // If creating a new project and task name is provided, create the task too
    if (isNewProject.value && values.taskTitle && values.taskTitle.trim()) {
      const isTaskExisting = allTasks.value.some(
        (t) => t.title === values.taskTitle && t.project === values.projectTitle,
      );
      if (!isTaskExisting) {
        allTasks.value.push({
          title: values.taskTitle,
          project: values.projectTitle,
        });
      }
    }
  }

  if (isNewTask.value || editingTask.value) {
    if (!isNewTask.value && editingTask.value) {
      const taskIndex = allTasks.value.findIndex(
        (t) => t.title === editingTask.value!.title && t.project === editingTask.value!.project,
      );
      if (taskIndex >= 0) {
        allTasks.value[taskIndex] = {
          title: values.taskTitle,
          project: values.projectTitle,
        };
      }
    } else {
      const isTaskExisting = allTasks.value.some(
        (t) => t.title === values.taskTitle && t.project === values.projectTitle,
      );
      if (!isTaskExisting) {
        allTasks.value.push({
          title: values.taskTitle,
          project: values.projectTitle,
        });
      }
    }
  }

  resetForm();
  editingTask.value = null;
  editingProject.value = null;
  isNewTask.value = false;
  isNewProject.value = false;
  isDialogOpen.value = false;
});

const onCancel = () => {
  resetForm();
  editingTask.value = null;
  editingProject.value = null;
  isNewTask.value = false;
  isNewProject.value = false;
  isDialogOpen.value = false;
};

const confirmDeleteProject = (projectTitle: string) => {
  const tasksInProject = getTasksByProject(projectTitle).length;

  if (tasksInProject === 0) {
    allProjects.value = allProjects.value.filter((p) => p.title !== projectTitle);
    return;
  }

  projectToDelete.value = projectTitle;
  isDeleteProjectDialogOpen.value = true;
};

const executeDeleteProject = () => {
  if (projectToDelete.value) {
    allProjects.value = allProjects.value.filter((p) => p.title !== projectToDelete.value);
    allTasks.value = allTasks.value.filter((t) => t.project !== projectToDelete.value);

    projectToDelete.value = null;
    isDeleteProjectDialogOpen.value = false;
  }
};

const cancelDeleteProject = () => {
  projectToDelete.value = null;
  isDeleteProjectDialogOpen.value = false;
};

const deleteTaskDirectly = (taskTitle: string, projectTitle: string) => {
  const taskIndex = allTasks.value.findIndex((t) => t.title === taskTitle && t.project === projectTitle);
  if (taskIndex >= 0) {
    allTasks.value.splice(taskIndex, 1);
  }
};

const currentMode = computed(() => {
  if (isNewProject.value) return 'New Project';
  if (isNewTask.value) return 'New Task';
  if (editingProject.value) return 'Edit Project';
  if (editingTask.value) return 'Edit Task';
  return 'Task Management';
});

const showTaskField = computed(() => isNewTask.value || editingTask.value || isNewProject.value);
</script>

<template>
  <VContainer>
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
              :disabled="editingTask !== null"
            />

            <!-- Category dropdown — only when categories feature is enabled -->
            <VSelect
              v-if="settingsStore.useCategories && (isNewProject || editingProject)"
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
              :hint="isNewProject ? 'This field is optional when creating a project' : ''"
              :persistent-hint="isNewProject"
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
              isNewProject
                ? 'Create new project'
                : isNewTask
                  ? 'Create new task'
                  : editingProject
                    ? 'Save project changes'
                    : 'Save task changes'
            }}
          </VTooltip>
        </VCardActions>
      </VCard>
    </VDialog>

    <!-- Main Content Area -->
    <VRow>
      <VCol cols="12">
        <VCard class="glass-acrylic">
          <VCardTitle>
            <VToolbar class="bg-transparent">
              <VToolbarTitle class="ms-0">Projects & Tasks</VToolbarTitle>

              <VSpacer />

              <div class="d-flex ga-2">
                <!-- New Category button (categories mode only) -->
                <VTooltip v-if="settingsStore.useCategories">
                  <template #activator="{ props }">
                    <VBtn
                      variant="text"
                      prepend-icon="mdi-shape-plus-outline"
                      size="small"
                      @click="openAddCategory"
                      v-bind="props"
                    >
                      <span class="d-none d-sm-inline">New Category</span>
                    </VBtn>
                  </template>
                  Add a new category
                </VTooltip>

                <!-- New Project button -->
                <VTooltip>
                  <template #activator="{ props }">
                    <VBtn
                      color="primary"
                      variant="tonal"
                      prepend-icon="mdi-plus"
                      @click="createNewProject()"
                      v-bind="props"
                    >
                      <span class="d-none d-sm-inline">New Project</span>
                    </VBtn>
                  </template>
                  Create a new project
                </VTooltip>
              </div>
            </VToolbar>
          </VCardTitle>

          <!-- Projects grouped by category -->
          <template v-if="allProjects.length > 0">
            <div v-for="group in projectGroups" :key="group.categoryId ?? 'uncategorized'" class="mb-6">
              <!-- Category section header (only when categories enabled) -->
              <div v-if="settingsStore.useCategories" class="d-flex align-center px-4 py-2 bg-container rounded-0">
                <span class="text-subtitle-2 font-weight-bold flex-grow-1">{{ group.categoryName }}</span>

                <VTooltip v-if="group.categoryId">
                  <template #activator="{ props }">
                    <VBtn
                      icon="mdi-pencil-outline"
                      variant="text"
                      size="x-small"
                      v-bind="props"
                      @click="openEditCategory(sortedCategories.find((c) => c.id === group.categoryId)!)"
                    />
                  </template>
                  Rename category
                </VTooltip>

                <VTooltip v-if="group.categoryId">
                  <template #activator="{ props }">
                    <VBtn
                      icon="mdi-trash-can-outline"
                      variant="text"
                      size="x-small"
                      v-bind="props"
                      @click="deleteCategory(group.categoryId!)"
                    />
                  </template>
                  Delete category (projects become Uncategorized)
                </VTooltip>
              </div>

              <!-- Projects in this group -->
              <div v-for="project in group.projects" :key="project.title" class="project-section">
                <!-- Project row -->
                <div class="d-flex align-center px-4 py-2">
                  <VAvatar
                    :color="projectColors.getProjectColor(project.title)"
                    size="small"
                    class="me-3 flex-shrink-0"
                  />

                  <span class="font-weight-medium flex-grow-1 project-title">
                    {{ project.title }}
                    <VChip size="x-small" variant="tonal" class="ms-2">
                      {{ getTasksByProject(project.title).length }} Task(s)
                    </VChip>
                  </span>

                  <div class="d-flex flex-shrink-0 ga-1">
                    <VTooltip>
                      <template #activator="{ props }">
                        <VBtn
                          icon="mdi-pencil-outline"
                          variant="text"
                          size="x-small"
                          v-bind="props"
                          @click="editProject(project)"
                        />
                      </template>
                      Edit project
                    </VTooltip>

                    <VTooltip>
                      <template #activator="{ props }">
                        <VBtn
                          icon="mdi-trash-can-outline"
                          variant="text"
                          size="x-small"
                          v-bind="props"
                          @click="confirmDeleteProject(project.title)"
                        />
                      </template>
                      Delete project{{ getTasksByProject(project.title).length > 0 ? ' and all its tasks' : '' }}
                    </VTooltip>

                    <VTooltip>
                      <template #activator="{ props }">
                        <VBtn
                          icon="mdi-plus"
                          variant="text"
                          size="x-small"
                          v-bind="props"
                          @click="createNewTask(project.title)"
                        />
                      </template>
                      Add new task to this project
                    </VTooltip>
                  </div>
                </div>

                <!-- Tasks under this project -->
                <VDataTable
                  v-if="getTasksByProject(project.title).length"
                  :items="
                    getTasksByProject(project.title).map((task) => ({ title: task.title, project: project.title }))
                  "
                  :headers="[]"
                  class="bg-container ms-10"
                  hide-default-footer
                  hide-default-header
                >
                  <template #item="{ item }">
                    <tr @click="editTask({ title: item.title, project: item.project })" class="cursor-pointer">
                      <td class="d-flex align-center pa-3">
                        <span class="text-truncate flex-grow-1 me-2">{{ item.title }}</span>

                        <div class="d-flex flex-shrink-0">
                          <VTooltip>
                            <template #activator="{ props }">
                              <VBtn
                                icon="mdi-pencil-outline"
                                variant="text"
                                size="x-small"
                                @click.stop="editTask({ title: item.title, project: item.project })"
                                v-bind="props"
                              />
                            </template>
                            Edit task name
                          </VTooltip>

                          <VTooltip>
                            <template #activator="{ props }">
                              <VBtn
                                icon="mdi-trash-can-outline"
                                variant="text"
                                size="x-small"
                                @click.stop="deleteTaskDirectly(item.title, item.project)"
                                class="me-1"
                                v-bind="props"
                              />
                            </template>
                            Delete this task
                          </VTooltip>
                        </div>
                      </td>
                    </tr>
                  </template>
                </VDataTable>

                <!-- Empty task state -->
                <div v-else class="text-center py-2 text-medium-emphasis bg-container ms-10 text-caption">
                  No tasks in this project.
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
              <div v-if="settingsStore.useCategories" class="px-4 py-2">
                <VBtn variant="text" prepend-icon="mdi-plus" size="small" @click="createNewProject(group.categoryId)">
                  New Project in {{ group.categoryName }}
                </VBtn>
              </div>
            </div>
          </template>

          <!-- Empty State -->
          <div v-else class="text-center py-8 text-medium-emphasis">
            <VIcon size="64" class="mb-4">mdi-folder-plus-outline</VIcon>
            <div class="text-h6 mb-2">No projects yet</div>
            <div>Create your first project to get started</div>
          </div>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>

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
.cursor-pointer {
  cursor: pointer;
}

.project-title {
  flex: 1 1 0;
  min-width: 0;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .min-width-0 {
    min-width: 0;
  }

  .v-btn--size-x-small {
    min-width: 28px !important;
    width: 28px !important;
    height: 28px !important;
  }
}
</style>
