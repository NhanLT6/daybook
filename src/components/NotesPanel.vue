<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import NoteCard from '@/components/NoteCard.vue';

import { useNotes } from '@/composables/useNotes';

import type { Note, NoteColor } from '@/interfaces/Note';

import { sanitizeNoteHtml } from '@/common/sanitizeNoteHtml';
import { useNotificationCenterStore } from '@/stores/notificationCenter';
import { type DragState, parents, tearDown } from '@formkit/drag-and-drop';
import { dragAndDrop } from '@formkit/drag-and-drop/vue';
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

// ── Search ──────────────────────────────────────────────────────────────────
// Matches visible text only, so searching "strong" doesn't hit every bold note's markup.
// DOMParser documents are inert (no script run, no resource load), so raw note HTML is safe here.
const parser = new DOMParser();
const plainTexts = computed(
  () =>
    new Map(
      notes.value.map((n) => [n.id, (parser.parseFromString(n.content, 'text/html').body.textContent ?? '').toLowerCase()]),
    ),
);

const searchText = ref('');
const searchQuery = computed(() => searchText.value.trim().toLowerCase());
const filteredNotes = computed(() =>
  searchQuery.value ? notes.value.filter((n) => plainTexts.value.get(n.id)?.includes(searchQuery.value)) : notes.value,
);

// Toolbar search: collapsed to a magnify button, expands to a field on demand (same as LogList)
const searchExpanded = ref(false);
const searchFieldRef = ref<{ focus: () => void } | null>(null);

const toggleSearch = async () => {
  // Toggling closed also clears the query so no hidden filter lingers
  if (searchExpanded.value) {
    searchExpanded.value = false;
    searchText.value = '';
    return;
  }
  searchExpanded.value = true;
  await nextTick();
  searchFieldRef.value?.focus();
};

// Collapse when focus leaves an empty field — an active query stays visible
const onSearchFocusChange = (focused: boolean) => {
  if (!focused && !searchText.value.trim()) searchExpanded.value = false;
};

// ── Card order: pinned notes first, then the rest, each by stored `order` ───
const pinnedFirst = (list: Note[]) => [...list.filter((n) => n.pinned), ...list.filter((n) => !n.pinned)];
const orderedNotes = computed(() => pinnedFirst(filteredNotes.value));

// Live order while dragging (written by the drag library), committed on dragend.
const draftIds = ref<string[] | null>(null);

// Writable so the drag library can set the in-progress order; reads fall back to the stored order.
const displayNotes = computed<Note[]>({
  get: () => {
    if (!draftIds.value) return orderedNotes.value;
    const byId = new Map(notes.value.map((n) => [n.id, n]));
    return draftIds.value.map((id) => byId.get(id)).filter((n): n is Note => !!n);
  },
  set: (values) => {
    draftIds.value = values.map((n) => n.id);
  },
});

// ── Editor open/close ───────────────────────────────────────────────────────
// What the editor grows out of (clicked card or + button) and which note's card it shrinks back into.
let originEl: HTMLElement | null = null;
let closingId: string | null = null;
// Deleted from the editor: a copy is sucked into the trash, so the overlay itself skips its close animation.
let closingToTrash = false;

const openNote = (note: Note, el: HTMLElement) => {
  originEl = el;
  editing.value = { ...note };
  editorEmpty.value = false;
};

const addNote = (e: MouseEvent) => {
  // A new note starts empty and would be hidden by an active query once saved
  searchText.value = '';
  searchExpanded.value = false;
  originEl = e.currentTarget as HTMLElement;
  const now = Date.now();
  // Not persisted yet — only saved once the user actually types something (see persist()).
  editing.value = { id: nanoid(), content: '', order: nextTopOrder(), createdAt: now, updatedAt: now };
  editorEmpty.value = true;
};

// Checklist items can be ticked straight from the card. The preview stays `inert` (links never become
// clickable), so the click is matched against checkbox positions instead of the event target.
const onCardClick = (note: Note, e: MouseEvent) => {
  const card = e.currentTarget as HTMLElement;
  const SLOP = 4;
  const labels = [...card.querySelectorAll<HTMLElement>('li[data-type="taskItem"] > label')];
  const hit = labels.findIndex((l) => {
    const r = l.getBoundingClientRect();
    return (
      e.clientX >= r.left - SLOP &&
      e.clientX <= r.right + SLOP &&
      e.clientY >= r.top - SLOP &&
      e.clientY <= r.bottom + SLOP
    );
  });
  if (hit >= 0) toggleTask(note, hit);
  else openNote(note, card);
};

// The sanitizer keeps every taskItem, so the nth preview checkbox is the nth taskItem in the stored HTML.
const toggleTask = (note: Note, index: number) => {
  const doc = parser.parseFromString(note.content, 'text/html');
  const item = doc.querySelectorAll('li[data-type="taskItem"]')[index];
  if (!item) return;
  const checked = item.getAttribute('data-checked') !== 'true';
  item.setAttribute('data-checked', String(checked));
  item.querySelector(':scope > label > input')?.toggleAttribute('checked', checked);
  saveNote({ ...note, content: doc.body.innerHTML, updatedAt: Date.now() });
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

// Pinning moves the note to the top; unpinning puts it first among the unpinned (right after the pinned).
const togglePin = () => {
  if (!editing.value) return;
  editing.value.pinned = !editing.value.pinned;
  editing.value.order = nextTopOrder();
  persist();
};

const setColor = (color: NoteColor | undefined) => {
  if (!editing.value) return;
  editing.value.color = color;
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
  // Snapshot the editor card before it unmounts (Tiptap clears its DOM), then suck the copy into the trash.
  const editorCard = panelEl.value?.querySelector<HTMLElement>('.notes-editor-card');
  if (editorCard && !prefersReducedMotion()) {
    const p = panelEl.value!.getBoundingClientRect();
    const r = editorCard.getBoundingClientRect();
    swallow(suckIntoTrash(editorCard, { left: r.left - p.left, top: r.top - p.top }));
  } else {
    swallow(Promise.resolve());
  }
  closingToTrash = true;
  editing.value = null;
  deleteWithUndo(note);
};

// Dev-only: fill the grid with random notes for trying delete/drag. The ternary on `import.meta.env.DEV`
// is constant-folded in production builds, dropping the function and its dynamic import (no sample chunk).
const isDev = import.meta.env.DEV;
const addSampleNotes = import.meta.env.DEV
  ? async () => {
      const { createSampleNotes } = await import('@/common/devSampleNotes');
      for (const n of createSampleNotes(20, nextTopOrder())) await saveNote(n);
    }
  : undefined;

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
  const card = closingId ? panelEl.value?.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(closingId)}"]`) : null;
  const toTrash = closingToTrash;
  closingId = null;
  closingToTrash = false;
  // Deleted: the sucked-in copy already covers the editor, so the overlay just goes.
  if (toTrash || prefersReducedMotion()) return done();
  const editorCard = editorCardOf(el);
  // Tiptap clears its content on unmount, so fade the editor out first rather than let the body
  // vanish while the header lingers — what shrinks is a blank card shape.
  (editorCard.firstElementChild as HTMLElement | null)?.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 100,
    fill: 'forwards',
  });
  // Shrink back into the note's card, then fade so the card underneath takes over; discarded notes
  // have no card left, so those just fade.
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

// ── Trash ───────────────────────────────────────────────────────────────────
// Keep in sync with .notes-trash-zone `bottom` and .notes-trash size.
const TRASH_SIZE = 64;
const TRASH_BOTTOM = 16;
const trashEl = ref<HTMLElement | null>(null);
const trashHover = ref(false);
// Keeps the trash on screen after the drag ended, until the swallow animation finishes.
const trashHold = ref(false);
const trashEating = ref(false);
const lidOpen = computed(() => trashHover.value || trashEating.value);

// Final resting center (panel coordinates) — computed, not measured, because the trash may still be
// mid slide-in transition when an animation targets it.
const trashCenter = () => {
  const p = panelEl.value!;
  return { x: p.clientWidth / 2, y: p.clientHeight - TRASH_BOTTOM - TRASH_SIZE / 2 };
};

// Lid stays open while something falls in, then closes with a small squash, then the trash slides away.
const swallow = async (falling: Promise<unknown>) => {
  trashHold.value = true;
  trashEating.value = true;
  await falling.catch(() => {});
  trashEating.value = false;
  if (!prefersReducedMotion()) {
    await trashEl.value
      ?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(0.86, 0.9)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }],
        { duration: 320, easing: 'ease-out' },
      )
      .finished.catch(() => {});
  }
  trashHold.value = false;
};

// "Sucked in" (genie) effect: a copy of `source` is sliced into horizontal strips, each a clipped clone.
// Strips nearest the trash leave first and every strip narrows as it goes, so the note funnels into the
// bin instead of flying there as one rigid card.
const suckIntoTrash = (source: HTMLElement, from: { left: number; top: number }) => {
  const panel = panelEl.value!;
  const w = source.offsetWidth;
  const h = source.offsetHeight;
  // ~3px strips: thick strips give the funnel a visible staircase edge instead of a smooth curve
  const count = Math.min(80, Math.max(12, Math.round(h / 3)));
  const stripH = h / count;
  const t = trashCenter();

  const container = document.createElement('div');
  container.className = 'note-suck';
  Object.assign(container.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${w}px`,
    height: `${h}px`,
  });

  // Order strips by distance to the trash: the closest one starts first.
  const strips = Array.from({ length: count }, (_, i) => {
    const strip = document.createElement('div');
    strip.className = 'note-suck__strip';
    Object.assign(strip.style, { top: `${i * stripH}px`, height: `${stripH + 1}px` }); // +1: no seams
    const copy = source.cloneNode(true) as HTMLElement;
    copy.removeAttribute('data-note-id');
    copy.classList.remove('note-card--dragging');
    Object.assign(copy.style, {
      position: 'absolute',
      left: '0',
      top: `${-i * stripH}px`,
      width: `${w}px`,
      height: `${h}px`,
      margin: '0',
    });
    strip.appendChild(copy);
    container.appendChild(strip);
    const dx = t.x - (from.left + w / 2);
    const dy = t.y - (from.top + i * stripH + stripH / 2);
    return { strip, dx, dy, dist: Math.abs(dy) };
  });
  panel.appendChild(container);

  const STAGGER_TOTAL = 170;
  const stagger = STAGGER_TOTAL / (count - 1);
  const byDistance = [...strips].sort((a, b) => a.dist - b.dist);
  const animations = byDistance.map(({ strip, dx, dy }, rank) =>
    strip.animate(
      [
        { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
        // Pinches in toward the bin's x first, then accelerates down into it.
        { transform: `translate(${dx * 0.35}px, ${dy * 0.2}px) scale(0.45, 1)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.04, 0.6)`, opacity: 0.3 },
      ],
      { duration: 270, delay: rank * stagger, easing: 'cubic-bezier(0.5, 0, 0.85, 0.5)', fill: 'forwards' },
    ),
  );
  return Promise.all(animations.map((a) => a.finished)).finally(() => container.remove());
};

// ── Drag & drop (@formkit/drag-and-drop) ────────────────────────────────────
// One config for mouse and touch: the library uses native drag for desktop mouse and its own
// pointer-driven clone for touch (after a long-press, so a normal swipe still scrolls).
const gridEl = ref<HTMLElement | null>(null);
const dragNoteId = ref<string | null>(null);

// Where the pointer grabbed the card, so the trash animation starts exactly where the card was let go.
let grabOffset = { x: 0, y: 0 };
let lastPoint: { x: number; y: number } | null = null;

const onGridPointerDown = (e: PointerEvent) => {
  const card = (e.target as Element).closest<HTMLElement>('.note-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  grabOffset = { x: e.clientX - r.left, y: e.clientY - r.top };
};

const isOverTrash = (pt: { x: number; y: number }) => {
  const r = trashEl.value?.getBoundingClientRect();
  const SLOP = 12;
  return !!r && pt.x >= r.left - SLOP && pt.x <= r.right + SLOP && pt.y >= r.top - SLOP && pt.y <= r.bottom + SLOP;
};

// Native drag only reports the pointer through dragover; touch drag through pointer/touch moves.
const trackPoint = (e: Event) => {
  const p = e instanceof TouchEvent ? e.touches[0] : (e as PointerEvent | DragEvent);
  if (!p) return;
  lastPoint = { x: p.clientX, y: p.clientY };
  trashHover.value = isOverTrash(lastPoint);
};
const TRACK_EVENTS = ['dragover', 'pointermove', 'touchmove'] as const;

const startDrag = (note: Note) => {
  dragNoteId.value = note.id;
  lastPoint = null;
  TRACK_EVENTS.forEach((t) => document.addEventListener(t, trackPoint, { capture: true, passive: true }));
};

const endDrag = async () => {
  TRACK_EVENTS.forEach((t) => document.removeEventListener(t, trackPoint, { capture: true }));
  const id = dragNoteId.value;
  const overTrash = trashHover.value && !!lastPoint;
  dragNoteId.value = null;
  trashHover.value = false;
  const note = notes.value.find((n) => n.id === id);

  if (overTrash && note && lastPoint) {
    draftIds.value = null;
    const card = panelEl.value?.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(note.id)}"]`);
    const p = panelEl.value!.getBoundingClientRect();
    const from = { left: lastPoint.x - grabOffset.x - p.left, top: lastPoint.y - grabOffset.y - p.top };
    swallow(card && !prefersReducedMotion() ? suckIntoTrash(card, from) : Promise.resolve());
    deleteWithUndo({ ...note });
    return;
  }

  if (!draftIds.value) return;
  // Pinned notes always stay first: a drop across the boundary snaps back to its own group.
  const ids = pinnedFirst(displayNotes.value).map((n) => n.id);
  // Keep the draft on screen until the new order is stored, so cards don't flash back.
  draftIds.value = ids;
  if (ids.some((x, i) => x !== orderedNotes.value[i]?.id)) await reorder(ids);
  draftIds.value = null;
};

const dragConfig = () => ({
  // Reordering a filtered subset has no well-defined full order, so drag is off while searching.
  disabled: !!searchQuery.value,
  // Cards mid leave-transition are still in the DOM but no longer in the values.
  draggable: (el: HTMLElement) => !el.classList.contains('scale-transition-leave-active'),
  longPress: true,
  longPressDuration: 300,
  longPressClass: 'note-card--held',
  dragPlaceholderClass: 'note-card--dragging',
  synthDragPlaceholderClass: 'note-card--dragging',
  synthDraggingClass: 'note-card--lifted',
  onDragend: () => endDrag(),
});

const initDrag = () => {
  dragAndDrop<Note>({ parent: gridEl, values: displayNotes, ...dragConfig() });
  // `onDragstart` only fires for native (mouse) drags; the parent's `dragStarted` event fires for touch too.
  parents.get(gridEl.value!)?.on('dragStarted', (s) => startDrag((s as DragState<Note>).draggedNode.data.value));
};
onMounted(initDrag);
watch(() => !!searchQuery.value, initDrag);

onBeforeUnmount(() => {
  TRACK_EVENTS.forEach((t) => document.removeEventListener(t, trackPoint, { capture: true }));
  if (gridEl.value) tearDown(gridEl.value);
});
</script>

<template>
  <div ref="panelEl" class="notes-panel">
    <!-- Toolbar + grid. While a note is open they fade out and go inert, so nothing shows through the
         editor card's gutter or is reachable by Tab behind it. -->
    <div class="notes-body" :class="{ 'notes-body--behind': !!editing }" :inert="!!editing">
      <!-- Toolbar: note count left, actions right -->
      <VToolbar density="compact" class="notes-toolbar">
        <span v-if="notes.length" class="text-caption text-medium-emphasis">
          <template v-if="searchQuery">{{ filteredNotes.length }} of </template>
          {{ notes.length }} {{ notes.length === 1 ? 'note' : 'notes' }}
        </span>
        <VSpacer />
        <div class="d-flex ga-2 align-center">
          <!-- Search: magnify button that expands into a field (button hides while open) -->
          <div v-if="notes.length" class="notes-search" :class="{ 'notes-search--open': searchExpanded }">
            <VIconBtn
              v-if="!searchExpanded"
              icon="mdi-magnify"
              icon-size="small"
              rounded="lg"
              variant="flat"
              aria-label="Search notes"
              v-tooltip="'Search'"
              @click="toggleSearch"
            />
            <div class="notes-search__wrap">
              <VTextField
                ref="searchFieldRef"
                v-model="searchText"
                placeholder="Search"
                prepend-inner-icon="mdi-magnify"
                variant="plain"
                density="compact"
                hide-details
                single-line
                clearable
                class="notes-search__field"
                @click:clear="searchText = ''"
                @update:focused="onSearchFocusChange"
              />
            </div>
          </div>
          <VIconBtn
            v-if="isDev"
            icon="mdi-flask-outline"
            icon-size="small"
            rounded="lg"
            variant="flat"
            aria-label="Add 20 sample notes"
            v-tooltip="'Add 20 sample notes (dev only)'"
            @click="addSampleNotes"
          />
          <VIconBtn
            icon="mdi-plus"
            icon-size="small"
            rounded="lg"
            variant="flat"
            aria-label="New note"
            v-tooltip="'New note'"
            @click="addNote"
          />
        </div>
      </VToolbar>

      <!-- Scrollable card grid (pinned notes first) -->
      <div class="notes-scroll">
        <!-- Empty state: same block as LogList's "No data" -->
        <VFadeTransition leave-absolute>
          <VCard v-if="!filteredNotes.length" class="notes-empty">
            <div class="d-flex flex-column ga-2 py-4 align-center bg-container rounded text-disabled">
              <VIcon :icon="notes.length ? 'mdi-magnify-close' : 'mdi-note-text-outline'" class="text-disabled" />
              <div class="text-subtitle-1 text-disabled">{{ notes.length ? 'No matching notes' : 'No notes yet' }}</div>
            </div>
          </VCard>
        </VFadeTransition>

        <div ref="gridEl" class="notes-grid" @pointerdown.capture="onGridPointerDown">
          <VScaleTransition group leave-absolute>
            <NoteCard
              v-for="note in displayNotes"
              :key="note.id"
              :note="note"
              :preview-html="sanitizedPreviews.get(note.id) ?? ''"
              @click="onCardClick(note, $event)"
            />
          </VScaleTransition>
        </div>
      </div>
    </div>

    <!-- Trash drop zone: slides up while a note is dragged (or deleted from the editor) and overlays the
         grid, so no layout shift. The lid opens on hover and while something falls in. -->
    <VSlideYReverseTransition>
      <div v-if="dragNoteId || trashHold" class="notes-trash-zone">
        <div
          ref="trashEl"
          class="notes-trash"
          :class="{ 'notes-trash--hover': trashHover, 'notes-trash--open': lidOpen }"
          aria-label="Drop here to delete"
          @dragover.prevent
          @drop.prevent
        >
          <svg class="notes-trash__icon" viewBox="0 0 24 24" aria-hidden="true">
            <g class="notes-trash__lid">
              <path d="M3.5 6.5h17" />
              <path d="M9 6.5V4.8c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.7" />
            </g>
            <path d="M5.8 9.5l.9 10c.1 1 .9 1.7 1.9 1.7h6.8c1 0 1.8-.7 1.9-1.7l.9-10" />
            <path d="M10 12.5v5M14 12.5v5" />
          </svg>
        </div>
      </div>
    </VSlideYReverseTransition>

    <!-- Editor: a padded card over the whole tab; grows out of the clicked card / + button and
         shrinks back into the note's card (or into the trash on delete) -->
    <Transition :css="false" @enter="onOverlayEnter" @leave="onOverlayLeave">
      <div v-if="editing" class="notes-editor-overlay">
        <div class="notes-editor-card rounded-lg" :class="editing.color ? `bg-note-${editing.color}` : 'bg-surface'">
          <NoteEditor
            :key="editing.id"
            :content="editing.content"
            :updated-at="editing.updatedAt"
            :pinned="!!editing.pinned"
            :color="editing.color"
            @update="onEditorUpdate"
            @back="closeEditor"
            @delete="deleteFromEditor"
            @toggle-pin="togglePin"
            @color="setColor"
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

/* Toolbar search: magnify button expands into a field (mirrors LogList's .log-search) */
.notes-search {
  display: flex;
  align-items: center;
}

/* Collapsed = width 0; opening animates the wrap open (field is clipped by overflow) */
.notes-search__wrap {
  width: 0;
  overflow: hidden;
  transition: width 0.25s ease;
}

.notes-search--open .notes-search__wrap {
  width: 180px;
}

/* Keep the field's intrinsic width so text doesn't reflow mid-animation */
.notes-search__field {
  min-width: 180px;
}

/* Match the icon buttons' 40px height (compact density otherwise makes it shorter) */
.notes-search__field :deep(.v-field) {
  border-radius: 8px;
  min-height: 40px;
}

.notes-search__field :deep(.v-field__input) {
  min-height: 40px;
  padding-top: 0;
  padding-bottom: 0;
}

.notes-search__field :deep(.v-field__prepend-inner) {
  padding-inline-start: 8px;
}

/* Top padding separates the toolbar from the first row of cards */
.notes-scroll {
  position: relative; /* leave-absolute positions the fading empty state against this */
  flex: 1;
  overflow-y: auto;
  padding: 12px 12px 12px;
}

.notes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px;
  position: relative; /* leave-absolute positions leaving cards against this */
  align-content: start;
}

/* Full-width wrapper centers the circle; Vuetify's slide transition owns `transform` on this element.
   Above the editor overlay (2) and the suck strips (3), so a deleted note disappears *into* the bin. */
.notes-trash-zone {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 16px; /* TRASH_BOTTOM */
  z-index: 4;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

/* Frosted round bin: soft glass + shadow instead of MD's flat outlined circle */
.notes-trash {
  pointer-events: auto;
  width: 64px; /* TRASH_SIZE */
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-error));
  background: rgba(var(--v-theme-surface), 0.82);
  backdrop-filter: blur(12px) saturate(1.4);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.18),
    inset 0 0 0 1px rgba(var(--v-theme-on-surface), 0.08);
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.2s ease,
    color 0.2s ease;
}

.notes-trash--hover {
  transform: scale(1.15);
  color: rgb(var(--v-theme-on-error));
  background: rgb(var(--v-theme-error));
}

.notes-trash__icon {
  width: 30px;
  height: 30px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  overflow: visible;
  pointer-events: none; /* never a dragleave target, or hover flickers as the cursor crosses it */
}

/* Lid hinges on its left end */
.notes-trash__lid {
  transform-box: fill-box;
  transform-origin: 0% 100%;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.notes-trash--open .notes-trash__lid {
  transform: translate(-1px, -2px) rotate(-24deg);
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

<!-- Unscoped: shared by card previews (NoteCard) and NoteEditor's EditorContent, both render `.note-content`;
     plus the trash "suck" strips, which are built in JS and so carry no scoped attribute. -->
<style>
/* Above the editor overlay (2), below the trash (4): strips disappear into the bin */
.note-suck {
  position: absolute;
  z-index: 3;
  pointer-events: none;
}

.note-suck__strip {
  position: absolute;
  left: 0;
  width: 100%;
  overflow: hidden;
  will-change: transform;
}

/* Copies must not replay their own entry animations/transitions (e.g. the editor's content pop) */
.note-suck__strip * {
  animation: none !important;
  transition: none !important;
}

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
