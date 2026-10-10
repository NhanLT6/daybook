# Sticky Notes Feature

## Overview

A lightweight, Windows-Sticky-Notes-style scratchpad on its own page (`/notes`, header nav link "Notes", `src/views/NotesView.vue` wrapping `NotesPanel`) rather than a Home tab: day-to-day work memory for
things like reminders about the ticket in progress, questions to raise in daily standup, or whether a
workaround is still needed. Notes render as flat cards in a grid (not a list) under a toolbar (note count
left, search + `+` right); pinned notes sort first in the same grid. With no notes, the toolbar is hidden and
an empty-state card fills the page, with a "New note" button (the note editor grows out of
it). Clicking a card expands it to fill the whole Notes page for
editing; clicking a checklist checkbox on a card ticks it in place.

## Data Model

```
Note { id, content, order, createdAt, updatedAt, pinned?, color? }   ← IndexedDB via useCollection('notes')
```

- `content` — raw Tiptap HTML (`editor.getHTML()`). Stored as-is; sanitized only when rendered as a card
  preview (see Security below).
- `order` — ascending; new notes get `(first.order - 1)` so they always appear first. Display order is
  pinned-first (`pinnedFirst()`), each group by `order`. Pin/unpin also takes `nextTopOrder()`: pinning lands
  the note at the very top, unpinning lands it first among the unpinned (right after the pinned ones).
- `pinned`, `color` — optional because notes saved before v2 lack them; no migration needed. `color` is one
  of `NOTE_COLORS` (`src/interfaces/Note.ts`), each mapped to a `note-<color>` theme color in `main.ts`
  with separate light (pastel) and dark (muted) values. Unset = default surface.
- Images are **not** in `content`: it holds `<img data-image-id width height>` only, the bytes live in a
  separate database (see Images below).
- `notes` is a new IndexedDB object store. `indexedDbAdapter.ts` bumps `DB_VERSION` 1 → 2 — required
  because `upgrade()` only runs on a version bump; without it, existing users' DBs stay at v1 and any read
  from `notes` throws `NotFoundError`.
- `DbSnapshot.collections` is `Partial<Record<CollectionName, IdRecord[]>>`. `useBackup.ts`'s `isSnapshot`
  treats `notes` as `ADDED_LATER`, so a backup JSON from before this feature (which genuinely lacks a
  `notes` key) still validates and imports — it just restores zero notes. Restoring any old backup clears
  existing notes, same as it does for every other collection (restore = full replace).

## Components

| File | Role |
|---|---|
| `src/components/NotesPanel.vue` | Owns persistence (autosave/empty-discard), pinned-first order, search, drag & drop, trash, tick-from-card, and undo. The only place notes are read from/written to the store. |
| `src/components/NoteCard.vue` | UI only — one card: color, sanitized preview (`previewHtml` must already be sanitized), pin icon, drag-state classes. Ripple is off (the card grows into the editor; a ripple on top reads as noise). The preview box ends 30px above the card bottom, above the date caption, and fades over its last 36px, so long notes never run under the date. |
| `src/components/NoteEditor.vue` | UI only — the Tiptap instance, toolbar, and pin/color controls (emit `togglePin` / `color`), no note persistence (it does store pasted image blobs, see Images). `content` prop is **initial value only**: never watched back into the editor (would reset cursor/selection), so the parent keys the component by note id to force remount when switching notes. Loaded lazily (`defineAsyncComponent`): Tiptap (~120 kB gzip) is kept out of the main chunk and fetched when NotesPanel mounts, i.e. the first time the Notes page opens, so the first note still opens instantly. |
| `src/components/NoteImageViewer.vue` | Click-to-zoom VDialog for an editor image (Esc / outside click / click the image to close), grows out of the clicked image via `target`. |
| `src/common/noteImageExtension.ts` | Tiptap `Image` extended to store `data-image-id` instead of `src`, with a resizable node view that loads the blob URL. |
| `src/composables/useNoteImages.ts` | Add an image (compress + store), id → object URL cache shared by cards and editor, orphan sweep. |
| `src/common/prepareNoteImage.ts` | Re-encodes pasted images to WebP (max 2560px side) before storing. |
| `src/db/noteImageStore.ts` | The `daybook-images` IndexedDB database: Blob records + `createdAt` index. |
| `src/common/devSampleNotes.ts` | Dev-only random notes (checklists, lists, colors, some pinned) behind the flask button in the Notes toolbar. The button is `v-if="isDev"` (`import.meta.env.DEV`) and the module is dynamically imported, so neither ships in production builds. |
| `src/common/sanitizeNoteHtml.ts` | DOMPurify allowlist used to render card previews via `v-html`. |
| `src/composables/useNotes.ts` | Thin wrapper over `useCollection<Note>('notes')`: sorted list, `saveNote`/`removeNote`/`reorder`/`nextTopOrder`. |

## Autosave / Empty-Discard

- While editing, `NotesPanel` debounces `saveNote` 400ms after each Tiptap `update` event.
- A brand-new note (from the add card) is **not persisted** until it has real content — avoids empty rows
  from a stray click.
- `back` flushes the pending debounced save; if the note ended up empty and exists in the store, it's
  removed silently (no undo).
- `delete` cancels the pending save and runs the delete-with-undo flow (see Undo below) using the editor's
  latest content, so Undo restores what was on screen. An empty note is just discarded.
- `onBeforeUnmount` flushes the debounce for route changes mid-edit (NotesView unmounts when navigating away).

## Search

Toolbar magnify button that expands into a field — same markup, CSS, and collapse/clear handlers as LogList's
search (see `docs/features/log-list-filters.md` for the `@update:focused` / `@click:clear` gotchas). Hidden when
there are no notes.

- Case-insensitive substring match on the note's **visible text**, not its HTML: each note is parsed once per
  notes change with `DOMParser` (inert document, safe on raw note HTML) and `body.textContent` is cached in a
  `computed` Map. Searching "strong" doesn't match every bold note.
- Count shows `N of M notes` while filtering; no match shows a centered "No matching notes" message.
- **Drag is disabled while a query is active** (drag library re-initialized with `disabled`): `reorder(ids)`
  assigns `order = index` over the ids it gets, so reordering a filtered subset would collide with hidden
  notes' orders.
- `+` clears and collapses the search first: a new note starts empty and would otherwise vanish behind the
  query once saved.

## Pin, Colors, Tick From Card

- **Pin** — editor header button; pinned cards show a small pin icon and sort first in the one grid (no
  separate section or labels). Pin/unpin is button-only: a drag never changes it. Dropping a note across the
  pinned/unpinned boundary is allowed during the drag but the committed order is re-partitioned with
  `pinnedFirst()`, so it snaps back into its own group.
- **Colors** — fixed set of 6 (`NOTE_COLORS`) plus default, picked from a swatch menu in the editor header.
  Card uses `VCard :color`, editor card uses the matching `bg-note-*` class, so text color (`on-note-*`)
  comes from Vuetify automatically. Fixed palette over a free picker so every color stays readable in both
  themes.
- **Tick from card** — the preview stays `inert` (see Security), so a card click is matched against the
  bounding boxes of `li[data-type="taskItem"] > label` (4px slop) instead of the event target. A hit toggles
  the nth taskItem in the stored HTML (parsed with `DOMParser`, `data-checked` + the `checked` attr flipped,
  serialized via `body.innerHTML` — a read, not an assignment) and saves; a miss opens the editor. The nth
  preview checkbox is the nth stored taskItem because the sanitizer keeps every taskItem. Only checkboxes you
  can see count: one clipped off the preview or past the middle of its bottom fade isn't a hit (the click
  opens the note). Keyboard users tick in the editor instead.

## Images

Paste (Ctrl+V), drop, or the toolbar image button (the way in on phones) inserts an image into the open note.

- **Storage**: a separate IndexedDB database `daybook-images` (`noteImageStore.ts`), one record per image:
  `{ id, blob, width, height, createdAt }`. The note HTML keeps only `<img data-image-id width height>`.
  - Why not inline base64: every notes reload, search (`DOMParser` over all notes), Chat `searchNotes` and
    Catch-up read whole note contents; a few screenshots would make each of those MBs. Blobs in IndexedDB
    are stored as files by the browser and only read when an image is shown.
  - Why a separate database instead of a store in `daybook`: the main adapter's `snapshot()`/`getAll()`
    load whole stores, and it would need a `DB_VERSION` bump; images don't fit the `useCollection` model.
  - Why not a folder on disk (File System Access API): Chromium-only, not on phones, and the user has to
    re-grant folder permission each session. The quota is the same origin quota either way, roughly: Chrome/Edge
    up to ~60% of the disk, Firefox 10% of the disk (max 10 GB), Safari 17+ ~60%.
- **Compression** (`prepareNoteImage.ts`): PNG/JPEG/BMP/WebP are redrawn on a canvas and encoded as WebP at 0.9,
  longest side capped at 2560px; the original is kept if it's smaller (or the browser can't encode WebP,
  i.e. Safari). GIFs keep their bytes (canvas would drop the animation). Over 20 MB is rejected. A full-screen
  PNG screenshot typically ends up 5–10x smaller.
- **Display**: `noteImageUrl(id)` / `loadNoteImageUrl(id)` turn a stored blob into an object URL once and cache
  it (reactive map), so card previews re-render when it loads. The editor's node view sets `src` itself;
  `width`/`height` attrs + `height: auto` reserve the right box before the blob loads. A missing blob (e.g.
  an old backup restored without images) shows a dashed "Image not found" box.
- **Insertion** moves the cursor into the text after the image (Tiptap leaves the inserted image node-selected,
  so the next keystroke would replace it).
- **Resize**: hover an image in the editor → drag a bottom corner handle (always shown on touch screens).
  Aspect ratio is locked. `width`/`height` attrs then hold the dragged size (pasted = natural size), so
  card previews follow it, capped to the card width. Uses Tiptap's `ResizableNodeView` (`@tiptap/core`)
  directly: Image's own `resize` option can't be enabled because its node view loads `src`, ours loads the
  blob by id. Two differences from Image's version: the commit doesn't leave the image node-selected (the
  next keystroke would replace it), and a `touchend` → synthetic `mouseup` bridge, because
  ResizableNodeView only ends a resize on `mouseup`, so a touch resize would never commit. The editor CSS
  forces `height: auto !important` on images: the view writes an inline px height, which would squash an
  image whose width is clamped by `max-width: 100%`.
  `@tiptap/core` is pinned to the exact version `@tiptap/starter-kit` pins: a caret range resolves a newer
  core and yarn installs two copies.
- **Zoom**: clicking an image in the editor opens `NoteImageViewer` (`editorProps.handleClickOn`, returns true
  so the click doesn't select the node; Backspace/Delete next to it still removes it). Not on cards: a card
  thumbnail can fill most of the card, and clicking the card must still open the note.
- **Cleanup**: removing an image from a note (or deleting the note) doesn't delete the blob — editor undo
  and the delete-undo toast need it back. `sweepOrphanNoteImages` runs when NotesPanel mounts and deletes
  images no note references that are older than 24h (also covers a note that isn't saved yet, other tabs).
- **Backup**: `useBackup` exports images as base64 under a top-level `noteImages` key (outside `collections`)
  and imports them back (added, not replaced; unreferenced ones get swept). Malformed entries are skipped.
  Backups grow with images (~1.33x their stored size).

## Security Rules

Untrusted HTML can enter a note via pasted clipboard HTML or a crafted backup JSON someone imports (AI
output is v2, but must follow the same rules when it lands). Four controls:

1. **Editor path** — Tiptap parses HTML through an inert `DOMParser` document (no script execution, no
   resource loads) and keeps only schema-known nodes/marks/attrs. StarterKit's Link extension validates
   protocols by default (`javascript:` rejected). Never disable that validation or add extensions that allow
   raw HTML/iframes.
2. **Preview path** — the card grid only ever renders note HTML via `v-html` after passing it through
   `sanitizeNoteHtml()`, an allowlist of exactly what the Tiptap config emits (no `style`/`class`/`on*`
   attrs). DOMPurify's default URI allowlist strips `javascript:`/`vbscript:`/`data:` hrefs; no `style` attr
   means no CSS overlay/redress tricks; no `form`/`button`/`iframe`/`svg` tags are allowed at all. `img` is
   allowed without `src`: one lacking a well-formed `data-image-id` is removed, and `src` is only ever set
   afterwards from our own `blob:` object URL. So note HTML can't load a remote URL (tracking pixel) or a
   `data:` payload. The editor side matches: `NoteImage` only parses `img[data-image-id]`, so pasted web HTML
   with `<img src>` loses its images.
3. Card previews are `inert` with `pointer-events: none` — any surviving link or checkbox is unclickable.
   Tick-from-card deliberately does **not** relax this (it hit-tests positions instead).
4. Hard rules: never `v-html` note content without `sanitizeNoteHtml`; never assign note HTML to
   `innerHTML` anywhere else (reading `innerHTML` off a `DOMParser` document to serialize is fine);
   notification text uses interpolation only. The trash animation copies a card with `cloneNode`, never by
   re-parsing HTML.

Covered by `src/common/__tests__/sanitizeNoteHtml.test.ts` (unit, payload-by-payload) and the
`sanitizes malicious html…` test in `e2e/notes.spec.ts` (writes a payload straight into the `notes` object
store, reloads, and asserts no `<img>`/`<script>`/`href`, and no attacker-controlled global got set).

## Drag & Drop Design

Uses **`@formkit/drag-and-drop`** (`dragAndDrop` from `@formkit/drag-and-drop/vue`) on the single card grid.
Chosen because it's data-first: it only writes the values array and Vue renders the reorder, so it doesn't
fight Vue's patching (SortableJS moves DOM nodes itself), and Vuetify's `VScaleTransition group` `*-move`
classes still animate the glide. ~4 KB gzip.

- **One codebase for desktop + phone.** Internally the library uses native HTML5 DnD for a desktop mouse
  (`handleRootPointermove` bails out for `pointerType === 'mouse'` on non-mobile platforms, so
  `nativeDrag: false` would *disable* mouse drag — don't set it) and its own pointer-driven clone for touch.
  Our side is a single config and a single start/end path.
- **Touch** needs a 300ms long-press (`longPress`), so a normal swipe still scrolls the list. Long-press
  feedback is a shadow (`note-card--held`), **not a transform**: the library measures the held card to size
  its clone, so a scale would make the clone too big and offset.
- **Values are a writable computed** (`displayNotes`): get = stored pinned-first order, or the in-progress
  `draftIds` while dragging; set = the library writing the live order into `draftIds`. On `onDragend` the
  draft is re-partitioned pinned-first, committed with `reorder(ids)`, and stays on screen until stored (no
  flash back).
- **Drag start**: `onDragstart` only fires on the native (mouse) path, so we subscribe to the parent's
  `dragStarted` event (`parents.get(el).on(...)`), which fires for both.
- **Leaving cards** (delete transition, `leave-absolute`) are excluded via `draggable()` — they're still in
  the DOM but no longer in the values, and the library requires the counts to match.
- The grid is always rendered (never `v-if`'d): the library attaches to the element once.
- **Pointer tracking** for the trash: native drag only reports the pointer via `dragover`, touch via
  `pointermove`/`touchmove`; a capture listener on `document` records the last point for both while dragging.
- Verified in the embedded browser with synthetic DragEvents and `pointerType: 'touch'` PointerEvents (the
  pane's own mouse drag can't start a native drag). Holding the cursor still over a slot while cards glide
  produced one move and no flip-flop. Real-finger touch still needs a check on an actual phone.

## Trash & Delete Animation

- `.notes-trash` is a frosted round bin (blurred surface, soft shadow) with a custom inline SVG whose lid is a
  separate `<g>` hinged on its left end. Shown (`VSlideYReverseTransition`) while dragging or while
  `trashHold` is set; the lid opens on hover (`trashHover`) and while something falls in (`trashEating`).
- **"Crumple and toss" effect** — `crumpleIntoTrash(source, from)`: one `cloneNode` copy of the note is
  animated as a single piece. Over the first ~40% its `clip-path` polygon (18 points spaced along the edge)
  morphs through a wrinkled midpoint into a lumpy ball, while the copy shrinks to 0.7 and twists and a few
  random straight crease lines plus a soft ball shading fade in (`.note-crumple__creases`). The rest is the
  toss: a parabola sampled into keyframes carries the ball to the bin, spinning and shrinking so it ends about
  half the bin's width whatever the note's size (card or whole editor). ~980ms. A `drop-shadow` filter on the
  wrapper (clip-path would clip a `box-shadow`) keeps a white note visible on a white card. An unscoped
  `.note-crumple *` rule stops the copy replaying its own entry animations (the editor's content "pop"). The
  bin (z-index 4) sits above the copy (3), so the ball drops *into* it.
- **Why not the old genie**: it sliced the note into up to 80 ~3px strips, each animated with a small stagger.
  At real frame rates the strips' staggered edges read as horizontal folds/bands, which no shading could fix
  (tried: accordion folds, pleats, random creases in both directions). Three one-piece alternatives were
  prototyped side by side (crumple and toss, fold in half and drop, shrink and drop); crumple and toss won.
- **Drag to trash**: the copy starts where the card was released (last pointer minus the grab offset from
  `pointerdown`).
- **Delete from editor**: the editor card is copied *before* `editing` is cleared (Tiptap empties its DOM on
  unmount), crumpled and tossed the same way, and the overlay itself skips its close animation.
- `swallow()` then closes the lid with a squash-bounce and lets the bin slide away. The bin's target point is
  computed (`TRASH_SIZE`/`TRASH_BOTTOM`, kept in sync with CSS) rather than measured, because the bin may
  still be mid slide-in when an animation aims at it.
- Respects `prefers-reduced-motion` (no fly/shrink/bounce, just delete).

## Open/Close Animation

The editor is a padded card (12px gutter, same as the grid) over the whole tab. It grows out of whatever
was clicked (a card, or the toolbar `+`) and shrinks back into the note's card on close — the same feel as
the notification island opening from pill to panel. While it's open, the toolbar + grid behind it fade to
`opacity: 0` and go `inert`, so nothing (e.g. the `+` button) shows through the gutter or is Tab-reachable.

- Uses the island's curve (`cubic-bezier(0.4, 1.02, 0.5, 1)`) and a copy of its content pop
  (`translateY(5px) scale(0.985)` → rest).
- Animates `clip-path: inset(... round r)` on a full-size overlay via Web Animations in the
  `<Transition :css="false">` hooks, not width/height: the editor is laid out once at its final size, so text
  never reflows mid-animation.
- Close fades the editor content out first (Tiptap clears its DOM on unmount, which would otherwise leave
  the header floating over an empty body), then shrinks a blank card shape into the note's card and fades.
  Deleted/discarded notes have no card to return to, so the overlay just fades.
- Respects `prefers-reduced-motion`.

## Undo Mechanism

`deleteWithUndo(note)` is shared by the editor's delete button and the trash drop zone (the animation runs
alongside, independent of the store write): it removes the note,
then raises an actionable "Note deleted" notification with an Undo action that re-inserts the exact same
note object (same `order`, so it snaps back into its old grid slot). The notification store intentionally
makes actionable notifications persistent by design (asserted in `notificationCenter.test.ts`), so rather
than changing that store behavior, the notes code dismisses its own toast with `setTimeout(..., 6000)`.

## Gotchas

- Note cards don't rely on a fixed `height` (Home's old mobile rule forced `height: auto !important` on
  panel cards; it went with the Notes tab), so `.note-card` uses `min-height`/`max-height` instead to stay a
  consistent size on mobile too.
- `NoteCard` must not transition `transform`: the touch drag clone is a copy of the card moved by an inline
  transform on every pointer move, and a transition makes it trail the finger.
- The library copies computed styles inline onto its touch clone (incl. a flat `box-shadow`), so
  `note-card--lifted` needs `!important`.
- `NoteImageViewer` (VDialog) only takes focus after its open transition, so opening blurs the editor (keys
  would otherwise still edit the note) and `NoteEditor`'s Esc handler ignores Esc while the viewer is open
  (otherwise one Esc closes the viewer *and* the note). An Esc in the first ~50ms after opening is ignored by
  Vuetify (its overlay stack updates on a `setTimeout`); e2e tests wait for the dialog to take focus first.
- `NoteEditor`'s toolbar buttons bind `@mousedown.prevent`. Without it the clicked button takes and keeps
  focus: the command applies, but the next keystrokes don't reach the editor (observed: text typed after
  clicking Checklist landed outside the list).

## Chat reads notes (`searchNotes` tool)

Chat answers questions from notes through a tool, not by sending every note with every message.
- The tool is declared in `api/chat.ts` without `execute`: notes live only in the browser's IndexedDB, so the
  server can't read them. `useAiChat`'s `onToolCall` runs `searchNotes()` (`src/common/searchNotes.ts`) and
  `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` sends the result back for the answer.
  The request body (projects, tasks, date) lives on the transport so that follow-up request carries it too.
- Notes are messy shorthand, so the search stays dumb on purpose: the query only ranks notes (match count,
  then pinned, then most recent), and non-matching notes still fill the ~12k-char budget. The model matches
  by meaning. Checklist lines become `[ ]` / `[x]` so it can tell open questions from resolved ones.
- `extractLogs` never gets an output, so a turn that extracts logs never auto-resubmits.
- Covered by `src/common/__tests__/searchNotes.test.ts` and `e2e/chatSearchNotes.spec.ts` (mocked stream).

## Catch-up includes open note items

Every Catch-up sends `openNoteItems()` (`src/common/searchNotes.ts`) to `/api/standup`: unticked checklist
items and unticked lines ending in "?", pinned notes first, capped at 20. The model tidies them into
`noteLines`, shown as a "From your notes" group after Did / Todo. Only the open part is sent, so it is small
enough to include every time. The summary cache key includes these items (`summaryKey`), so ticking an item
regenerates the Catch-up. Covered by `src/composables/__tests__/catchUpNotes.test.ts`.

## Backlog (not built)

- Dropped after review (2026-09-24): select-text / right-click AI actions, AI tidy/summarize. Not worth the
  clicks for short reminder notes. Any AI output written into a note must go through the same sanitizer.
