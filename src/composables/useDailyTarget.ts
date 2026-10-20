import { computed } from 'vue';

import { useWorkCalendar } from '@/composables/useWorkCalendar';

import dayjs from 'dayjs';

import { isoDateFormat } from '@/common/DateFormat';
import { isWorkday } from '@/common/eventRecurrence';
import { useSettingsStore } from '@/stores/settings';

/** Target minutes from the raw settings; null means no limit. Pure so non-component code (Catch-up) can use it. */
export const dailyTargetMinutes = (enabled: boolean, hours: number | null | undefined): number | null =>
  enabled && hours && hours > 0 ? Math.round(hours * 60) : null;

/**
 * The single source for "how long should a day be". Every place that compares logged time against a full day
 * (Remaining chip, month chart, LogList day colours, Catch-up effort, AI "rest of the day") reads it from here.
 * Off days (`isOffDay`) have no Remaining to fill and flag logged time in amber.
 */
export function useDailyTarget() {
  const settingsStore = useSettingsStore();
  const workCalendar = useWorkCalendar();

  /** Target for a workday in minutes; null when the user turned the target off (no limit). */
  const targetMinutes = computed(() =>
    dailyTargetMinutes(settingsStore.dailyTargetEnabled, settingsStore.dailyTargetHours),
  );

  /**
   * Weekend (Settings) or day-off holiday. Off days have no Remaining to fill; time logged on one (side work like
   * studying on a Saturday) is flagged in amber (chart outline, LogList colour), never red.
   */
  const isOffDay = (date: string): boolean => !isWorkday(dayjs(date, isoDateFormat), workCalendar.value);

  return { targetMinutes, isOffDay };
}
