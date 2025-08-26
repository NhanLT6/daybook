import { computed } from 'vue';
import dayjs, { type Dayjs } from 'dayjs';
import { useSettingsStore } from '@/stores/settings';

/**
 * Composable for consistent date display formatting
 * This handles display only - import/export formats remain unchanged
 */
export function useDateDisplay() {
  const settingsStore = useSettingsStore();

  /**
   * Format a date for display using user's preferred format
   */
  const formatDateForDisplay = (date: string | Date | Dayjs, inputFormat?: string): string => {
    let dayjsDate: Dayjs;
    
    if (inputFormat && typeof date === 'string') {
      dayjsDate = dayjs(date, inputFormat);
    } else {
      dayjsDate = dayjs(date);
    }
    
    return dayjsDate.format(settingsStore.dateDisplayFormat);
  };

  /**
   * Format a date string from internal format to display format
   */
  const formatInternalDateForDisplay = (dateString: string): string => {
    // Internal dates are stored in MM/DD/YYYY format
    return formatDateForDisplay(dateString, 'MM/DD/YYYY');
  };

  /**
   * Get the current date display format
   */
  const dateDisplayFormat = computed(() => settingsStore.dateDisplayFormat);

  /**
   * Get the first day of the week setting
   */
  const firstDayOfWeek = computed(() => settingsStore.firstDayOfWeek);

  return {
    formatDateForDisplay,
    formatInternalDateForDisplay,
    dateDisplayFormat,
    firstDayOfWeek,
  };
}