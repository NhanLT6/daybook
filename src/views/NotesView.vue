<script setup lang="ts">
import NotesPanel from '@/components/NotesPanel.vue';
</script>

<template>
  <!-- Notes page: one glass card, notes centred at a readable width like Tasks and Events -->
  <div class="page-fill">
    <VCard class="glass-acrylic d-flex flex-column overflow-hidden">
      <VContainer class="page-inner notes-inner">
        <NotesPanel />
      </VContainer>
    </VCard>
  </div>
</template>

<style scoped>
.notes-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
</style>
