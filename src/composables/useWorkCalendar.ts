import { computed } from 'vue';

import type { WorkCalendar } from '@/interfaces/Event';

import dayjs from 'dayjs';

import { useEvents } from '@/composables/useEvents';
import { useSettingsStore } from '@/stores/settings';

/**
 * The user's work calendar: Settings weekend days plus every day covered by a holiday event. Feeds
 * work-day repeat rules ("the last work day of the month") and workday counts in Insights.
 */
export function useWorkCalendar() {
  const settingsStore = useSettingsStore();
  const { events } = useEvents();

  return computed<WorkCalendar>(() => {
    const holidays = new Set<string>();
    for (const event of events.value) {
      if (event.type !== 'holiday') continue;
      const start = dayjs(event.date);
      const end = dayjs(event.endDate ?? event.date);
      // An invalid date never compares as after, which would loop forever
      if (!start.isValid() || !end.isValid()) continue;
      for (let day = start; !day.isAfter(end); day = day.add(1, 'day')) {
        holidays.add(day.format('YYYY-MM-DD'));
      }
    }
    return { weekendDays: settingsStore.weekendDays, holidays };
  });
}
