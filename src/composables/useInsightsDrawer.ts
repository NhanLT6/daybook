import { computed, ref } from 'vue';

import { useDisplay } from 'vuetify';

import { useStorage } from '@vueuse/core';

import { storageKeys } from '@/common/storageKeys';

// Module-level singletons so App.vue (the toggle) and HomeView (the panel)
// share one open/close state without lifting Home's data up.
const isOpen = ref(false);
// Wide screens: the inline column can be hidden too. Remembered per device, shown by default
const inlineVisible = useStorage(storageKeys.settings.insightsVisible, true);

// Below this viewport width the Insights panel moves from an inline column into
// the toggleable drawer, so the LogList (with its tables) gets the freed space.
export const INSIGHTS_INLINE_MIN = 1440;

export function useInsightsDrawer() {
  const { width } = useDisplay();
  const isInline = computed(() => width.value >= INSIGHTS_INLINE_MIN);
  const showInline = computed(() => isInline.value && inlineVisible.value);
  // Whether Insights is on screen right now, for the toggle's active state
  const isShown = computed(() => (isInline.value ? inlineVisible.value : isOpen.value));

  // One toggle for both layouts: hides the column on wide screens, opens the drawer on narrow ones
  const toggle = () => {
    if (isInline.value) inlineVisible.value = !inlineVisible.value;
    else isOpen.value = !isOpen.value;
  };

  return { isOpen, isInline, showInline, isShown, toggle };
}
