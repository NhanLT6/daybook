import { ref } from 'vue';

// Transient: a new visit always starts with navigation available.
const gardenFocus = ref(false);
export const useGardenFocus = () => ({ gardenFocus });
