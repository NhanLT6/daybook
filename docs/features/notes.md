# Sticky Notes Feature

## Overview

A lightweight, Windows-Sticky-Notes-style scratchpad next to the Chat tab: day-to-day work memory for
things like reminders about the ticket in progress, questions to raise in daily standup, or whether a
workaround is still needed. Notes render as flat cards in a grid (not a list) under a toolbar (note count
left, search + `+` right); pinned notes sort first in the same grid. With no notes, the toolbar is hidden and
an empty-state card fills the tab like the Chat panel, with a "New note" button (the note editor grows out of
it). Clicking a card expands it to fill the whole Notes tab for
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
| `src/components/NoteCard.vue` | UI only — one card: color, sanitized preview (`previewHtml` must already be sanitized), pin icon, drag-state classes. Ripple is off (the card grows into the editor; a ripple on top reads as noise). |
| `src/components/NoteEditor.vue` | UI only — the Tiptap instance, toolbar, and pin/color controls (emit `togglePin` / `color`), no persistence. `content` prop is **initial value only**: never watched back into the editor (would reset cursor/selection), so the parent keys the component by note id to force remount when switching notes. Loaded lazily (`defineAsyncComponent`): Tiptap (~120 kB gzip) is kept out of the Home chunk and fetched when NotesPanel mounts, i.e. the first time the Notes tab opens, so the first note still opens instantly. |
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
- `onBeforeUnmount` flushes the debounce for route changes mid-edit (HomeView unmounts). Tab switches don't
  unmount — `VTabsWindowItem` keeps rendered tab content mounted.

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
  preview checkbox is the nth stored taskItem because the sanitizer keeps every taskItem. Keyboard users tick
  in the editor instead.

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
   means no CSS overlay/redress tricks; no `form`/`button`/`iframe`/`svg`/`img` tags are allowed at all.
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
- **"Sucked in" (genie) effect** — `suckIntoTrash(source, from)`: a copy of the note is sliced into ~3px
  horizontal strips (12–80), each strip a `cloneNode` copy clipped to its slice. Strips closest to the bin
  start first (staggered over 170ms, 270ms each — ~440ms total) and each one pinches toward the bin's x while narrowing, then
  accelerates down into it, so the note forms a funnel and pours into the bin rather than flying there as
  one rigid card. Thin strips matter: at 10px the funnel edge showed a visible staircase. Strips overlap by
  1px to hide seams, and an unscoped `.note-suck__strip *` rule disables animations/transitions on the copies
  (the editor's content "pop" would otherwise replay). The bin (z-index 4) sits above the strips (3).
- **Drag to trash**: the copy starts where the card was released (last pointer minus the grab offset from
  `pointerdown`).
- **Delete from editor**: the editor card is copied *before* `editing` is cleared (Tiptap empties its DOM on
  unmount), sucked in the same way, and the overlay itself skips its close animation.
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

- `HomeView.vue`'s mobile layout rule forces `height: auto !important` on every panel `.v-card`. Note cards
  can't rely on a fixed `height`, so `.note-card` uses `min-height`/`max-height` instead to stay a
  consistent size on mobile too.
- `NoteCard` must not transition `transform`: the touch drag clone is a copy of the card moved by an inline
  transform on every pointer move, and a transition makes it trail the finger.
- The library copies computed styles inline onto its touch clone (incl. a flat `box-shadow`), so
  `note-card--lifted` needs `!important`.
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

## Backlog (not built)

- Catch-up/standup reusing `searchNotes` for open (`[ ]`) checklist items.
- Dropped after review (2026-09-24): select-text / right-click AI actions, AI tidy/summarize. Not worth the
  clicks for short reminder notes. Any AI output written into a note must go through the same sanitizer.
