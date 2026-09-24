# Sticky Notes — v1 Plan

> **Status (2026-09-24):** Shipped (bb88e0c, 5cfb64e); see `docs/features/notes.md`. Only the AI items of the v2 backlog remain.

## Context

User wants a lightweight notes feature (Windows Sticky Notes / OneNote feel) next to the Chat tab.
Purpose: day-to-day work memory — reminders about the ticket in progress, questions to raise in daily
meeting, whether a question got resolved or needs a workaround, anything to remember.

Hard UX requirements from user:
- Notes shown as **cards**, not a list. "New" is a `variant="plain"` card with a centered plus icon.
- **Drag & drop**: reorder notes; while dragging, a **trash can appears at the bottom** — drop on it to delete.
- **Rich text**, simple.
- Clicking a note **expands it to fill the whole Notes tab** (not a dialog, not inline).
- **Animations must be smooth**: no sudden on/off elements, no layout shift. Reuse Vuetify built-ins.
- **HTML safety**: stored HTML must never become an XSS vector.

## Scope

**v1 (this plan)** — core only, per user ("prioritize core first"). Build order = priority; drag & drop is last:
1. Notes tab, card grid, add card, full-tab editor with autosave, empty note auto-discarded on close
2. Tiptap editor: bold, italic, strike, bullet list, **checklist** (tick = resolved, rendered struck-through)
3. Delete (editor button) with **Undo** (notification island)
4. **Last:** native HTML5 drag & drop — live reorder + trash drop zone

**v2 backlog (do NOT build now)**:
- AI: note → time logs (send note text to Chat tab, reuse `extractLogs`); AI tidy/summarize note (new
  `/api` endpoint); notes as context for Catch-up/standup (`api/standup.ts`); Chat answers questions
  from saved notes (send notes text in chat request body + system prompt section). Plain text can be
  derived from stored HTML at send time (`DOMParser` → `textContent`) — no extra field needed now.
  Any AI output written into a note must go through the same sanitizer as below.
- Note colors, search, touch drag on phones (SortableJS), toggling checklist items from the card, pin.

## Key decisions (and why)

| Decision | Why |
|---|---|
| 3rd tab `Notes` after `Chat` in left panel (`HomeView.vue`) | "next to chat tab"; no new layout column |
| Local IndexedDB collection `notes` via existing `useCollection` | Same pattern as `events`; auto-included in JSON backup; no server work |
| Tiptap v3 | Standard Vue 3 rich-text editor; checklist + placeholder are official extensions. CLAUDE.md: prefer libraries over custom |
| Store HTML (`editor.getHTML()`), render card preview via strict `sanitizeNoteHtml()` (DOMPurify) | `dompurify` already a dependency; Tiptap re-parses HTML through its schema on edit |
| **Native HTML5 DnD** (no library) | Zero deps; one animation system (Vue `TransitionGroup` FLIP via Vuetify transitions). Trade-off: no drag on phones — delete available via editor button; reorder on touch is v2 |
| Vuetify transitions: `VScaleTransition group leave-absolute` (cards), `VSlideYReverseTransition` (trash), `VFadeTransition` (editor overlay) | Vuetify 3.11.6 ships `*-transition-move` classes → smooth reorder + gap closing on delete. `leave-absolute` keeps leaving card's size/position so neighbors glide instead of jump |
| Editor = absolute overlay inside NotesPanel (grid stays mounted underneath) | Grid scroll position preserved; overlay never shifts layout |
| Undo toast dismissed by our own `setTimeout` | Store intentionally forces actionable notifications persistent (asserted in `notificationCenter.test.ts:81`) — don't change store |

## Security (HTML)

Untrusted HTML can enter a note via: pasted clipboard HTML, a crafted backup JSON imported by the user,
and (v2) AI output. Controls:
1. **Editor path**: Tiptap parses HTML with an inert `DOMParser` document (no script run, no resource load)
   and keeps only schema-known nodes/marks/attrs. StarterKit's Link extension validates protocols by default
   (`javascript:` rejected). Do not disable that validation; do not add extensions that allow raw HTML/iframes.
2. **Preview path** (card `v-html`): only via `sanitizeNoteHtml()` in `src/common/sanitizeNoteHtml.ts`:
   ```ts
   import DOMPurify from 'dompurify';
   // Allowlist = exactly what our Tiptap config emits. No style/class/on* attrs.
   const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 's', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li',
     'label', 'input', 'span', 'div', 'a', 'h1', 'h2', 'h3', 'hr'];
   const ALLOWED_ATTR = ['href', 'type', 'checked', 'data-type', 'data-checked'];
   export function sanitizeNoteHtml(html: string): string {
     return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
   }
   ```
   DOMPurify's default URI allowlist strips `javascript:` / `vbscript:` / `data:` hrefs. No `style` attr →
   no CSS overlay/redress tricks. No `form`/`button`/`iframe`/`svg`/`img` tags.
3. Preview content has `pointer-events: none` → links/checkboxes on cards are inert.
4. Rules: never `v-html` note content without `sanitizeNoteHtml`; never assign note HTML to `innerHTML`
   anywhere else; notification text uses interpolation only (already the case).
5. Unit tests with XSS payloads (see step 4).

## Data model

`src/interfaces/Note.ts`
```ts
export interface Note {
  id: string;
  content: string; // Tiptap HTML
  order: number; // ascending; new notes get (first.order - 1) so they appear first
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}
```

## Steps

### 1. Dependencies
```bash
yarn add @tiptap/vue-3 @tiptap/pm @tiptap/starter-kit @tiptap/extension-list @tiptap/extensions
```
Imports (v3): `useEditor, EditorContent` from `@tiptap/vue-3`; `StarterKit` default from `@tiptap/starter-kit`;
`TaskList, TaskItem` from `@tiptap/extension-list`; `Placeholder` from `@tiptap/extensions`.

### 2. Data layer
- `src/db/types.ts`: add `'notes'` to `COLLECTION_NAMES`. Change `DbSnapshot.collections` to
  `Partial<Record<CollectionName, IdRecord[]>>` — old backups genuinely lack `notes`; both adapters'
  `restore` already do `s.collections[c] ?? []`.
- `src/db/adapters/indexedDbAdapter.ts:5`: `DB_VERSION = 2`. **Required** — existing users' DB is at v1
  and `upgrade()` only runs on version bump; without it every `notes` read throws `NotFoundError`.
- `src/db/repository.ts`: add `notes: Collection<Note>` to `Repository` + `createRepository`.
- `src/composables/useBackup.ts` `isSnapshot`: core collections must be arrays; collections added later
  (`notes`) may be missing. E.g. `const ADDED_LATER = new Set<CollectionName>(['notes'])` →
  `every((c) => Array.isArray(cols[c]) || (ADDED_LATER.has(c) && cols[c] === undefined))`.
  Note: restoring an old backup clears notes (restore = full replace). Expected.
→ verify: `yarn test:unit` — existing `useBackup.test.ts` (snapshot without `notes`) must still pass;
  it is the regression test for old backups. `adapterContract.ts` literal compiles thanks to `Partial`.

### 3. `src/composables/useNotes.ts` (mirror `useEvents.ts`)
```ts
export function useNotes() {
  const c = useCollection<Note>('notes');
  const notes = computed(() => [...c.items.value].sort((a, b) => a.order - b.order));
  return {
    notes,
    ready: c.ready,
    saveNote: (n: Note) => c.upsert(n),
    removeNote: (id: string) => c.remove(id),
    // Persist a new display order: order = index.
    reorder: (ids: string[]) => {
      const byId = new Map(c.items.value.map((n) => [n.id, n]));
      return c.addMany(ids.map((id, order) => ({ ...byId.get(id)!, order })));
    },
    nextTopOrder: () => (notes.value[0]?.order ?? 0) - 1,
  };
}
```
Tests `src/composables/__tests__/useNotes.test.ts` (setup like `useCollection.test.ts`: clear localStorage,
`initDb()`, clear `notes`): sorted by order; `nextTopOrder` puts new note first; `reorder` persists;
`removeNote` then `saveNote(snapshot)` restores.

### 4. `src/common/sanitizeNoteHtml.ts` + tests
Code as in Security §2. Tests `src/common/__tests__/sanitizeNoteHtml.test.ts`:
- Keeps Tiptap output intact: paragraph with bold/italic/strike, bullet list, task list
  (`<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked><span></span></label><div><p>x</p></div></li></ul>`),
  link with `https:` href.
- Strips: `<script>`, `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe>`, `<a href="javascript:…">` (href removed),
  `onclick=` on allowed tags, `style="position:fixed…"`, `<form>`/`<button>`, unknown `data-*` attrs.

### 5. `src/components/NoteEditor.vue` (UI only, no persistence)
- Props: `content: string` (**initial value only** — never watch it back into the editor, would reset cursor),
  `updatedAt?: number`. Parent keys the component by note id.
- Emits: `update: [html: string, isEmpty: boolean]` (from Tiptap `onUpdate`), `back`, `delete`.
- `useEditor({ content, autofocus: 'end', extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }),
  Placeholder.configure({ placeholder: 'Ticket reminder, question for daily…' })], onUpdate })`.
- Layout: header row (back `mdi-arrow-left` | spacer | updated-at caption | delete `mdi-delete-outline`),
  toolbar row (bold/italic/strike/bullet list/checklist: `mdi-format-bold`, `mdi-format-italic`,
  `mdi-format-strikethrough`, `mdi-format-list-bulleted`, `mdi-format-list-checks`; active state via
  `editor.isActive(...)` → `color="primary"`), then `EditorContent` (class `note-content`) filling the rest
  with its own scroll.
- `Escape` → emit `back`.

### 6. `src/components/NotesPanel.vue` — grid, editor overlay, persistence, undo (NO drag & drop yet)
**Layout** — root `.notes-panel`: `position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column`.
Inside: scroll container (`flex: 1; overflow-y: auto`) holding the grid; editor overlay (and later the trash
zone) are absolute children of the root so they stay pinned while the grid scrolls.
- Grid `.notes-grid`: `display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px;
  position: relative /* for leave-absolute */; align-content: start`. 2 columns in the 450px panel.
- First cell: add card — `VCard variant="plain" border="dashed"`, centered `mdi-plus`, same fixed height as notes.
- Note cards inside `<VScaleTransition group leave-absolute>` (renders a fragment → children are grid items),
  `:key="note.id"`, `color="container"` (semantic theme color, same as chat bubbles), **fixed height ~150px**,
  preview `div.note-content` with `sanitizeNoteHtml(note.content)` (cache in a `computed` Map keyed by id),
  `pointer-events: none` on preview, bottom fade via `mask-image`, caption `dayjs(updatedAt).format('MMM D, HH:mm')`.
  `v-html` needs `<!-- eslint-disable-next-line vue/no-v-html -- sanitized by sanitizeNoteHtml -->`.
- Click card → open in editor overlay.

**Editor overlay** — `<VFadeTransition>` + `v-if="editing"`, `position: absolute; inset: 0; z-index: 2;
background: rgb(var(--v-theme-surface))`, renders `<NoteEditor :key="editing.id" :content="editing.content" …/>`.

**Persistence**
```
editing: Note | null;  editorEmpty: boolean
open(note)  → editing = { ...note }; editorEmpty = false
add card    → editing = { id: nanoid(), content: '', order: nextTopOrder(), createdAt: now, updatedAt: now }; editorEmpty = true  // not persisted yet
@update(html, isEmpty) → editing.content = html; editorEmpty = isEmpty; persist()
persist = lodash debounce(400ms): if (editing && !editorEmpty) saveNote({ ...editing, updatedAt: Date.now() })
@back   → persist.flush(); if editorEmpty && note exists in store → removeNote(id) silently; editing = null
@delete → persist.cancel(); if editorEmpty → same as back; else deleteWithUndo({ ...editing }); editing = null
onBeforeUnmount → persist.flush()   // route change while editing
```
Tab switches don't unmount (VTabsWindowItem keeps rendered items), so no flush needed there.

**deleteWithUndo(note)** (reused by trash drop in step 10)
```ts
await removeNote(note.id);
const id = notificationCenter.success('Note deleted', {
  expandOnEnqueue: true, // actions only render in the expanded island
  actions: [{ id: 'undo', label: 'Undo', tone: 'primary', closeOnComplete: true, onClick: () => saveNote(note) }],
});
// Store forces actionable notifications persistent by design; auto-close the undo offer ourselves.
setTimeout(() => notificationCenter.dismiss(id), 6000);
```
Undo re-inserts with the same `order` → card scales back into its old slot.

**Shared content CSS** — unscoped `<style>` block in NotesPanel for `.note-content` (used by card preview and
the editor, which renders inside NotesPanel): paragraph/list margins; `ul[data-type="taskList"]` no bullets,
`li` flex row with checkbox label; `li[data-checked="true"] > div` → `text-decoration: line-through; opacity: .6`;
`.ProseMirror { outline: none }`; placeholder `p.is-editor-empty:first-child::before { content: attr(data-placeholder);
float: left; height: 0; pointer-events: none; color: rgba(var(--v-theme-on-surface), var(--v-disabled-opacity)) }`.

### 7. Wire into `src/views/HomeView.vue`
- `tab` type → `'form' | 'ai' | 'notes'`.
- After Chat tab: `<VTab value="notes" prepend-icon="mdi-note-text-outline">Notes</VTab>` and
  `<VTabsWindowItem value="notes"><NotesPanel /></VTabsWindowItem>`.
- Mobile (≤959px): notes needs the bounded-height flex chain the chat uses. Change the card class binding to
  `'form-panel--chat': tab !== 'form'` and add `.form-panel.form-panel--chat :deep(.notes-panel)` to the rule
  list at the bottom of the `<style>` (next to `:deep(.v-card.mobile-chat)`). Touch nothing else.

### 8. E2E `e2e/notes.spec.ts` (follow `e2e/eventsToolbar.spec.ts` setup)
- Create: Notes tab → add card → type "Ask Bob about T-123" → back → card shows text → reload → still there.
- Empty discard: add card → back without typing → no new card.
- Delete + undo: open note → delete button → card gone → click `Undo` in island → card back.

### 9. Docs
- `docs/features/notes.md`: data model, security rules, undo mechanism, DnD flow, v2 backlog (short).
- `CLAUDE.md`: one line in *Key Features* and one in *Feature Documentation*.

### 10. LAST — drag & drop (reorder + trash) in NotesPanel
Note cards get `draggable="true"`; add card is not draggable and not a reorder target.
```
dragId: string | null;  draftIds: string[] | null;  trashHover: boolean
displayNotes = computed(() => draftIds ? draftIds.map(id => byId(id)) : notes)   // single source for v-for

card @dragstart(e, id): dragId = id; draftIds = notes.map(n => n.id)
                        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id) // Firefox needs setData
grid @dragover.prevent(e): slot = row/col of cursor from the grid's static layout (cell = add card size + gap),
                        not from hit-testing cards (they glide 0.5s after each move → a gliding card under the
                        cursor would swap back). to = slot - 1 (slot 0 = add card), clamped; move dragId there.
grid @drop.prevent:     dragId = null; if order changed → await reorder(draftIds); then draftIds = null
                        (draft stays on screen until stored, so cards don't flash back)
trash @dragover.prevent: trashHover = true;  @dragleave: trashHover = false
trash @drop.prevent:    deleteWithUndo(note); reset()
card @dragend:          if (dragId) reset()   // drop handlers clear dragId; still set = Escape / drop outside → revert
reset(): dragId = draftIds = null; trashHover = false
```
- Dragged card gets class `note-card--dragging` (`opacity: .35`) — stays in place as a placeholder, no shift.
- **Trash zone** — `<VSlideYReverseTransition>` + `v-if="dragId"`. Wrapper absolute full-width
  (`left: 0; right: 0; bottom: 16px; display: flex; justify-content: center; pointer-events: none`), inner 56px
  circle `pointer-events: auto`, `color="error"` tonal → flat + `scale(1.15)` (CSS transition) while `trashHover`.
  Don't center with `translateX(-50%)` on the transitioned element — Vuetify's slide transition owns `transform`.
- E2E additions: `card.dragTo(trash)` → gone → Undo → back; create A then B (B first) → drag B onto A → reload → A first.
  If `dragTo` is flaky, dispatch `dragstart/dragover/drop/dragend` with a shared `DataTransfer` via `locator.dispatchEvent`.

## Verification (end-to-end)
1. `yarn type-check` and `yarn lint` clean.
2. `yarn test:unit` green (incl. untouched `useBackup.test.ts`, new sanitizer XSS tests).
3. `yarn test:e2e e2e/notes.spec.ts` green.
4. Browser (dev server), light **and** dark theme:
   - Create/edit → autosave (reload keeps content); checklist toggles + strike-through; placeholder shows when empty.
   - Delete → gap closes smoothly → Undo restores to same slot; undo toast disappears by itself after ~6s.
   - Open note → overlay fades in over grid; back → grid scroll position unchanged.
   - Drag: card dims in place, neighbors glide, trash slides up from bottom, grows on hover, slides away after drop.
   - Mobile width (≤959px): tab has bounded height, grid scrolls, delete via editor button works.
   - Existing user path: with an old v1 IndexedDB (pre-change data) the app loads and Notes works.
   - Import an old backup JSON (no `notes` key) → succeeds. Paste `<img src=x onerror=alert(1)>` HTML → no alert.

## Constraints for the implementer
- Yarn only. Leave all changes **uncommitted** — user commits.
- Surgical: every changed line traces to this plan. No store/notification refactors, no extra features from v2.
