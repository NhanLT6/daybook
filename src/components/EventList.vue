<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';

import { useEvents } from '@/composables/useEvents';
import { useWorkCalendar } from '@/composables/useWorkCalendar';

import EventForm from '@/components/EventForm.vue';
import GroupedTable from '@/components/GroupedTable.vue';
import ListPanel from '@/components/ListPanel.vue';

import type { TableColumn, TableGroup } from '@/components/GroupedTable.vue';
import type { AppEvent } from '@/interfaces/Event';

import { useDisplay } from 'vuetify';

import dayjs from 'dayjs';

import holidayImg from '@/assets/summer-holidays.png';
import { formatEventDate } from '@/common/DateHelpers';
import { atOccurrence, describeRepeat, eventDays, getNextOccurrence, occurrenceOn } from '@/common/eventRecurrence';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { omit } from 'lodash';
import { nanoid } from 'nanoid';

// The page's calendar owns the selection: a picked day highlights the events on it, a clicked row
// highlights that event on the calendar. One of the two at a time (EventView keeps them exclusive).
const { selectedDay = null, selectedEventId = null } = defineProps<{
  selectedDay?: string | null; // YYYY-MM-DD
  selectedEventId?: string | null;
}>();

const emit = defineEmits<{
  selectEvent: [id: string];
}>();

// ─── Events from shared db collection ─────────────────────────
const { events, addEvent, removeEvent } = useEvents();
const workCalendar = useWorkCalendar();
const notificationCenter = useNotificationCenterStore();
const { smAndUp } = useDisplay();

// ─── Filters ─────────────────────────────────────────────────
const typeFilter = ref<'all' | 'custom' | 'holiday'>('all');
const timeFilter = ref<'upcoming' | 'all'>('upcoming');
const searchText = ref('');
const isFilterMenuOpen = ref(false);

// The filter button names what's shown, e.g. "Upcoming · Mine"
const typeLabels = { all: 'All types', custom: 'Mine', holiday: 'Holidays' } as const;
const filterLabel = computed(
  () => `${timeFilter.value === 'upcoming' ? 'Upcoming' : 'All time'} · ${typeLabels[typeFilter.value]}`,
);

// One table row per event; `next` is its next occurrence (null once the series is over).
// Computed once per event here so the template never recomputes it.
interface EventRow {
  id: string;
  event: AppEvent;
  next: string | null;
}

// Events filtered by type + time + search, sorted by next occurrence (ended events fall back to their first date)
const filteredEvents = computed<EventRow[]>(() => {
  const q = (searchText.value ?? '').trim().toLowerCase();
  return (
    events.value
      .filter((e) => typeFilter.value === 'all' || e.type === typeFilter.value)
      .filter((e) => !q || e.title.toLowerCase().includes(q) || !!e.description?.toLowerCase().includes(q))
      .map((event) => ({ id: event.id, event, next: getNextOccurrence(event, undefined, workCalendar.value) }))
      // An event is past iff it has no occurrence left
      .filter((row) => timeFilter.value === 'all' || row.next !== null)
      .sort((a, b) => dayjs(a.next ?? a.event.date).diff(dayjs(b.next ?? b.event.date)))
  );
});

// One table group per month of the next occurrence
const monthGroups = computed<TableGroup<EventRow>[]>(() => {
  const groups: TableGroup<EventRow>[] = [];
  for (const row of filteredEvents.value) {
    const key = dayjs(row.next ?? row.event.date).format('YYYY-MM');
    const last = groups.at(-1);
    if (last?.key === key) last.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  return groups;
});

const monthLabel = (key: string) => {
  const d = dayjs(`${key}-01`);
  return d.isSame(dayjs(), 'year') ? d.format('MMMM') : d.format('MMMM YYYY');
};

// Empty-state copy reflects the active time filter
const emptyMessage = computed(() => (timeFilter.value === 'upcoming' ? 'No upcoming events' : 'No events'));

// Table columns
const columns: TableColumn[] = [
  { key: 'type', title: '', width: 48 },
  { key: 'title', title: 'Event' },
  { key: 'when', title: 'When', width: 240, hideBelow: 'sm' },
];

// Rows highlighted for the calendar selection: the events occurring on the picked day, or the clicked event
const activeIds = computed(() => {
  const day = selectedDay;
  if (!day) return new Set(selectedEventId ? [selectedEventId] : []);
  return new Set(
    filteredEvents.value
      .filter((row) => occurrenceOn(row.event, day, workCalendar.value) !== null)
      .map((row) => row.id),
  );
});

// Rows are clickable; past events dim, calendar-selected ones get the green tint
const rowClass = (row: EventRow) => [
  'event-row',
  { 'text-disabled': row.next === null, 'event-row--active': activeIds.value.has(row.id) },
];

// Scroll the first event on a newly picked day into view
const panel = ref<InstanceType<typeof ListPanel> | null>(null);
watch(
  () => selectedDay,
  async (day) => {
    if (!day) return;
    await nextTick();
    panel.value?.body?.querySelector('.event-row--active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
);

// ─── Modal state ─────────────────────────────────────────────
const isModalOpen = ref(false);
const editingEvent = ref<AppEvent | null>(null);

// ─── Actions ─────────────────────────────────────────────────

const openAddModal = () => {
  editingEvent.value = null;
  isModalOpen.value = true;
};

const openEditModal = (event: AppEvent) => {
  editingEvent.value = event;
  isModalOpen.value = true;
};

const onCancelModifyEvent = () => {
  isModalOpen.value = false;
};

const onSaveEvent = (event: AppEvent) => {
  // Assign ID for new events
  const savedEvent: AppEvent = {
    ...event,
    id: event.id || nanoid(),
  };

  addEvent(savedEvent);

  isModalOpen.value = false;
};

// Days of one occurrence without times, e.g. "Oct 6" or "Oct 5 – Oct 16" — a skip removes all of them
const occurrenceLabel = (event: AppEvent, occurrence: string) =>
  formatEventDate({ ...atOccurrence(event, occurrence), startTime: undefined, endTime: undefined });

// Leave the next occurrence out of a repeating series. Undo removes just that date from the
// event's CURRENT skip list, so a second skip made before undoing the first isn't lost.
const skipNextOccurrence = (event: AppEvent, next: string) => {
  if (!event.repeat) return;

  // Build new objects rather than mutating the reactive event; an empty list drops the key
  const withSkip = (target: AppEvent, skip: string[]): AppEvent => {
    const rule = omit(target.repeat!, 'skip');
    return { ...target, repeat: skip.length ? { ...rule, skip } : rule };
  };

  addEvent(withSkip(event, [...(event.repeat.skip ?? []), next]));

  const id = notificationCenter.success(`Skipped ${occurrenceLabel(event, next)}`, {
    message: event.title,
    expandOnEnqueue: true, // the chat panel's notification list opens expanded too
    actions: [
      {
        id: 'undo',
        label: 'Undo',
        tone: 'primary',
        closeOnComplete: true,
        onClick: () => {
          const current = events.value.find((e) => e.id === event.id);
          if (current?.repeat)
            addEvent(
              withSkip(
                current,
                (current.repeat.skip ?? []).filter((d) => d !== next),
              ),
            );
        },
      },
    ],
  });
  // Store forces actionable notifications persistent by design; auto-close the undo offer ourselves.
  setTimeout(() => notificationCenter.dismiss(id), 6000);
};

const deleteEvent = (event: AppEvent) => {
  notificationCenter.confirm('Delete event?', {
    message: event.title,
    actions: [
      {
        id: 'cancel',
        label: 'Cancel',
        closeOnComplete: true,
      },
      {
        id: 'delete',
        label: 'Delete',
        tone: 'danger',
        closeOnComplete: true,
        onClick: () => {
          removeEvent(event.id);
        },
      },
    ],
  });
};
</script>

<template>
  <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
    <ListPanel
      ref="panel"
      v-model:search="searchText"
      class="flex-grow-1"
      title="Events"
      :count="filteredEvents.length"
      search-placeholder="Search events"
    >
      <!-- Time + type filters in one popup, like the Logs filter -->
      <template #filters>
        <VMenu v-model="isFilterMenuOpen" :close-on-content-click="false" location="bottom end" offset="8">
          <template #activator="{ props: menuProps }">
            <VBtn
              class="list-filter-btn event-filter"
              variant="flat"
              rounded="lg"
              prepend-icon="mdi-filter-variant"
              append-icon="mdi-chevron-down"
              v-bind="menuProps"
              v-tooltip="'Filter events'"
            >
              <span class="event-filter__label">{{ filterLabel }}</span>
            </VBtn>
          </template>

          <VCard class="pa-3 d-flex flex-column ga-3 event-filter-menu">
            <VBtnToggle v-model="timeFilter" density="compact" variant="outlined" divided mandatory>
              <VBtn value="upcoming" size="small">Upcoming</VBtn>
              <VBtn value="all" size="small">All time</VBtn>
            </VBtnToggle>

            <VBtnToggle v-model="typeFilter" density="compact" variant="outlined" divided mandatory>
              <VBtn value="all" size="small">All</VBtn>
              <VBtn value="custom" size="small">Mine</VBtn>
              <VBtn value="holiday" size="small">Holidays</VBtn>
            </VBtnToggle>
          </VCard>
        </VMenu>
      </template>

      <template #actions>
        <VBtn
          color="primary"
          variant="tonal"
          rounded="lg"
          height="32"
          prepend-icon="mdi-plus"
          class="list-icon-on-xs"
          aria-label="New Event"
          v-tooltip="'Add event'"
          @click="openAddModal"
        >
          <span class="d-none d-sm-inline">New Event</span>
        </VBtn>
      </template>

      <!-- Events grouped by month; rows select their event on the calendar -->
      <GroupedTable
        v-if="monthGroups.length > 0"
        :columns="columns"
        :groups="monthGroups"
        :row-key="(row) => row.id"
        :row-class="rowClass"
        @row-click="(row) => emit('selectEvent', row.id)"
      >
        <template #group="{ group }">
          <span class="font-weight-medium">{{ monthLabel(group.key) }}</span>
          <span class="event-month-count">{{ group.rows.length }}</span>
        </template>

        <!-- Type avatar: holiday image vs custom icon -->
        <template #cell.type="{ row }">
          <VAvatar size="28" variant="tonal">
            <VImg v-if="row.event.type === 'holiday'" :src="holidayImg" alt="Holiday" />
            <VIcon v-else icon="mdi-account-outline" size="16" class="text-disabled" />
          </VAvatar>
        </template>

        <!-- Title + optional muted description line -->
        <template #cell.title="{ row }">
          <div>{{ row.event.title }}</div>
          <div v-if="row.event.description" class="text-caption text-medium-emphasis">
            {{ row.event.description }}
          </div>
          <!-- Phones drop the When column, so the date rides under the title -->
          <div v-if="!smAndUp" class="text-caption text-medium-emphasis">
            {{ formatEventDate(row.next ? atOccurrence(row.event, row.next) : row.event) }}
          </div>
        </template>

        <!-- Next occurrence (or first date once the series ended) + repeat summary -->
        <template #cell.when="{ row }">
          <span class="text-no-wrap">{{
            formatEventDate(row.next ? atOccurrence(row.event, row.next) : row.event)
          }}</span>
          <div v-if="row.event.repeat" class="text-caption text-medium-emphasis">
            <VIcon icon="mdi-repeat" size="x-small" class="mr-1" />{{
              describeRepeat(eventDays(row.event), row.event.repeat)
            }}
          </div>
        </template>

        <!-- Skip next / edit / delete — custom events only -->
        <template #actions="{ row }">
          <template v-if="row.event.type === 'custom'">
            <!-- Tooltip wraps the button: VIconBtn's default slot would replace its icon -->
            <VTooltip v-if="row.event.repeat && row.next" :text="`Skip ${occurrenceLabel(row.event, row.next)}`">
              <template #activator="{ props }">
                <VIconBtn
                  v-bind="props"
                  icon="mdi-calendar-remove-outline"
                  size="28"
                  icon-size="16"
                  rounded="lg"
                  variant="text"
                  :aria-label="`Skip ${occurrenceLabel(row.event, row.next)}`"
                  @click="skipNextOccurrence(row.event, row.next)"
                />
              </template>
            </VTooltip>
            <VIconBtn
              icon="mdi-pencil-outline"
              aria-label="Edit event"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="'Edit'"
              @click="openEditModal(row.event)"
            />
            <VIconBtn
              icon="mdi-trash-can-outline"
              aria-label="Delete event"
              size="28"
              icon-size="16"
              rounded="lg"
              variant="text"
              v-tooltip="'Delete'"
              @click="deleteEvent(row.event)"
            />
          </template>
        </template>
      </GroupedTable>

      <!-- Empty state -->
      <div v-else class="list-empty">
        <VIcon icon="mdi-calendar-blank-outline" />
        <div>{{ emptyMessage }}</div>
      </div>
    </ListPanel>

    <!-- Add / Edit Modal -->
    <VDialog v-model="isModalOpen" max-width="520" persistent scrollable>
      <EventForm :item="editingEvent" @save-event="onSaveEvent" @cancel-modify-event="onCancelModifyEvent" />
    </VDialog>
  </VCard>
</template>

<style scoped>
.event-month-count {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}

.event-filter__label {
  white-space: nowrap;
}

/* Phones: the funnel + chevron alone, the search field keeps the room */
@media (max-width: 599px) {
  .event-filter__label {
    display: none;
  }
}

/* Rows select their event on the calendar */
:deep(.event-row) {
  cursor: pointer;
}

/* Same green as the calendar's selected day */
:deep(.event-row--active) td {
  background: rgba(var(--v-theme-primary), 0.16) !important;
}
</style>
