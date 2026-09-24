<script setup lang="ts">
import type { Note } from '@/interfaces/Note';

import dayjs from 'dayjs';

// previewHtml must already be sanitized (NotesPanel runs sanitizeNoteHtml once per notes change)
defineProps<{ note: Note; previewHtml: string }>();
</script>

<template>
  <!-- Ripple off: the card grows into the editor on click, a ripple on top of that reads as noise -->
  <VCard
    :data-note-id="note.id"
    :color="note.color ? `note-${note.color}` : undefined"
    :ripple="false"
    class="note-card"
  >
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized by sanitizeNoteHtml -->
    <div class="note-content note-preview" :class="{ 'note-preview--pinned': note.pinned }" inert v-html="previewHtml" />
    <VIcon v-if="note.pinned" icon="mdi-pin" size="14" class="note-pin text-medium-emphasis" />
    <span class="note-caption text-caption text-medium-emphasis">
      {{ dayjs(note.updatedAt).format('MMM D, HH:mm') }}
    </span>
  </VCard>
</template>

<style scoped>
/* min/max instead of height: HomeView's mobile rule forces `height: auto !important` on every panel .v-card */
.note-card {
  position: relative;
  min-height: 150px;
  max-height: 150px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  /* No `transform` here: the touch drag clone is moved by an inline transform on every pointer move */
  transition:
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

/* Drag states — classes applied by @formkit/drag-and-drop (see NotesPanel dragConfig) */
.note-card--dragging {
  opacity: 0.35;
}

/* Touch long-press feedback before the drag starts. A shadow, not a scale: the library measures the
   held card to size its drag clone, so a transform here would make the clone too big and offset. */
.note-card--held {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2) !important;
}

/* Touch drag clone that follows the finger. !important: the library copies computed styles (incl. a
   flat box-shadow) inline onto the clone. */
.note-card--lifted {
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28) !important;
}

.note-preview {
  position: absolute;
  inset: 0;
  padding: 12px;
  padding-bottom: 28px;
  overflow: hidden;
  pointer-events: none;
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
}

/* Keep text clear of the pin icon */
.note-preview--pinned {
  padding-right: 26px;
}

.note-pin {
  position: absolute;
  top: 8px;
  right: 8px;
}

.note-caption {
  position: absolute;
  left: 12px;
  bottom: 8px;
}
</style>
