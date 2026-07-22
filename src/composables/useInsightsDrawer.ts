import { computed, ref } from 'vue';

import { useDisplay } from 'vuetify';

// Module-level singleton so App.vue (the toggle) and HomeView (the drawer)
// share one open/close state without lifting Home's data up.
const isOpen = ref(false);

// Below this viewport width the Insights panel moves from an inline column into
// the toggleable drawer, so the LogList (with its tables) gets the freed space.
export const INSIGHTS_INLINE_MIN = 1440;

export function useInsightsDrawer() {
  const { width } = useDisplay();
  const isInline = computed(() => width.value >= INSIGHTS_INLINE_MIN);
  return { isOpen, isInline };
}
