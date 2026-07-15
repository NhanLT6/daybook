import { ref } from 'vue';

// Module-level singleton so App.vue (the toggle) and HomeView (the drawer)
// share one open/close state without lifting Home's data up.
const isOpen = ref(false);

export function useInsightsDrawer() {
  return { isOpen };
}
