# Remove islands-theme.css — Native Vuetify Layout

**Date:** 2026-04-23
**Approach:** Option A (viewport-fill panels with independent scroll) implemented with native Vuetify utilities + minimal per-view scoped CSS, replacing the global `islands-theme.css`.

## Motivation

`islands-theme.css` (212 lines) overrides Vuetify internals globally, causing fragile layout bugs (e.g. form clipping due to `overflow: hidden` fighting VTabsWindow's `height: inherit`). The visual identity (flat cards on a darker page background, rounded corners) is already encoded in `main.ts` defaults — the file is almost entirely layout machinery, not theming.

## Goal

Delete `islands-theme.css`. Replace with:
1. **6 lines in `main.css`** — VMain height constraint (the only rule that truly must be global).
2. **Per-view scoped CSS** — only what each view needs (~20 lines for HomeView, trivial elsewhere).
3. **Vuetify utility classes** for flex, overflow, gaps, and padding everywhere else.

Identical visual result: floating flat cards on `page-background`, rounded corners, no shadows.

---

## File-by-file changes

### `src/assets/islands-theme.css` — DELETE entirely

The file is removed. All rules fall into one of three buckets:

**Deleted (already covered by `main.ts` defaults):**
- `.v-card { border: none !important }` — covered by `flat: true`
- `.v-card.elevation-0 { box-shadow: none !important }` — covered by `elevation: 0`
- `.v-application { background-color: page-background }` — covered by renaming the theme color (see `main.ts`)

**Moved to `main.css` (visual rules still needed):**
- `.bg-container` — used in TaskView, LogList, EventList
- `.v-card-title.bg-surface` — sticky title background needs `!important` to stay opaque
- `.v-expansion-panel` border/shadow cleanup
- `.v-data-table` styling
- `.v-dialog > .v-overlay__content > .v-card` border-radius rule
- `.v-card .v-toolbar { background: transparent }` — toolbar blends into card
- Smooth transition block for theme changes

**Deleted (dead code / wrong target):**
- `.v-main__wrap` rules — Vuetify 3 does not render a `.v-main__wrap` element; this is a Vuetify 2 leftover with no effect.
- `.page-container`, `.main-row`, `.form-column`, `.scrollable-island` — replaced per-view.
- `.v-card.fill-height` — replaced by direct flex layout.
- `.scrollable-island > .v-card`, `.scrollable-island .scroll-content` — replaced per-view.

---

### `src/assets/main.css`

Remove `@import './islands-theme.css'`. Add:

```css
/* VMain viewport height — allows child views to use height:100% to fill VMain.
   Vuetify's .v-application__wrap uses min-height:100dvh (not a fixed height), so
   without this, flex children can't establish a bounded scroll context.
   --v-layout-top is set by VAppBar via Vuetify's layout composable. */
.v-main {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--v-layout-top, 48px));
  overflow: hidden;
}
```

Append the moved visual rules from islands-theme.css (~50 lines).

---

### `src/main.ts`

Rename the custom `page-background` theme color to `background` in both light and dark themes. Vuetify automatically applies `--v-theme-background` to `.v-application { background: rgb(var(--v-theme-background)) }`, so the page background color works without any CSS override.

Remove the `page-background` key from both theme objects and rename to `background`:
- Light: `background: '#EBEEF1'`
- Dark: `background: '#1E1E1E'`

Remove "Islands theme" comments from `VCard`/`VRow` defaults (keep the defaults themselves).

---

### `src/views/HomeView.vue`

#### Template

Replace the four custom wrapper divs with a two-level structure:

```html
<div class="home-layout">
  <WorkTimeBarChart class="flex-shrink-0" />
  <div class="panels-row">
    <VCard class="form-panel d-flex flex-column overflow-hidden">
      <VTabs ... />
      <VTabsWindow ...>
        <VTabsWindowItem value="form" class="overflow-y-auto">
          <BulkLogForm ... />
        </VTabsWindowItem>
        <VTabsWindowItem value="ai">
          <AiChatPanel ... />
        </VTabsWindowItem>
      </VTabsWindow>
    </VCard>
    <!-- LogList renders its own VCard root; HomeView controls layout via class inheritance -->
    <LogList class="flex-grow-1 overflow-hidden" ... />
  </div>
</div>
```

`LogList` receives `flex-grow-1 overflow-hidden` via Vue's class inheritance — these are applied to its root `<VCard>` element. No wrapper div needed.

#### Scoped CSS (replaces entire current block)

```css
/* Viewport-fill two-panel layout */
.home-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 12px 12px;
  gap: 12px;
}
.panels-row {
  flex: 1;
  min-height: 0;   /* essential — Vuetify has no utility class for this */
  display: flex;
  gap: 12px;
}
.form-panel {
  flex: 0 0 33.333%;
  max-width: 33.333%;
}

/* VTabsWindow flex chain
   Vuetify's VWindow sets height:inherit on .v-window__container. Because VTabsWindow
   only has a flex-allocated height (no explicit CSS height property), inherit resolves
   to auto — collapsing the container and preventing overflow-y-auto from scrolling.
   This chain fixes that without touching Vuetify internals globally. */
.form-panel :deep(.v-tabs)                              { flex-grow: 0 !important; flex-shrink: 0 !important; }
.form-panel :deep(.v-tabs-window)                       { flex: 1; display: flex !important; flex-direction: column; min-height: 0; }
.form-panel :deep(.v-tabs-window .v-window__container)  { height: auto !important; flex: 1; min-height: 0; }
.form-panel :deep(.v-tabs-window .v-window-item)        { flex: 1; min-height: 0; display: flex; flex-direction: column; }

/* Mobile: panels stack vertically, .panels-row scrolls as a unit */
@media (max-width: 959px) {
  .panels-row {
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .form-panel {
    flex: none;
    max-width: 100%;
    overflow: visible !important;
  }
  /* Clear all overflow contexts so sticky buttons work against .panels-row */
  .form-panel :deep(.v-card),
  .form-panel :deep(.v-tabs-window),
  .form-panel :deep(.v-tabs-window .v-window__container),
  .form-panel :deep(.v-tabs-window .v-window-item) {
    overflow: visible !important;
    height: auto !important;
    flex: none !important;
  }
}
```

---

### `src/components/LogList.vue`

**Principle: components render content; views own layout.**

Remove scoped layout CSS:
```css
/* DELETE */
.log-list { flex: 1; min-height: 0; overflow: hidden; }
```

Remove `log-list` class from the root `<VCard>`. The VCard retains `d-flex flex-column` for its internal flex structure (title + scroll-content).

The `scroll-content { flex: 1; overflow-y: auto }` rule stays — that is internal component behavior, not layout.

HomeView passes layout classes directly via class inheritance (see HomeView section above).

---

### `src/components/EventList.vue`

Same treatment as LogList:
- Remove any root-element layout scoped CSS (`flex: 1`, `min-height: 0`, `overflow: hidden`)
- Keep internal scroll structure (`scroll-content` etc.)
- EventView is simple (VContainer, page-level scroll) — no layout CSS needed there either.

---

### `src/views/SettingView.vue`

Replace `<div class="page-container">` wrapper:

```html
<!-- before -->
<div class="page-container">

<!-- after -->
<div class="h-100 overflow-y-auto">
```

In scoped CSS:
- Remove `.page-container { overflow-y: auto }` override (no longer needed — the div itself has `overflow-y-auto`).
- Replace `var(--islands-gap)` → `12px` in `settings-grid` and `settings-col` rules (3 occurrences).
- `settings-grid` and `settings-col` rules stay otherwise unchanged.

---

### `src/views/TaskView.vue` — no changes

Uses `VContainer` natively. `bg-container` class continues to work (moved to `main.css`).

### `src/views/EventView.vue` — no changes

Uses `VContainer`. EventList renders at natural height, page scrolls.

### `src/App.vue` — no changes

VApp + VAppBar + VMain structure is unchanged.

---

## What stays the same

- Visual identity: flat cards, rounded-lg corners, `surface` vs `background` color contrast — all encoded in `main.ts` defaults and theme.
- `bg-surface` usage in sticky card titles — Vuetify built-in utility, still works.
- `bg-container` utility — moved to `main.css`, still works everywhere.
- BulkLogForm sticky buttons — work correctly with the new layout (panels-row is scroll container on mobile, VTabsWindowItem on desktop).

## Summary of CSS reduction

| Before | After |
|--------|-------|
| `islands-theme.css`: 212 lines (global) | Deleted |
| HomeView scoped: 47 lines | ~35 lines (scoped, co-located) |
| Dead `.v-main__wrap` rules | Gone |
| `main.css` | +~55 lines (moved visual rules + VMain constraint) |
| **Net** | **~170 lines removed** |
