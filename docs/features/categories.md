# Categories Feature

## Overview

Categories are an optional grouping layer for Projects. They are disabled by default and can be enabled in **Settings → Enable Categories**.

Category is metadata on a **Project**, not on a TimeLog. Changing a project's category affects all logs for that project, not individual entries.

## Data Model

```
Category { id, name, displayOrder }   ← stored in localStorage via useCategories
Project  { title, categoryId? }       ← categoryId is optional; null/missing = Uncategorized
TimeLog  { id, date, project, task, duration, description }  ← no category field
```

Storage keys: see `src/common/storageKeys.ts`
Interfaces: `src/interfaces/Category.ts`, `src/interfaces/Project.ts`

## Key Files

| File | Role |
|------|------|
| `src/composables/useCategories.ts` | CRUD for categories (add returns the created `Category`) |
| `src/composables/useWorkspace.ts` | `sortedProjectItems` injects `{ header: true }` objects for VCombobox grouping |
| `src/views/TaskView.vue` | Manage categories (add/rename/delete) and assign projects to categories |
| `src/components/BulkLogForm.vue` | Category field shown during log entry (see rules below) |
| `src/stores/settings.ts` | `useCategories` boolean toggle |

## BulkLogForm Category Field Rules

The category VCombobox is only rendered when `settingsStore.useCategories` is true.

| State | Field behaviour |
|-------|----------------|
| Create mode + new project name | Editable — pick existing or type new category name |
| Create mode + existing project | Disabled — auto-fills with project's current category, hint to Tasks page |
| Edit mode | Disabled — shows project's category for reference, hint explains why |

On save (new project only): if the typed category name does not exist, `addCategory()` creates it and returns the new `Category` directly (no re-lookup needed).

## Project VCombobox Grouping (BulkLogForm & potentially others)

`sortedProjectItems` returns `Array<{ title: string; header?: true; categoryName?: string }>`, in this order:
1. **Pinned** — pinned projects (pin order).
2. **Recent** — up to 5 unpinned projects with the latest logged work date (`type: 'log'` only, so future
   plans don't count), newest first (`recentProjectTitles` in `useWorkspace.ts`).
3. The rest, each project appearing only once: category groups when categories are enabled (empty groups
   skipped), otherwise one "All projects" group, alphabetical.

Pinned and Recent items carry `categoryName` (categories enabled) so their category is visible outside a
category group. With categories off and nothing pinned or recent, it's a plain flat list with no headers.

The menu is capped at the field's width (`useElementSize` → `menu-props.maxWidth`), so long project names
truncate with an ellipsis (Vuetify's default for list item titles) instead of stretching the menu; names of
40+ characters show the full title in a delayed tooltip.

The `#item` slot checks `item.raw.header` to render `VListSubheader` vs a regular `VListItem`.
A `custom-filter` ensures header items always pass through search filtering.
Pinned items in the Pinned section render with `:subtitle="item.raw.categoryName"` on `VListItem` so the user knows which category the project belongs to without it being in a category group.

**Important:** Vuetify VCombobox can emit the full item object instead of the extracted string when `item-value` is set. Both the project and category comboboxes use `onProjectUpdate` / `onCategoryUpdate` handlers to normalize the emitted value to a string.

## TaskView Category Management

- **New Category / Rename / Delete**: dialog accessible via toolbar button and per-group action buttons
- Deleting a category does NOT cascade — its projects become Uncategorized
- Moving a project to a different category: done via the project Edit dialog in TaskView
- Category header rows use `bg-container` (theme-aware: `#F5F5F5` light / `#424242` dark)

## What Is NOT Implemented

- Category assignment in Reports/Charts (deferred)
- Per-log category (by design — category lives on the project)
