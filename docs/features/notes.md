# Sticky Notes Feature

## Overview

A lightweight, Windows-Sticky-Notes-style scratchpad next to the Chat tab: day-to-day work memory for
things like reminders about the ticket in progress, questions to raise in daily standup, or whether a
workaround is still needed. Notes render as flat cards in a grid (not a list) under a toolbar (note count
left, `+` right — search will join it later); with no notes, an empty-state block mirrors LogList's
"No data". Clicking a card expands it to fill the whole Notes tab for editing.

## Data Model

```
Note { id, content, order, createdAt, updatedAt }   ← stored in IndexedDB via useCollection('notes')
```

- `content` — raw Tiptap HTML (`editor.getHTML()`). Stored as-is; sanitized only when rendered as a card
  preview (see Security below).
- `order` — ascending; new notes get `(first.order - 1)` so they always appear first, right after the add
  card.
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
| `src/components/NotesPanel.vue` | Owns persistence (autosave/empty-discard), the card grid, drag & drop, and undo. The only place notes are read from/written to the store. |
| `src/components/NoteEditor.vue` | UI only — the Tiptap instance and toolbar, no persistence. `content` prop is **initial value only**: never watched back into the editor (would reset cursor/selection), so the parent keys the component by note id to force remount when switching notes. Loaded lazily (`defineAsyncComponent`): Tiptap (~120 kB gzip) is kept out of the Home chunk and fetched when NotesPanel mounts, i.e. the first time the Notes tab opens, so the first note still opens instantly. |
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
4. Hard rules: never `v-html` note content without `sanitizeNoteHtml`; never assign note HTML to
   `innerHTML` anywhere else; notification text uses interpolation only.

Covered by `src/common/__tests__/sanitizeNoteHtml.test.ts` (unit, payload-by-payload) and the
`sanitizes malicious html…` test in `e2e/notes.spec.ts` (writes a payload straight into the `notes` object
store, reloads, and asserts no `<img>`/`<script>`/`href`, and no attacker-controlled global got set).

## Drag & Drop Design

Reorder and delete-by-drag use native HTML5 DnD (`draggable="true"` on `.note-card`) — no drag library, zero
extra deps, and it reuses the same Vuetify `*-transition-move` animation system as everything else.
Trade-off: no drag gesture on touch devices; deleting from a phone still works via the editor's delete
button, and touch reorder is v2.

- **Target slot comes from the grid's static layout** (cursor position ÷ cell size, read from the first
  card's box — all cards share one fixed size), not from hit-testing which card element is currently under
  the cursor. Cards glide into
  their new slot over ~0.5s after every reorder step, so a gliding card passing under the cursor would swap
  the order back if the target were hit-tested instead.
- The live reorder is a **draft**: `draftIds` holds the in-progress order and drives the card list while
  dragging. On drop, the draft stays on screen until `reorder(ids)` is awaited and stored — otherwise cards
  would flash back to the old order for a moment before the store round-trip completes.
- Ending the drag without a drop (Esc, or releasing outside the grid) reverts: `dragend` still sees `dragId`
  set (drop handlers already clear it on success), so it resets the draft instead of persisting anything.
- The **trash zone** (`.notes-trash`, `VSlideYReverseTransition` gated on `v-if="dragId"`) slides up from
  the bottom only while a drag is active and overlays the grid absolutely, so it never causes layout shift.
  Dropping on it calls the same `deleteWithUndo` used by the editor's delete button.

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

`deleteWithUndo(note)` is shared by the editor's delete button and the trash drop zone: it removes the note,
then raises an actionable "Note deleted" notification with an Undo action that re-inserts the exact same
note object (same `order`, so it snaps back into its old grid slot). The notification store intentionally
makes actionable notifications persistent by design (asserted in `notificationCenter.test.ts`), so rather
than changing that store behavior, the notes code dismisses its own toast with `setTimeout(..., 6000)`.

## Gotchas

- `HomeView.vue`'s mobile layout rule forces `height: auto !important` on every panel `.v-card`. Note cards
  can't rely on a fixed `height`, so `.note-card` uses `min-height`/`max-height` instead to stay a
  consistent size on mobile too.
- `NoteEditor`'s toolbar buttons bind `@mousedown.prevent`. Without it the clicked button takes and keeps
  focus: the command applies, but the next keystrokes don't reach the editor (observed: text typed after
  clicking Checklist landed outside the list).

## v2 Backlog (not built)

- AI: note → time logs (send note text to the Chat tab, reuse `extractLogs`); AI tidy/summarize note (new
  `/api` endpoint); notes as context for Catch-up/standup (`api/standup.ts`); Chat answering questions from
  saved notes.
- Note colors, search, touch drag on phones (SortableJS), toggling checklist items directly from the card
  preview, pin.
