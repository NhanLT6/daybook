<script setup lang="ts" generic="G extends TableGroup<any>">
import { computed, inject, ref, useSlots } from 'vue';

import { LIST_SCROLLED_KEY } from '@/components/listPanelKeys';

import { useDisplay } from 'vuetify';

// The one grouped list the list pages share, built from Vuetify parts: each group (a day, a project,
// a month) is a VExpansionPanel whose title is the group row and whose body is a VDataTable of its
// rows. On top of that it adds only what Vuetify doesn't have: one row of column titles on the glass,
// group totals lined up under their column, and blocks: consecutive groups with the same
// `block` sit together and blocks are spaced apart with a hairline (a week of logs, a category of projects). Pages fill
// cells, group rows and row actions through slots.
export interface TableColumn {
  key: string;
  title: string;
  width?: number | string;
  align?: 'start' | 'end';
  // Hide on narrow screens: below Vuetify's sm (600px) or md (960px) breakpoint
  hideBelow?: 'sm' | 'md';
}

export interface TableGroup<R> {
  key: string;
  rows: R[];
  // DOM id on the group's panel, e.g. a date to scroll to
  id?: string;
  // Consecutive groups with the same block share one card (e.g. a week); omitted = one card for all
  block?: string;
  // Label shown above the block's card (e.g. a category name)
  blockLabel?: string;
}

type Row = G['rows'][number];

const {
  columns: allColumns,
  groups,
  rowKey,
  rowClass,
  collapsible = false,
  actionsWidth = 100,
} = defineProps<{
  columns: TableColumn[];
  // Groups may carry extra fields (e.g. their project) that the slots read back
  groups: G[];
  rowKey: (row: Row) => string;
  rowClass?: (row: Row) => unknown;
  // Group rows toggle their rows; `expanded` holds the open group keys
  collapsible?: boolean;
  // Room for the hover-revealed row actions
  actionsWidth?: number;
}>();

const expanded = defineModel<string[]>('expanded', { default: () => [] });

const emit = defineEmits<{
  rowClick: [row: Row];
}>();

defineSlots<
  {
    group(props: { group: G; open: boolean }): unknown;
    'group-empty'(props: { group: G }): unknown;
    'group-actions'(props: { group: G }): unknown;
    'block-label'(props: { label: string; group: G }): unknown;
    actions(props: { row: Row }): unknown;
  } & { [K in `cell.${string}`]: (props: { row: Row }) => unknown } & {
    [K in `group.${string}`]: (props: { group: G }) => unknown;
  }
>();

// Optional columns drop out on narrow screens
const { smAndUp, mdAndUp } = useDisplay();
const columns = computed(() =>
  allColumns.filter((col) => !col.hideBelow || (col.hideBelow === 'sm' ? smAndUp.value : mdAndUp.value)),
);

const toWidth = (width?: number | string) => (typeof width === 'number' ? `${width}px` : width);

// VDataTable headers: the page's columns plus the row-actions column
const headers = computed(() => [
  ...columns.value.map((col) => ({
    key: col.key,
    title: col.title,
    width: col.width,
    align: col.align,
    sortable: false,
  })),
  { key: 'actions', title: '', width: actionsWidth, sortable: false },
]);

// Group rows and column titles are grids with the table's column widths (free columns share the
// rest, like a fixed-layout table), so totals and titles line up with the cells below
const gridColumns = computed(() =>
  [...columns.value.map((col) => toWidth(col.width) ?? 'minmax(0, 1fr)'), `${actionsWidth}px`].join(' '),
);

// The group title spans every column up to the first one that has a `group.<key>` slot
const slots = useSlots();
const groupSpan = computed(() => {
  const first = columns.value.findIndex((col, i) => i > 0 && !!slots[`group.${col.key}`]);
  return first === -1 ? columns.value.length : first;
});

// Not collapsible: every group stays open (the panels are read-only)
const openPanels = computed({
  get: () => (collapsible ? expanded.value : groups.map((g) => g.key)),
  set: (keys: string[]) => {
    if (collapsible) expanded.value = keys;
  },
});

const isOpen = (group: G) => !collapsible || expanded.value.includes(group.key);

// Consecutive groups sharing a block form one card: flag each block's first and last panel
const panels = computed(() =>
  groups.map((group, i) => {
    const block = group.block ?? '';
    const blockStart = i === 0 || (groups[i - 1].block ?? '') !== block;
    const blockEnd = i === groups.length - 1 || (groups[i + 1].block ?? '') !== block;
    return { group, blockStart, blockEnd };
  }),
);

// ListPanel says when its body has scrolled, so the pinned column titles can take a fill
const listScrolled = inject(LIST_SCROLLED_KEY, ref(false));

const rowProps = ({ item }: { item: Row }) => ({ class: ['gt-row', rowClass?.(item)] });
const cellValue = (row: Row, key: string) => (row as Record<string, unknown>)[key];
const onRowClick = (_: Event, { item }: { item: Row }) => emit('rowClick', item);
</script>

<template>
  <div class="gt" :style="{ '--gt-columns': gridColumns }">
    <!-- Column titles on the glass, pinned under the toolbar while the body scrolls -->
    <div class="gt-head" :class="{ 'gt-head--frosted': listScrolled }">
      <div class="gt-grid">
        <span v-for="col in columns" :key="col.key" :class="{ 'text-end': col.align === 'end' }">
          {{ col.title }}
        </span>
      </div>
    </div>

    <VExpansionPanels
      v-model="openPanels"
      variant="accordion"
      multiple
      flat
      static
      focusable
      :readonly="!collapsible"
      class="gt-panels"
      :class="{ 'gt-panels--readonly': !collapsible }"
    >
      <template v-for="{ group, blockStart, blockEnd } in panels" :key="group.key">
        <!-- Label above a block's card (e.g. a category) -->
        <div v-if="blockStart && group.blockLabel" class="gt-block-label">
          <slot name="block-label" :label="group.blockLabel" :group="group">{{ group.blockLabel }}</slot>
        </div>

        <VExpansionPanel
          :id="group.id"
          :value="group.key"
          class="gt-panel"
          :class="{ 'gt-panel--block-start': blockStart, 'gt-panel--block-end': blockEnd }"
        >
          <!-- Group row: the page's group slot fills the first column(s) (title, count); `group.<key>` slots
               put group totals under their column; `group-actions` sits over the row actions -->
          <VExpansionPanelTitle hide-actions class="gt-group-title">
            <div class="gt-grid gt-group-row">
              <div class="gt-group-row__main" :style="{ gridColumn: `span ${groupSpan}` }">
                <VIcon
                  v-if="collapsible"
                  :icon="isOpen(group) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                  size="18"
                  class="gt-chevron"
                />
                <slot name="group" :group="group" :open="isOpen(group)" />
              </div>
              <div v-for="col in columns.slice(groupSpan)" :key="col.key" :class="{ 'text-end': col.align === 'end' }">
                <slot :name="`group.${col.key}`" :group="group" />
              </div>
              <!-- Room for the group actions, which sit outside the title: it is a <button> -->
              <div />
            </div>
          </VExpansionPanelTitle>

          <div v-if="$slots['group-actions']" class="gt-actions gt-group-actions">
            <slot name="group-actions" :group="group" />
          </div>

          <!-- The group's rows -->
          <VExpansionPanelText class="gt-group-body">
            <VDataTable
              :headers="headers"
              :items="group.rows"
              :item-value="rowKey"
              :items-per-page="-1"
              :mobile="false"
              :row-props="rowProps"
              hide-default-header
              hide-default-footer
              hover
              class="gt-table bg-transparent"
              @click:row="onRowClick"
            >
              <template v-for="col in columns" :key="col.key" #[`item.${col.key}`]="{ item }">
                <slot :name="`cell.${col.key}`" :row="item">{{ cellValue(item, col.key) }}</slot>
              </template>

              <!--suppress VueUnrecognizedSlot -->
              <template #item.actions="{ item }">
                <div class="gt-actions" @click.stop><slot name="actions" :row="item" /></div>
              </template>

              <!-- A group with no rows (e.g. a project without tasks) -->
              <template #no-data>
                <div class="gt-empty"><slot name="group-empty" :group="group" /></div>
              </template>
            </VDataTable>
          </VExpansionPanelText>
        </VExpansionPanel>
      </template>
    </VExpansionPanels>
  </div>
</template>

<style scoped>
/* Inset from the glass edge like Insights */
.gt {
  --gt-cell-pad: 8px;
  padding: 0 calc(var(--panel-pad, 16px) - var(--gt-cell-pad)) 12px;
}

/* Fixed layout keeps every group's columns at the same widths */
.gt :deep(table) {
  table-layout: fixed;
}

/* Header and group rows: a grid with the table's columns, cells padded like VDataTable's */
.gt-grid {
  display: grid;
  grid-template-columns: var(--gt-columns);
  align-items: center;
  width: 100%;
}

.gt-grid > * {
  min-width: 0;
  padding: 0 var(--gt-cell-pad);
}

/* Column titles on the glass, pinned. Once rows scroll under them they take a strip of the same
   frosted glass as the card (ListPanel provides the scroll state). */
.gt-head {
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0 calc(var(--panel-pad, 16px) * -1 + var(--gt-cell-pad));
  padding: 0 calc(var(--panel-pad, 16px) - var(--gt-cell-pad));
  height: 36px;
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.gt-head--frosted {
  backdrop-filter: blur(var(--glass-blur, 25.6px));
  -webkit-backdrop-filter: blur(var(--glass-blur, 25.6px));
  box-shadow: 0 1px 0 rgba(var(--v-border-color), var(--v-border-opacity));
}

.v-theme--light .gt-head--frosted {
  background: rgba(255, 255, 255, var(--glass-opacity-light, 0.83));
}

.v-theme--dark .gt-head--frosted {
  background: rgba(40, 47, 58, var(--glass-opacity-dark, 0.77));
}

/* Rows sit directly on the glass: panels have no surface of their own. Blocks are spaced apart and a
   hairline marks each start after the first. */
.gt-panels :deep(> .v-expansion-panel) {
  background: transparent;
}

.gt-panels :deep(> .v-expansion-panel.gt-panel--block-start:not(:first-child)) {
  margin-top: 12px;
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* Hairline between the groups of a block (flat drops Vuetify's): not at a block's top edge, and not under
   an open group, whose last row already draws one */
.gt-panels :deep(> .v-expansion-panel:not(:first-child)::after) {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.gt-panels :deep(> .v-expansion-panel.gt-panel--block-start::after),
.gt-panels :deep(> .v-expansion-panel--active + .v-expansion-panel::after) {
  opacity: 0;
}

/* An open group's row takes a faint tint (Vuetify's `focusable` activated overlay, toned down), so it
   reads apart from its rows */
.gt-panels {
  --v-activated-opacity: 0.04;
}

.v-theme--dark .gt-panels {
  --v-activated-opacity: 0.07;
}

.gt-block-label {
  width: 100%;
  margin: 16px 0 6px;
  padding: 0 4px 0 var(--gt-cell-pad);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.gt-block-label:first-child {
  margin-top: 4px;
}

/* Group row: the panel title, padded by its grid cells instead */
.gt-group-title {
  padding: 0;
  min-height: 48px;
  font-size: 0.8125rem;
  line-height: 1.3;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.gt-group-row__main {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.gt-chevron {
  margin-inline-start: -4px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Read-only groups (Tasks, Events) don't toggle */
.gt-panels--readonly .gt-group-title {
  cursor: default;
}

/* Over the group row's last column */
.gt-group-actions {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  height: 48px;
  align-items: center;
  padding-inline: var(--gt-cell-pad);
}

.gt-group-body :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}

/* The rows: a hairline from the group row, multi-line cells (a wrapped name) keep some air */
.gt-table {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.gt-table :deep(.gt-row > td) {
  padding-block: 8px !important;
  padding-inline: var(--gt-cell-pad) !important;
  overflow-wrap: anywhere;
}

/* Numbers line up in their columns */
.gt-table :deep(td.v-data-table-column--align-end) {
  font-variant-numeric: tabular-nums;
}

.gt-empty {
  text-align: start;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.gt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

/* Row actions stay quiet until the row is hovered or focused (pointer devices only) */
@media (hover: hover) {
  .gt-actions {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .gt-table :deep(.gt-row:hover) .gt-actions,
  .gt-group-title:hover + .gt-actions,
  .gt-group-actions:hover,
  .gt-actions:focus-within {
    opacity: 1;
  }
}
</style>
