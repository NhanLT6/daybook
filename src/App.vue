<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import { Toaster } from 'vue-sonner';

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
      <VAppBarTitle>Xero logger</VAppBarTitle>

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
