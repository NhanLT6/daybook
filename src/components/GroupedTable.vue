<script setup lang="ts" generic="G extends TableGroup<any>">
import { computed, useSlots } from 'vue';

import { useDisplay } from 'vuetify';

// The one table the list pages share. Column titles sit on the glass; the rows sit in solid
// (tier-1) cards: consecutive groups with the same `block` share a card, and blocks are spaced
// apart (a week of logs, a category of projects), so a light week reads as a small card. Inside a
// card, groups (a day, a project, a month) open with a full-width group row and are split by
// hairlines. Cells, group rows and row actions come in through slots; spacing, hairlines, hover
// and the hover-revealed actions live here so the pages can't drift.
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
  // DOM id on the group's <tbody>, e.g. a date to scroll to
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

// Optional columns drop out on narrow screens. Done here rather than in CSS so colspans stay right.
const { smAndUp, mdAndUp } = useDisplay();
const columns = computed(() =>
  allColumns.filter(
    (col) => !col.hideBelow || (col.hideBelow === 'sm' ? smAndUp.value : mdAndUp.value),
  ),
);

// The group title spans every column up to the first one that has a `group.<key>` slot
const slots = useSlots();
const groupSpan = computed(() => {
  const first = columns.value.findIndex((col, i) => i > 0 && !!slots[`group.${col.key}`]);
  return first === -1 ? columns.value.length : first;
});

const isOpen = (group: G) => !collapsible || expanded.value.includes(group.key);

const toggle = (group: G) => {
  if (!collapsible) return;
  expanded.value = isOpen(group)
    ? expanded.value.filter((k) => k !== group.key)
    : [...expanded.value, group.key];
};

// Consecutive groups sharing a block key form one card
const blocks = computed(() => {
  const out: { key: string; label?: string; groups: G[] }[] = [];
  for (const group of groups) {
    const key = group.block ?? '';
    const last = out.at(-1);
    if (last && last.key === key) last.groups.push(group);
    else out.push({ key, label: group.blockLabel, groups: [group] });
  }
  return out;
});

const colWidth = (col: TableColumn) => (typeof col.width === 'number' ? `${col.width}px` : col.width);

const alignClass = (col: TableColumn) => (col.align === 'end' ? 'text-end' : undefined);
</script>

<template>
  <div class="gt">
    <!-- Column titles on the glass, pinned under the toolbar while the body scrolls -->
    <div class="gt-head">
      <table class="gt-table">
        <colgroup>
          <col v-for="col in columns" :key="col.key" :style="{ width: colWidth(col) }" />
          <col :style="{ width: `${actionsWidth}px` }" />
        </colgroup>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :class="alignClass(col)">{{ col.title }}</th>
            <th aria-label="Actions" />
          </tr>
        </thead>
      </table>
    </div>

    <template v-for="block in blocks" :key="block.key">
      <!-- Label above a block's card (e.g. a category) -->
      <div v-if="block.label" class="gt-block-label">
        <slot name="block-label" :label="block.label" :group="block.groups[0]">{{ block.label }}</slot>
      </div>

      <!-- One solid card per block; same colgroup as the head so columns line up -->
      <div class="gt-block">
        <table class="gt-table">
          <colgroup>
            <col v-for="col in columns" :key="col.key" :style="{ width: colWidth(col) }" />
            <col :style="{ width: `${actionsWidth}px` }" />
          </colgroup>

          <tbody v-for="group in block.groups" :id="group.id" :key="group.key" class="gt-group">
            <!-- Group row: the page's group slot fills the first column(s) (title, count); `group.<key>` slots
                 put group totals under their column; `group-actions` sits over the row actions -->
            <tr
              class="gt-group-row"
              :class="{ 'gt-group-row--toggle': collapsible }"
              :aria-expanded="collapsible ? isOpen(group) : undefined"
              @click="toggle(group)"
            >
              <td :colspan="groupSpan">
                <div class="gt-group-row__inner">
                  <VIcon
                    v-if="collapsible"
                    :icon="isOpen(group) ? 'mdi-chevron-down' : 'mdi-chevron-right'"
                    size="18"
                    class="gt-chevron"
                  />
                  <slot name="group" :group="group" :open="isOpen(group)" />
                </div>
              </td>
              <td v-for="col in columns.slice(groupSpan)" :key="col.key" :class="alignClass(col)">
                <slot :name="`group.${col.key}`" :group="group" />
              </td>
              <td class="gt-actions" @click.stop>
                <div class="gt-actions__inner"><slot name="group-actions" :group="group" /></div>
              </td>
            </tr>

            <template v-if="isOpen(group)">
              <tr
                v-for="row in group.rows"
                :key="rowKey(row)"
                class="gt-row"
                :class="rowClass?.(row)"
                @click="emit('rowClick', row)"
              >
                <td v-for="col in columns" :key="col.key" :class="alignClass(col)">
                  <slot :name="`cell.${col.key}`" :row="row">{{ (row as Record<string, unknown>)[col.key] }}</slot>
                </td>
                <td class="gt-actions" @click.stop>
                  <div class="gt-actions__inner"><slot name="actions" :row="row" /></div>
                </td>
              </tr>

              <!-- A group with no rows (e.g. a project without tasks) -->
              <tr v-if="group.rows.length === 0 && $slots['group-empty']" class="gt-empty-row">
                <td :colspan="columns.length + 1"><slot name="group-empty" :group="group" /></td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Cards are inset from the glass edge like Insights' cards; spaced apart by the glass between them */
.gt {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 8px 12px;
}

.gt-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 0.875rem;
}

/* Column titles: small, muted, on the glass, pinned. Once the list scrolls they take a solid fill
   so rows don't show through (ListPanel marks its body as scrolled). */
.gt-head {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0 -8px -8px;
  padding: 0 8px;
}

:global(.list-panel__body--scrolled) .gt-head {
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 1px 0 rgba(var(--v-theme-on-surface), 0.09);
}

.gt-head th {
  height: 32px;
  padding: 0 12px;
  text-align: start;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Tier 1: the solid card the rows sit in */
.gt-block {
  overflow: hidden;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
}

.gt-block-label {
  margin: 4px 0 -6px;
  padding: 0 4px 0 12px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Numbers line up in their columns */
.gt-table td.text-end {
  font-variant-numeric: tabular-nums;
}

/* Group row: the hairline above it is what separates groups within a card */
.gt-group-row td {
  height: 44px;
  padding: 6px 12px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.gt-group:first-of-type .gt-group-row td {
  border-top-color: transparent;
}

.gt-group-row__inner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.gt-group-row--toggle {
  cursor: pointer;
}

.gt-group-row--toggle:hover td {
  background-color: rgba(var(--v-theme-on-surface), 0.03);
}

.gt-chevron {
  margin-inline-start: -4px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* Rows: plain, a soft tint on hover */
.gt-row td {
  height: 40px;
  padding: 4px 12px;
  vertical-align: middle;
  overflow-wrap: anywhere;
}

.gt-row:hover td {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.gt-group > .gt-row:last-child td,
.gt-empty-row td {
  padding-bottom: 8px;
}

.gt-empty-row td {
  padding: 0 12px 10px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.gt-actions__inner {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

/* Row actions stay quiet until the row is hovered or focused (pointer devices only) */
@media (hover: hover) {
  .gt-actions__inner {
    opacity: 0;
    transition: opacity 0.15s;
  }

  .gt-row:hover .gt-actions__inner,
  .gt-group-row:hover .gt-actions__inner,
  .gt-actions__inner:focus-within {
    opacity: 1;
  }
}
</style>
