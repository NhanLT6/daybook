<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { Toaster } from 'vue-sonner';

import type { Holiday } from '@/apis/holidayApi';

import { useStorage } from '@vueuse/core';

import { fetchVnHolidays } from '@/apis/holidayApi';
import { storageKeys } from '@/common/storageKeys';

// Initialize holidays for current year
const holidays = useStorage<Holiday[]>(storageKeys.holidays, []);

// Fetch holidays if not already cached for the current year
onMounted(async () => {
  if (holidays.value.length === 0) {
    try {
      holidays.value = await fetchVnHolidays();
    } catch (error) {
      console.warn('Failed to fetch holidays:', error);
      holidays.value = [];
    }
  }
});

// const route = useRoute();
//
// const items = [
//   { text: 'Home', to: '/' },
//   { text: 'Task', to: '/task' },
//   { text: 'Setting', to: '/setting' },
// ];
</script>

<template>
  <VApp>
    <VAppBar>
      <VAppBarTitle>Daybook</VAppBarTitle>

      <!-- <VBtn-->
      <!--   v-for="(item, i) in items"-->
      <!--   :key="i"-->
      <!--   :active="item.to === route.path"-->
      <!--   class="me-2 text-none"-->
      <!--   v-bind="item"-->
      <!--   :to="item.to"-->
      <!-- />-->
    </VAppBar>

    <VMain>
      <div class="pa-4">
        <Toaster position="bottom-center" rich-colors close-button />
        <RouterView />
      </div>
    </VMain>
  </VApp>
</template>

<style>
:root {
  /* Your variables */
  --header-height: 80px;

  /* Add the top padding and place it below the header */
  --nv-root-top: var(--header-height);
}
</style>
