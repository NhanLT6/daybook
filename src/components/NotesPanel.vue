<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';

import { useNotes } from '@/composables/useNotes';

import type { Note } from '@/interfaces/Note';

import dayjs from 'dayjs';

import { sanitizeNoteHtml } from '@/common/sanitizeNoteHtml';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { debounce } from 'lodash';
import { nanoid } from 'nanoid';

// Tiptap (~120 kB gzip) stays out of the Home chunk; it is fetched once the Notes tab is first opened.
const loadNoteEditor = () => import('./NoteEditor.vue');
const NoteEditor = defineAsyncComponent(loadNoteEditor);
onMounted(loadNoteEditor);

const { notes, saveNote, removeNote, reorder, nextTopOrder } = useNotes();
const notificationCenter = useNotificationCenterStore();

const panelEl = ref<HTMLElement | null>(null);
const editing = ref<Note | null>(null);
const editorEmpty = ref(false);

// Sanitized once per notes change rather than re-running DOMPurify on every render.
const sanitizedPreviews = computed(() => new Map(notes.value.map((n) => [n.id, sanitizeNoteHtml(n.content)])));

// What the editor grows out of (clicked card or + button) and which note's card it shrinks back into.
let originEl: HTMLElement | null = null;
let closingId: string | null = null;

const openNote = (note: Note, e: MouseEvent) => {
  originEl = e.currentTarget as HTMLElement;
  editing.value = { ...note };
  editorEmpty.value = false;
};

const addNote = (e: MouseEvent) => {
  originEl = e.currentTarget as HTMLElement;
  const now = Date.now();
  // Not persisted yet — only saved once the user actually types something (see persist()).
  editing.value = { id: nanoid(), content: '', order: nextTopOrder(), createdAt: now, updatedAt: now };
  editorEmpty.value = true;
};

const persist = debounce(() => {
  if (!editing.value || editorEmpty.value) return;
  editing.value.updatedAt = Date.now();
  saveNote({ ...editing.value });
}, 400);

const onEditorUpdate = (html: string, isEmpty: boolean) => {
  if (!editing.value) return;
  editing.value.content = html;
  editorEmpty.value = isEmpty;
  persist();
};

const closeEditor = () => {
  persist.flush();
  if (editing.value && editorEmpty.value && notes.value.some((n) => n.id === editing.value!.id)) {
    removeNote(editing.value.id);
  }
  closingId = editing.value && !editorEmpty.value ? editing.value.id : null;
  editing.value = null;
};

const deleteWithUndo = async (note: Note) => {
  await removeNote(note.id);
  const id = notificationCenter.success('Note deleted', {
    expandOnEnqueue: true, // actions only render in the expanded island
    actions: [{ id: 'undo', label: 'Undo', tone: 'primary', closeOnComplete: true, onClick: () => saveNote(note) }],
  });
  // Store forces actionable notifications persistent by design; auto-close the undo offer ourselves.
  setTimeout(() => notificationCenter.dismiss(id), 6000);
};

const deleteFromEditor = () => {
  persist.cancel();
  if (!editing.value) return;
  closingId = null;
  if (editorEmpty.value) {
    if (notes.value.some((n) => n.id === editing.value!.id)) removeNote(editing.value.id);
    editing.value = null;
    return;
  }
  const note = { ...editing.value };
  editing.value = null;
  deleteWithUndo(note);
};

// Route/tab change while the editor holds unsaved debounced changes.
onBeforeUnmount(() => persist.flush());

// ── Editor open/close animation ─────────────────────────────────────────────
// Same curve as the notification island's pill → panel expand (NotificationIsland.vue).
const EXPAND_EASING = 'cubic-bezier(0.4, 1.02, 0.5, 1)';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Clip the full-size overlay down to `el`'s box. Animating clip-path (not width/height) lays the
// editor out once at its final size, so text never reflows mid-animation.
const clipTo = (el: HTMLElement) => {
  const p = panelEl.value!.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const radius = getComputedStyle(el).borderTopLeftRadius;
  return `inset(${r.top - p.top}px ${p.right - r.right}px ${p.bottom - r.bottom}px ${r.left - p.left}px round ${radius})`;
};

// Overlay children: the padded editor card, and inside it the NoteEditor root.
const editorCardOf = (overlay: Element) => overlay.firstElementChild as HTMLElement;

const onOverlayEnter = (el: Element, done: () => void) => {
  if (!originEl?.isConnected || prefersReducedMotion()) return done();
  (el as HTMLElement).animate(
    [
      { clipPath: clipTo(originEl), opacity: 0 },
      { opacity: 1, offset: 0.25 },
      { clipPath: clipTo(editorCardOf(el)), opacity: 1 },
    ],
    { duration: 280, easing: EXPAND_EASING },
  ).onfinish = () => done();
};

const onOverlayLeave = (el: Element, done: () => void) => {
  const card = closingId ? gridEl.value?.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(closingId)}"]`) : null;
  closingId = null;
  if (prefersReducedMotion()) return done();
  const editorCard = editorCardOf(el);
  // Tiptap clears its content on unmount, so fade the editor out first rather than let the body
  // vanish while the header lingers — what shrinks is a blank card shape.
  (editorCard.firstElementChild as HTMLElement | null)?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 100,
    fill: 'forwards',
  });
  // Shrink back into the note's card, then fade so the card underneath takes over; deleted or
  // discarded notes have no card left, so those just fade.
  const frames = card
    ? [
        { clipPath: clipTo(editorCard), opacity: 1 },
        { clipPath: clipTo(card), opacity: 1, offset: 0.75 },
        { clipPath: clipTo(card), opacity: 0 },
      ]
    : [{ opacity: 1 }, { opacity: 0 }];
  (el as HTMLElement).animate(frames, {
    duration: card ? 260 : 180,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    fill: 'forwards',
  }).onfinish = () => done();
};

// ── Drag & drop ─────────────────────────────────────────────────────────────
// draftIds is the live order while dragging: committed on drop, discarded on cancel.
const gridEl = ref<HTMLElement | null>(null);
const dragId = ref<string | null>(null);
const draftIds = ref<string[] | null>(null);
const trashHover = ref(false);

const displayNotes = computed(() => {
  if (!draftIds.value) return notes.value;
  const byId = new Map(notes.value.map((n) => [n.id, n]));
  return draftIds.value.map((id) => byId.get(id)).filter((n): n is Note => !!n);
});

const resetDrag = () => {
  dragId.value = null;
  draftIds.value = null;
  trashHover.value = false;
};

const onDragStart = (e: DragEvent, id: string) => {
  dragId.value = id;
  draftIds.value = notes.value.map((n) => n.id);
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id); // Firefox won't start a drag without data
  }
};

// Target slot comes from the grid's static layout, not from hit-testing cards: cards glide for
// 0.5s after every move, and a gliding card passing under the cursor would swap the order back.
const onDragOverGrid = (e: DragEvent) => {
  const ids = draftIds.value;
  const grid = gridEl.value;
  if (!dragId.value || !ids || !grid) return;
  const style = getComputedStyle(grid);
  const cols = style.gridTemplateColumns.split(' ').length;
  const cell = grid.firstElementChild as HTMLElement; // every card has the same fixed size
  const rect = grid.getBoundingClientRect();
  const col = Math.floor((e.clientX - rect.left) / (cell.offsetWidth + parseFloat(style.columnGap)));
  const row = Math.floor((e.clientY - rect.top) / (cell.offsetHeight + parseFloat(style.rowGap)));
  const slot = Math.max(0, row) * cols + Math.min(cols - 1, Math.max(0, col));
  const to = Math.min(ids.length - 1, slot);
  const from = ids.indexOf(dragId.value);
  if (to === from) return;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, dragId.value);
  draftIds.value = next;
};

const onDropGrid = async () => {
  const ids = draftIds.value;
  dragId.value = null;
  trashHover.value = false;
  // Keep the draft on screen until the new order is stored, so cards don't flash back.
  if (ids && ids.some((id, i) => id !== notes.value[i]?.id)) await reorder(ids);
  draftIds.value = null;
};

const onDropTrash = () => {
  const note = notes.value.find((n) => n.id === dragId.value);
  resetDrag();
  if (note) deleteWithUndo({ ...note });
};

// Drop handlers clear dragId themselves; still set here means Esc or a drop outside → revert.
const onDragEnd = () => {
  if (dragId.value) resetDrag();
};
</script>

<template>
  <div ref="panelEl" class="notes-panel">
    <!-- Toolbar + grid. While a note is open they fade out and go inert, so nothing shows through the
         editor card's gutter or is reachable by Tab behind it. -->
    <div class="notes-body" :class="{ 'notes-body--behind': !!editing }" :inert="!!editing">
      <!-- Toolbar: note count left, actions right -->
      <VToolbar density="compact" class="notes-toolbar">
        <span v-if="notes.length" class="text-caption text-medium-emphasis">
          {{ notes.length }} {{ notes.length === 1 ? 'note' : 'notes' }}
        </span>
        <VSpacer />
        <VIconBtn
          icon="mdi-plus"
          icon-size="small"
          rounded="lg"
          variant="flat"
          aria-label="New note"
          v-tooltip="'New note'"
          @click="addNote"
        />
      </VToolbar>

      <!-- Scrollable card grid -->
      <div class="notes-scroll">
        <!-- Empty state: same block as LogList's "No data" -->
        <VFadeTransition leave-absolute>
          <VCard v-if="!notes.length" class="notes-empty">
            <div class="d-flex flex-column ga-2 py-4 align-center bg-container rounded text-disabled">
              <VIcon icon="mdi-note-text-outline" class="text-disabled" />
              <div class="text-subtitle-1 text-disabled">No notes yet</div>
            </div>
          </VCard>
        </VFadeTransition>

        <div ref="gridEl" class="notes-grid" @dragover.prevent="onDragOverGrid" @drop.prevent="onDropGrid">
          <VScaleTransition group leave-absolute>
            <VCard
              v-for="note in displayNotes"
              :key="note.id"
              :data-note-id="note.id"
              draggable="true"
              class="note-card"
              :class="{ 'note-card--dragging': note.id === dragId }"
              @click="openNote(note, $event)"
              @dragstart="onDragStart($event, note.id)"
              @dragend="onDragEnd"
            >
              <!-- eslint-disable-next-line vue/no-v-html -- sanitized by sanitizeNoteHtml -->
              <div class="note-content note-preview" inert v-html="sanitizedPreviews.get(note.id)" />
              <span class="note-caption text-caption text-medium-emphasis">
                {{ dayjs(note.updatedAt).format('MMM D, HH:mm') }}
              </span>
            </VCard>
          </VScaleTransition>
        </div>
      </div>
    </div>

    <!-- Trash drop zone: slides up only while a note is dragged; overlays the grid, no layout shift -->
    <VSlideYReverseTransition>
      <div v-if="dragId" class="notes-trash-zone">
        <div
          class="notes-trash"
          :class="{ 'notes-trash--hover': trashHover }"
          aria-label="Drop here to delete"
          @dragover.prevent="trashHover = true"
          @dragleave="trashHover = false"
          @drop.prevent="onDropTrash"
        >
          <VIcon icon="mdi-delete-outline" size="28" />
        </div>
      </div>
    </VSlideYReverseTransition>

    <!-- Editor: a padded card over the whole tab; grows out of the clicked card / + button and
         shrinks back into the note's card -->
    <Transition :css="false" @enter="onOverlayEnter" @leave="onOverlayLeave">
      <div v-if="editing" class="notes-editor-overlay">
        <div class="notes-editor-card bg-surface rounded-lg">
          <NoteEditor
            :key="editing.id"
            :content="editing.content"
            :updated-at="editing.updatedAt"
            @update="onEditorUpdate"
            @back="closeEditor"
            @delete="deleteFromEditor"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notes-panel {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.notes-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  transition: opacity 0.2s ease;
}

.notes-body--behind {
  opacity: 0;
}

.notes-toolbar {
  flex: 0 0 auto;
}

/* Line toolbar content up with the grid's 12px gutter */
.notes-toolbar :deep(.v-toolbar__content) {
  padding-inline: 12px;
}

.notes-scroll {
  position: relative; /* leave-absolute positions the fading empty state against this */
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  position: relative; /* leave-absolute positions leaving cards against this */
  align-content: start;
}

/* min/max instead of height: HomeView's mobile rule forces `height: auto !important` on every panel .v-card */
.note-card {
  position: relative;
  min-height: 150px;
  max-height: 150px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
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

.note-caption {
  position: absolute;
  left: 12px;
  bottom: 8px;
}

.note-card--dragging {
  opacity: 0.35;
}

/* Full-width wrapper centers the circle; Vuetify's slide transition owns `transform` on this element */
.notes-trash-zone {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16px;
  z-index: 1;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.notes-trash {
  pointer-events: auto;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-error));
  background: rgb(var(--v-theme-surface));
  border: 2px solid rgba(var(--v-theme-error), 0.5);
  transition:
    transform 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

/* Icon must not be a dragleave target, or hover flickers as the cursor crosses it */
.notes-trash .v-icon {
  pointer-events: none;
}

.notes-trash--hover {
  transform: scale(1.15);
  color: rgb(var(--v-theme-on-error));
  background: rgb(var(--v-theme-error));
  border-color: transparent;
}

/* Transparent: the gutter around the editor card shows the panel's own glass */
.notes-editor-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
}

/* Looks like the app's nested cards (bg-surface rounded-lg) but is a plain div: HomeView's mobile rule forces
   `height: auto !important` on every panel .v-card. Same 12px gutter as the grid. */
.notes-editor-card {
  position: absolute;
  inset: 12px;
  overflow: hidden;
}

/* Editor content settles in while the card expands — mirrors NotificationIsland's island-pop */
.notes-editor-card > * {
  animation: note-editor-pop 0.2s cubic-bezier(0.32, 1, 0.5, 1) 0.06s both;
}

@keyframes note-editor-pop {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.985);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .notes-editor-card > * {
    animation: none;
  }
}
</style>

<!-- Unscoped: shared by card previews above and NoteEditor's EditorContent, both render `.note-content`. -->
<style>
.note-content p {
  margin: 0 0 4px;
}

.note-content ul,
.note-content ol {
  margin: 0 0 4px;
  padding-left: 20px;
}

.note-content ul[data-type='taskList'] {
  list-style: none;
  padding-left: 0;
}

.note-content ul[data-type='taskList'] li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.note-content ul[data-type='taskList'] li > label {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.note-content input[type='checkbox'] {
  accent-color: rgb(var(--v-theme-primary));
}

.note-content ul[data-type='taskList'] li[data-checked='true'] > div {
  text-decoration: line-through;
  opacity: 0.6;
}

.note-content .ProseMirror {
  outline: none;
}

.note-content p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity));
}
</style>
