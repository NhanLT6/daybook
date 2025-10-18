<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { useProjectColors } from '@/composables/useProjectColors';
import { useWorkspace } from '@/composables/useWorkspace';

import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';

import { useField, useForm } from 'vee-validate';
import { object, string } from 'yup';

interface TaskFormData {
  projectTitle: string;
  taskTitle: string;
}

const projectColors = useProjectColors();
const { allTasks, allProjects, getTasksByProject, initTeamWorkPreset } = useWorkspace();

// Initialize default tasks and projects on mount
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

// Expansion panels state
const openedPanels = ref<string[]>([]);

const validationSchema = computed(() =>
  object({
    projectTitle: string().required('Project name is required'),
    taskTitle:
      isNewProject.value || editingProject.value ? string().optional() : string().required('Task name is required'),
  }),
);

const { errors, handleSubmit, resetForm } = useForm<TaskFormData>({
  initialValues: {
    projectTitle: undefined,
    taskTitle: undefined,
  },
  validationSchema: validationSchema,
  validateOnMount: false,
});

const projectField = useField<string>('projectTitle');
const taskField = useField<string>('taskTitle');

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
    },
  });
};

const createNewProject = () => {
  editingProject.value = null;
  editingTask.value = null;
  isNewProject.value = true;
  isNewTask.value = false;
  isDialogOpen.value = true;
  resetForm({
    values: {
      projectTitle: undefined,
      taskTitle: undefined,
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
    },
  });
};

const onSave = handleSubmit((values) => {
  if (isNewProject.value || editingProject.value) {
    const isProjectExisting = allProjects.value.map((p) => p.title).includes(values.projectTitle);
    if (!isProjectExisting) {
      allProjects.value.push({ title: values.projectTitle });
    } else if (editingProject.value && editingProject.value.title !== values.projectTitle) {
      const projectIndex = allProjects.value.findIndex((p) => p.title === editingProject.value!.title);
      if (projectIndex >= 0) {
        allProjects.value[projectIndex].title = values.projectTitle;
        allTasks.value.forEach((task) => {
          if (task.project === editingProject.value!.title) {
            task.project = values.projectTitle;
          }
        });
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
    // Delete from projects array (handles both regular and Jira projects)
    allProjects.value = allProjects.value.filter((p) => p.title !== projectToDelete.value);

    // Delete associated tasks
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

// Expand/Collapse all panels
const onExpandAll = () => {
  openedPanels.value = allProjects.value.map((p) => p.title);
};

const onCollapseAll = () => {
  openedPanels.value = [];
};
</script>

<template>
  <VContainer>
    <!-- Modal Dialog for Creating/Editing Projects and Tasks -->
    <VDialog v-model="isDialogOpen" max-width="500px">
      <VCard>
        <VCardTitle>
          <VToolbar class="bg-transparent">
            <VIcon class="me-2" size="20">mdi-folder-outline</VIcon>
            <VToolbarTitle>{{ currentMode }}</VToolbarTitle>
          </VToolbar>
        </VCardTitle>

        <VCardText>
          <!-- Form Fields for Project and Task Input -->
          <form class="d-flex flex-column ga-4">
            <VTextField
              v-model="projectField.value.value"
              label="Project Name"
              :error-messages="errors.projectTitle"
              :disabled="editingTask !== null"
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
              <VBtn variant="text" prepend-icon="mdi-cancel-outline" @click="onCancel" v-bind="props">Cancel</VBtn>
            </template>
            Cancel editing and close dialog
          </VTooltip>

          <VTooltip>
            <template #activator="{ props }">
              <VBtn
                variant="tonal"
                color="green-darken-3"
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

    <!-- Main Content Area - Projects and Tasks Management -->
    <VRow>
      <VCol cols="12">
        <VCard class="elevation-0 border">
          <VCardTitle>
            <VToolbar class="bg-transparent">
              <VIcon class="me-2" size="20">mdi-folder-outline</VIcon>
              <VToolbarTitle>Projects & Tasks</VToolbarTitle>

              <VSpacer />

              <div class="d-flex ga-2">
                <!-- Expand all -->
                <VTooltip>
                  <template #activator="{ props }">
                    <VBtn icon="mdi-arrow-expand" variant="text" size="small" @click="onExpandAll" v-bind="props" />
                  </template>
                  Expand all projects
                </VTooltip>

                <!-- Collapse all -->
                <VTooltip>
                  <template #activator="{ props }">
                    <VBtn icon="mdi-arrow-collapse" variant="text" size="small" @click="onCollapseAll" v-bind="props" />
                  </template>
                  Collapse all projects
                </VTooltip>

                <!-- New Project button -->
                <VTooltip>
                  <template #activator="{ props }">
                    <VBtn variant="tonal" prepend-icon="mdi-plus-outline" @click="createNewProject" v-bind="props">
                      New Project
                    </VBtn>
                  </template>
                  Create a new project
                </VTooltip>
              </div>
            </VToolbar>
          </VCardTitle>

          <!-- Projects List - Expandable panels showing tasks for each project -->
          <VExpansionPanels
            v-if="allProjects.length > 0"
            variant="accordion"
            multiple
            elevation="0"
            v-model="openedPanels"
          >
            <VExpansionPanel
              v-for="projectTitle in allProjects.map((p) => p.title)"
              :key="projectTitle"
              :value="projectTitle"
            >
              <VExpansionPanelTitle>
                <div class="d-flex align-center justify-space-between w-100">
                  <div class="d-flex align-center flex-grow-1 min-width-0">
                    <VAvatar
                      :color="projectColors.getProjectColor(projectTitle)"
                      size="small"
                      class="me-2 flex-shrink-0"
                    />

                    <span class="font-weight-medium me-2 project-title">
                      {{ projectTitle }}

                      <VChip size="x-small" variant="tonal">
                        {{ getTasksByProject(projectTitle).length || 0 }} Task(s)
                      </VChip>
                    </span>
                  </div>

                  <div class="d-flex flex-shrink-0">
                    <VTooltip>
                      <template #activator="{ props }">
                        <VBtn
                          icon="mdi-trash-can-outline"
                          variant="text"
                          size="x-small"
                          @click.stop="confirmDeleteProject(projectTitle)"
                          class="me-1"
                          v-bind="props"
                        />
                      </template>
                      Delete project{{ getTasksByProject(projectTitle).length > 0 ? ' and all its tasks' : '' }}
                    </VTooltip>

                    <VTooltip>
                      <template #activator="{ props }">
                        <VBtn
                          icon="mdi-pencil-outline"
                          variant="text"
                          size="x-small"
                          @click.stop="editProject({ title: projectTitle })"
                          class="me-1"
                          v-bind="props"
                        />
                      </template>
                      Edit project name
                    </VTooltip>

                    <VTooltip>
                      <template #activator="{ props }">
                        <VBtn
                          icon="mdi-plus-outline"
                          variant="text"
                          size="x-small"
                          @click.stop="createNewTask(projectTitle)"
                          v-bind="props"
                        />
                      </template>
                      Add new task to this project
                    </VTooltip>
                  </div>
                </div>
              </VExpansionPanelTitle>

              <VExpansionPanelText class="pa-0">
                <VCard class="elevation-0 rounded-0">
                  <!-- Tasks Table - Shows all tasks within the current project -->
                  <VDataTable
                    v-if="getTasksByProject(projectTitle).length"
                    :items="
                      getTasksByProject(projectTitle).map((task) => ({ title: task.title, project: projectTitle }))
                    "
                    :headers="[]"
                    class="bg-grey-lighten-4"
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
                          </div>
                        </td>
                      </tr>
                    </template>
                  </VDataTable>

                  <!-- Empty State - Shown when project has no tasks -->
                  <div v-else class="text-center py-4 text-medium-emphasis bg-grey-lighten-4 rounded-0">
                    No tasks in this project.
                    <a
                      href="#"
                      class="text-decoration-none text-primary ms-1"
                      @click.prevent="createNewTask(projectTitle)"
                    >
                      Add one
                    </a>
                  </div>
                </VCard>
              </VExpansionPanelText>
            </VExpansionPanel>
          </VExpansionPanels>

          <!-- Empty State - Shown when no projects exist -->
          <div v-else class="text-center py-8 text-medium-emphasis">
            <VIcon size="64" class="mb-4">mdi-folder-plus-outline</VIcon>
            <div class="text-h6 mb-2">No projects yet</div>
            <div>Create your first project to get started</div>
          </div>
        </VCard>
      </VCol>
    </VRow>
  </VContainer>

  <!-- Confirmation Dialog - Project Deletion with Task Warning -->
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
            <VBtn variant="text" @click="cancelDeleteProject" v-bind="props"> Cancel </VBtn>
          </template>
          Cancel deletion
        </VTooltip>

        <VTooltip>
          <template #activator="{ props }">
            <VBtn variant="tonal" color="error" @click="executeDeleteProject" v-bind="props"> Delete Project </VBtn>
          </template>
          Permanently delete project and all its tasks
        </VTooltip>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

/* Remove spacing between table and container borders */
.v-expansion-panel-text.pa-0 .v-expansion-panel-text__wrapper {
  padding: 0 !important;
}

/* Flexible project title that wraps when needed */
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

  /* Make action buttons more compact */
  .v-btn--size-x-small {
    min-width: 28px !important;
    width: 28px !important;
    height: 28px !important;
  }
}
</style>
