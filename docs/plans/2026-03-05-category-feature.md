# Category Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user-defined categories so projects can be grouped (e.g. Work vs Side Projects). Categories are stored in localStorage, optional via a settings toggle, and Jira tickets can be auto-assigned a default category.

**Scope (Reports/Charts deferred to a later phase):**
- Category CRUD (add/rename/delete) stored in localStorage
- Projects gain an optional `categoryId` field
- Settings: `useCategories` toggle + Jira default category dropdown
- TaskView: projects grouped by category with flat section headers
- BulkLogForm: grouped project `VCombobox` using Vuetify `group-by`
- Jira projects auto-assigned the configured default category

**Tech:** Vue 3 + TypeScript + Composition API, Vuetify 3, `@vueuse/core` `useStorage`, nanoid, Pinia.

---

## Task 1: Add Category interface and storage key

**Files:**
- Create: `src/interfaces/Category.ts`
- Modify: `src/common/storageKeys.ts`

### Step 1: Create `src/interfaces/Category.ts`

```typescript
export interface Category {
  id: string
  name: string
  displayOrder: number
}
```

### Step 2: Add `categories` key to `src/common/storageKeys.ts`

Add `categories: 'categories'` to the `storageKeys` object (permanent key, not month-based, same as `events`).

### Step 3: Run `yarn type-check` — should pass.

### Step 4: Commit: `feat: add Category interface and storage key`

---

## Task 2: Update Project and JiraConfig interfaces

**Files:**
- Modify: `src/interfaces/Project.ts`
- Modify: `src/interfaces/JiraConfig.ts`

### Step 1: Update `src/interfaces/Project.ts`

```typescript
export interface Project {
  title: string
  categoryId?: string // undefined = uncategorized
}
```

### Step 2: Update `src/interfaces/JiraConfig.ts`

Add `defaultCategoryId?: string` field:

```typescript
export interface JiraConfig {
  enabled: boolean
  domain: string
  email: string
  apiToken: string
  projectKey: string
  statuses: string
  defaultCategoryId?: string // category assigned to synced Jira tickets
}
```

### Step 3: Run `yarn type-check` — should pass (field is optional, no breaking changes).

### Step 4: Commit: `feat: add categoryId to Project and defaultCategoryId to JiraConfig`

---

## Task 3: Create useCategories composable

**Files:**
- Create: `src/composables/useCategories.ts`

This composable owns category state and CRUD. It seeds the default "Work" category on first use.

```typescript
import { computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { nanoid } from 'nanoid';
import type { Category } from '@/interfaces/Category';
import { storageKeys } from '@/common/storageKeys';

const defaultCategories: Category[] = [
  { id: 'work', name: 'Work', displayOrder: 0 },
];

export function useCategories() {
  const categories = useStorage<Category[]>(storageKeys.categories, defaultCategories);

  // Sorted by displayOrder for consistent rendering
  const sortedCategories = computed(() =>
    [...categories.value].sort((a, b) => a.displayOrder - b.displayOrder),
  );

  const getCategoryById = (id: string | undefined): Category | undefined =>
    id ? categories.value.find((c) => c.id === id) : undefined;

  const getCategoryName = (id: string | undefined): string =>
    getCategoryById(id)?.name ?? 'Uncategorized';

  const addCategory = (name: string) => {
    const maxOrder = categories.value.reduce((max, c) => Math.max(max, c.displayOrder), -1);
    categories.value.push({ id: nanoid(), name: name.trim(), displayOrder: maxOrder + 1 });
  };

  const renameCategory = (id: string, newName: string) => {
    const cat = categories.value.find((c) => c.id === id);
    if (cat) cat.name = newName.trim();
  };

  // Deleting a category leaves its projects as "Uncategorized" (no cascade)
  const deleteCategory = (id: string) => {
    categories.value = categories.value.filter((c) => c.id !== id);
  };

  return {
    categories,
    sortedCategories,
    getCategoryById,
    getCategoryName,
    addCategory,
    renameCategory,
    deleteCategory,
  };
}
```

### Step: Run `yarn type-check`, then commit: `feat: add useCategories composable`

---

## Task 4: Settings — useCategories toggle and Jira default category dropdown

**Files:**
- Modify: `src/stores/settings.ts`
- Modify: `src/views/SettingView.vue`

### Step 1: Add `useCategories` to settings store (`src/stores/settings.ts`)

Add after the `useDefaultTasks` line:

```typescript
// Enable/disable category grouping feature
const useCategories = useStorage('useCategories', false);
```

Add `useCategories` to the return object.

### Step 2: Update `src/views/SettingView.vue`

**In `<script setup>`:** Import `useCategories` composable:

```typescript
import { useCategories } from '@/composables/useCategories';
const { sortedCategories } = useCategories();
```

**In App Configuration card template:** Add toggle after the `useDefaultTasks` switch:

```html
<!-- Enable Categories -->
<VSwitch
  v-model="settingsStore.useCategories"
  label="Enable Categories"
  persistent-hint
  hint="When enabled, projects can be grouped into categories for better organisation"
  color="primary"
/>
```

**In Jira Integration card template:** Add category dropdown below the Statuses field, above the action buttons div:

```html
<!-- Default category for Jira tickets -->
<VSelect
  v-model="settingsStore.jiraConfig.defaultCategoryId"
  :items="sortedCategories"
  item-title="name"
  item-value="id"
  label="Default category for Jira tickets"
  clearable
  :disabled="!settingsStore.jiraConfig.enabled || !settingsStore.useCategories"
  persistent-hint
  hint="Jira tickets synced will be auto-assigned this category"
/>
```

### Step: Run `yarn type-check` and `yarn build`, then commit: `feat: add useCategories toggle and Jira default category setting`

---

## Task 5: TaskView — category grouping and management

**Files:**
- Modify: `src/views/TaskView.vue`

This is the largest task. The flat `VExpansionPanels` list is replaced by category section headers with project rows beneath each one. A "Manage Categories" dialog handles CRUD.

### Step 1: Update `<script setup>`

Add imports and composable usage at the top:

```typescript
import { useCategories } from '@/composables/useCategories';
import { useSettingsStore } from '@/stores/settings';
import type { Category } from '@/interfaces/Category';

const settingsStore = useSettingsStore();
const { sortedCategories, getCategoryName, addCategory, renameCategory, deleteCategory } = useCategories();
```

Add category management dialog state after the existing dialog state refs:

```typescript
// Category management dialog
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
```

Add a `projectsByCategoryId` computed that groups projects for display:

```typescript
// Group projects by category. Each entry: { categoryId, categoryName, projects }
const projectGroups = computed(() => {
  if (!settingsStore.useCategories) {
    // When categories disabled: single group with all projects
    return [{ categoryId: null, categoryName: null, projects: allProjects.value.map((p) => p.title) }];
  }

  const groups: { categoryId: string | null; categoryName: string; projects: string[] }[] = [];

  // One group per category (in display order)
  for (const cat of sortedCategories.value) {
    const projects = allProjects.value.filter((p) => p.categoryId === cat.id).map((p) => p.title);
    groups.push({ categoryId: cat.id, categoryName: cat.name, projects });
  }

  // Uncategorized group
  const uncategorized = allProjects.value.filter((p) => !p.categoryId || !sortedCategories.value.find((c) => c.id === p.categoryId)).map((p) => p.title);
  if (uncategorized.length > 0) {
    groups.push({ categoryId: null, categoryName: 'Uncategorized', projects: uncategorized });
  }

  return groups;
});
```

Update `createNewProject` to accept an optional `categoryId`:

```typescript
const createNewProject = (forCategoryId?: string) => {
  // ... existing reset code ...
  // Pre-select category if provided
  // Store forCategoryId in a ref so the form can use it
};
```

Add `preselectedCategoryId` ref and pass it to the form dialog:

```typescript
const preselectedCategoryId = ref<string | undefined>(undefined);

const createNewProject = (forCategoryId?: string) => {
  editingProject.value = null;
  editingTask.value = null;
  isNewProject.value = true;
  isNewTask.value = false;
  preselectedCategoryId.value = forCategoryId;
  isDialogOpen.value = true;
  resetForm({ values: { projectTitle: undefined, taskTitle: undefined, categoryId: forCategoryId } });
};
```

Update the `TaskFormData` interface and form to include `categoryId`:

```typescript
interface TaskFormData {
  projectTitle: string
  taskTitle: string
  categoryId?: string
}
```

Add `categoryField` using `useField`:

```typescript
const categoryField = useField<string | undefined>('categoryId');
```

Update `onSave` to persist `categoryId` when creating/editing a project:

```typescript
// When saving a new project:
allProjects.value.push({ title: values.projectTitle, categoryId: values.categoryId });

// When editing a project (update categoryId too):
allProjects.value[projectIndex] = {
  ...allProjects.value[projectIndex],
  title: values.projectTitle,
  categoryId: values.categoryId,
};
```

Also update `editProject` to populate `categoryId` in the reset:

```typescript
const editProject = (project: Project) => {
  // ...existing code...
  resetForm({
    values: {
      projectTitle: project.title,
      taskTitle: '',
      categoryId: project.categoryId,
    },
  });
};
```

### Step 2: Update `<template>`

**Card header:** Add "Manage Categories" button (visible only when `useCategories` is on) next to the existing action buttons:

```html
<VBtn
  v-if="settingsStore.useCategories"
  variant="text"
  prepend-icon="mdi-shape-plus-outline"
  size="small"
  @click="openAddCategory"
>
  New Category
</VBtn>
```

**Replace the `VExpansionPanels` block** with category-grouped flat list:

```html
<template v-if="allProjects.length > 0">
  <div v-for="group in projectGroups" :key="group.categoryId ?? 'uncategorized'">
    <!-- Category section header (only when categories enabled) -->
    <div
      v-if="settingsStore.useCategories"
      class="d-flex align-center px-4 py-2 bg-surface-variant"
    >
      <span class="text-subtitle-2 font-weight-bold flex-grow-1">{{ group.categoryName }}</span>
      <VBtn
        v-if="group.categoryId"
        icon="mdi-pencil-outline"
        variant="text"
        size="x-small"
        @click="openEditCategory(sortedCategories.find(c => c.id === group.categoryId)!)"
      />
      <VBtn
        v-if="group.categoryId"
        icon="mdi-trash-can-outline"
        variant="text"
        size="x-small"
        @click="deleteCategory(group.categoryId)"
      />
    </div>

    <!-- Projects in this category -->
    <VList density="compact">
      <VListItem
        v-for="projectTitle in group.projects"
        :key="projectTitle"
      >
        <template #prepend>
          <VAvatar :color="projectColors.getProjectColor(projectTitle)" size="small" class="me-2" />
        </template>

        <VListItemTitle>
          {{ projectTitle }}
          <VChip size="x-small" variant="tonal" class="ms-2">
            {{ getTasksByProject(projectTitle).length }} Task(s)
          </VChip>
        </VListItemTitle>

        <!-- Tasks for this project (flat list, no collapse) -->
        <template v-if="getTasksByProject(projectTitle).length > 0">
          <VList density="compact" class="ms-6">
            <VListItem
              v-for="task in getTasksByProject(projectTitle)"
              :key="task.title"
              :title="task.title"
              @click="editTask({ title: task.title, project: projectTitle })"
              class="cursor-pointer"
            >
              <template #append>
                <VBtn icon="mdi-pencil-outline" variant="text" size="x-small" @click.stop="editTask({ title: task.title, project: projectTitle })" />
                <VBtn icon="mdi-trash-can-outline" variant="text" size="x-small" @click.stop="deleteTaskDirectly(task.title, projectTitle)" />
              </template>
            </VListItem>
          </VList>
        </template>

        <template #append>
          <VBtn icon="mdi-pencil-outline" variant="text" size="x-small" @click.stop="editProject({ title: projectTitle, categoryId: allProjects.find(p => p.title === projectTitle)?.categoryId })" />
          <VBtn icon="mdi-trash-can-outline" variant="text" size="x-small" @click.stop="confirmDeleteProject(projectTitle)" />
          <VBtn icon="mdi-plus" variant="text" size="x-small" @click.stop="createNewTask(projectTitle)" />
        </template>
      </VListItem>
    </VList>

    <!-- + New Project within category -->
    <div class="px-4 pb-2">
      <VBtn
        variant="text"
        prepend-icon="mdi-plus"
        size="small"
        @click="createNewProject(group.categoryId ?? undefined)"
      >
        New Project
      </VBtn>
    </div>
  </div>
</template>
```

**Project create/edit dialog:** Add category `VSelect` when categories enabled:

```html
<VSelect
  v-if="settingsStore.useCategories"
  v-model="categoryField.value.value"
  :items="sortedCategories"
  item-title="name"
  item-value="id"
  label="Category"
  clearable
  hint="Optional — leave blank for Uncategorized"
  persistent-hint
/>
```

**Add Manage Categories dialog** (after the existing delete confirmation dialog):

```html
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
```

### Step: Run `yarn type-check` and `yarn build`, then commit: `feat: add category grouping and management to TaskView`

---

## Task 6: BulkLogForm — grouped project dropdown

**Files:**
- Modify: `src/composables/useWorkspace.ts`
- Modify: `src/components/BulkLogForm.vue`

### Step 1: Add `sortedProjectItems` to `useWorkspace.ts`

Import `useCategories` and `useSettingsStore`, then add a new computed alongside `sortedProjectTitles`:

```typescript
import { useCategories } from '@/composables/useCategories';
import { useSettingsStore } from '@/stores/settings';

// Inside useWorkspace():
const settingsStore = useSettingsStore();
const { getCategoryName } = useCategories();

// For grouped VCombobox — objects with category name for group-by
const sortedProjectItems = computed(() => {
  return sortedProjectTitles.value.map((title) => {
    const project = myProjects.value.find((p) => p.title === title);
    return {
      title,
      category: settingsStore.useCategories
        ? getCategoryName(project?.categoryId)
        : undefined,
    };
  });
});
```

Return `sortedProjectItems` from `useWorkspace`.

### Step 2: Update `BulkLogForm.vue`

Import `useSettingsStore`:

```typescript
import { useSettingsStore } from '@/stores/settings';
const settingsStore = useSettingsStore();
```

Destructure `sortedProjectItems` from `useWorkspace`:

```typescript
const { ..., sortedProjectItems } = useWorkspace();
```

Update the project `VCombobox` to use grouped items when categories enabled:

```html
<VCombobox
  v-model="projectField.value.value"
  label="Project"
  :items="sortedProjectItems"
  item-title="title"
  item-value="title"
  :group-by="settingsStore.useCategories ? [{ key: 'category' }] : undefined"
  :error-messages="errors.project"
  autocomplete="new-password"
  aria-autocomplete="list"
>
  <template #item="{ props: itemProps, item }">
    <VHover>
      <template #default="{ isHovering, props: hoverProps }">
        <VListItem v-bind="{ ...itemProps, ...hoverProps }">
          <template #prepend>
            <VAvatar :color="projectColors.getProjectColor(item.value.title)" size="small" />
          </template>
          <template #append>
            <VBtn
              v-show="isHovering || isPinned(item.value.title)"
              :icon="isPinned(item.value.title) ? 'mdi-pin' : 'mdi-pin-outline'"
              variant="text"
              size="x-small"
              @click.stop="isPinned(item.value.title) ? unpinProject(item.value.title) : pinProject(item.value.title)"
            />
          </template>
        </VListItem>
      </template>
    </VHover>
  </template>
</VCombobox>
```

**Note:** When `item-value="title"` is set on a `VCombobox` with object items, the v-model receives the string `title` value directly — so `projectField.value.value` stays a `string`. No changes needed to form submission logic.

### Step: Run `yarn type-check` and `yarn build`, then commit: `feat: add grouped project dropdown to BulkLogForm`

---

## Task 7: Jira — auto-assign default category

**Files:**
- Modify: `src/composables/useWorkspace.ts`

### Step 1: Update `myProjects` computed in `useWorkspace.ts`

When building the merged project list, assign `defaultCategoryId` to Jira projects:

```typescript
const myProjects = computed(() => {
  const jiraCategoryId = settingsStore.jiraConfig.defaultCategoryId;

  const projects: Project[] = [
    ...allProjects.value,
    ...myJiraProjects.value.map((jp) => ({
      ...jp,
      categoryId: jp.categoryId ?? jiraCategoryId,
    })),
    ...(settingsStore.useDefaultTasks ? teamWorkProjects : []),
  ];

  return uniqBy(projects, (p) => p.title);
});
```

This means:
- If a Jira project already has `categoryId` set (e.g. user manually assigned one), it's preserved
- Otherwise it falls back to the Jira default from settings
- If no default is configured, `categoryId` is `undefined` → "Uncategorized"

### Step: Run `yarn type-check` and `yarn build`, then commit: `feat: auto-assign default category to Jira projects`

---

## Verification checklist

- [ ] `yarn type-check` passes
- [ ] `yarn build` passes
- [ ] `yarn lint` passes
- [ ] **Settings:** `Enable Categories` toggle appears in App Configuration
- [ ] **Settings:** Jira card shows category dropdown (disabled when Jira off or categories off)
- [ ] **TaskView (categories off):** flat project list unchanged from today
- [ ] **TaskView (categories on):** projects grouped under category section headers
- [ ] **TaskView:** "New Category" button appears in card header when categories on
- [ ] **TaskView:** Add/rename/delete category works via dialog
- [ ] **TaskView:** Deleting a category leaves its projects as Uncategorized
- [ ] **TaskView:** "+ New Project" within a category section pre-fills category on the form
- [ ] **TaskView:** Project create/edit form shows optional category dropdown when categories on
- [ ] **BulkLogForm (categories off):** project dropdown unchanged
- [ ] **BulkLogForm (categories on):** project dropdown groups by category name
- [ ] **Jira:** synced tickets appear under the configured default category
- [ ] **Jira:** if no default category set, Jira projects appear as Uncategorized
