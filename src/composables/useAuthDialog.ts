import { ref } from 'vue';

// Module-level so the dock avatar and the mobile hamburger menu open the same dialog.
// The dialog lives in AuthMenu, which stays mounted; the hamburger menu's content
// unmounts on close, so it can't own the dialog itself.
const isAuthDialogOpen = ref(false);

export function useAuthDialog() {
  const openAuthDialog = () => {
    isAuthDialogOpen.value = true;
  };

  return { isAuthDialogOpen, openAuthDialog };
}
