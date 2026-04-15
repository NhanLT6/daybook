import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', () => {
  // Controls the AI chat panel drawer on small screens.
  // On large screens the drawer ignores this and stays open permanently.
  const aiChatOpen = ref(false)

  return { aiChatOpen }
})
