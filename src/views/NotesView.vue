<script setup lang="ts">
import NotesPanel from '@/components/NotesPanel.vue';
</script>

<template>
  <!-- Notes page: one glass card, the shared list toolbar and card grid span its full width like Tasks -->
  <div class="page-fill">
    <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
      <NotesPanel />
    </VCard>
  </div>
</template>
