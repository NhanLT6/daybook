# Pin Projects Feature — Design

**Date:** 2026-02-04

## Summary

Allow users to pin projects in the project dropdown so frequently used projects appear at the top. Pinned state persists per-month in localStorage. A pin icon in each dropdown option toggles on click — visible on hover for unpinned items, always visible (filled) for pinned items.

---

## 1. Data & Storage

- **Storage key:** `pinnedProjects-${currentMonth}` — added to `storageKeys.ts`, follows the existing per-month pattern used by projects and tasks.
- **Stored value:** `string[]` — an ordered array of project titles. Array index represents pin order (first pinned = index 0).
- **No new interface needed** — reuses existing project `title` strings.

---

## 2. Logic (`useWorkspace.ts`)

Three additions to the existing composable:

### Pinned state & actions
```typescript
const pinnedProjects = useStorage<string[]>(storageKeys.pinnedProjects, []);

function pinProject(title: string) {
  if (!pinnedProjects.value.includes(title)) {
    pinnedProjects.value.push(title);
  }
}

function unpinProject(title: string) {
  pinnedProjects.value = pinnedProjects.value.filter((t) => t !== title);
}

function isPinned(title: string): boolean {
  return pinnedProjects.value.includes(title);
}
```

### Sorted project list (computed)
Replaces the current `.sort()` in the dropdown. Pinned items appear first in pin order, followed by the rest alphabetically. Stale pins (titles no longer in `myProjects`) are silently excluded.

```typescript
const sortedProjectTitles = computed(() => {
  const titles = myProjects.value.map((p) => p.title);
  const pinned = pinnedProjects.value.filter((t) => titles.includes(t));
  const unpinned = titles.filter((t) => !pinned.includes(t)).sort();
  return [...pinned, ...unpinned];
});
```

---

## 3. Component (`BulkLogForm.vue`)

### Items source
Swap the current inline sort for the new computed:
```vue
<!-- Before -->
:items="myProjects.map((p) => p.title).sort()"

<!-- After -->
:items="sortedProjectTitles"
```

### Item template with VHover
Wrap each list item in Vuetify's renderless `VHover` component to get `isHovering` without custom CSS. The pin icon uses `v-show` to control visibility:
- **Unpinned:** outline icon (`mdi-pin-outline`), visible only on hover
- **Pinned:** filled icon (`mdi-pin`), always visible

```vue
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
```

`@click.stop` prevents the pin toggle from also selecting the project in the combobox. `hoverProps` only carries mouse enter/leave handlers, so spreading with `itemProps` is safe.

---

## 4. Files to Change

| File | Change |
|------|--------|
| `src/common/storageKeys.ts` | Add `pinnedProjects` key |
| `src/composables/useWorkspace.ts` | Add pinned state, actions, and `sortedProjectTitles` computed |
| `src/components/BulkLogForm.vue` | Update `:items` and item template with `VHover` + pin icon |
