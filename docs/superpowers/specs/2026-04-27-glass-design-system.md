# Glass Design System — Daybook

**Date:** 2026-04-27
**Status:** Approved

## Problem

Nested glass elements render as visually solid — too prominent, out of harmony with their parent panels. There are no written rules for which glass tier to apply, so usage drifts over time.

## Goal

A lightweight, role-based guideline that answers one question for any surface: _which glass class should I use here?_ The rules must be intuitive enough that a new contributor can apply them correctly without reviewing existing code.

---

## The Three Tiers

### `glass-mica` — Passive display surfaces

**Role:** Large surfaces that show data but do not receive primary user interaction. They should visually recede so content panels feel dominant.

**CSS behaviour:**

- Blur: `calc(var(--glass-blur) * 0.15)` — very subtle
- Opacity: `calc(var(--glass-opacity-*) * 0.20)` — near-transparent tint
- `backdrop-filter`: yes (samples from background image)

**Current components:**

- `WorkTimeBarChart.vue` — monthly bar chart
- `MobileWeekChart.vue` — compact week strip (mobile)

---

### `glass-acrylic` — Primary interactive panels

**Role:** Panels, navigation bars, and cards that sit directly on the app background and contain the app's main content or actions. This is the default tier for any top-level surface.

**CSS behaviour:**

- Blur: full `var(--glass-blur)` value
- Opacity: full `var(--glass-opacity-*)` value
- `backdrop-filter`: yes

**Current components:**

- `app-dock` (nav bar) — `App.vue`
- `form-panel` (form + AI tabs) — `HomeView.vue`
- `LogList.vue`
- `EventList.vue`
- `TaskView.vue` main card
- `SettingView.vue` section cards (×5)

---

### `glass-inset` — Sub-surfaces nested inside a panel

**Role:** Widgets, action bars, calendars, message cards, or any sub-container that lives _inside_ an Acrylic panel. Because the parent already creates a GPU compositing layer, `backdrop-filter` on a child cannot reach the background — so Inset uses a flat low-opacity tint only.

**CSS behaviour:**

- Blur: **none** — `backdrop-filter: none !important`
- Light: `background: rgba(255,255,255,0.18)`
- Dark: `background: rgba(255,255,255,0.07)`
- No slider-driven values (slider-driven blur is wasted inside a compositing layer)

**Current components:**

- `CalendarOverview.vue` — inside `BulkLogForm` → `form-panel`
- `form-actions` sticky bar — `BulkLogForm.vue`

**Note on AiChatPanel:** Message bubble VCards inside AiChatPanel use semantic Vuetify colors (`color="container"`, `color="error"`). These are content items (one per message), not structural surfaces — they correctly have no glass class per the decision tree rule.

---

## Decision Tree

Ask these three questions in order:

1. **Does this surface sit directly on the app background?**
   - Yes, and it holds primary content or navigation → **`glass-acrylic`**
   - Yes, and it only passively displays data (chart, graph) → **`glass-mica`**

2. **Is this surface nested inside an Acrylic panel?**
   - Yes → **`glass-inset`**, always. The parent's blur already applies — adding blur here wastes GPU and makes the surface look solid.

3. **Is this a list row, table cell, form field, or inline element?**
   - Yes → **no glass class**. Glass is for structural container surfaces only, not content items.

---

## Anti-Patterns

- **Nesting `glass-acrylic` inside `glass-acrylic`** — double `backdrop-filter` stacks can't reach the background; the inner surface looks fully opaque. Use `glass-inset` instead.
- **Using `glass-inset` standalone** (not inside an Acrylic container) — it has no blur and will look flat and out of place.
- **Applying any glass class to list rows, table cells, or form inputs** — glass is for structural panels only. Content items should be transparent by default.
- **Hardcoding opacity or blur values** instead of using `--glass-blur` / `--glass-opacity-*` CSS vars — breaks the Settings slider.

---

## CSS Architecture

All tiers read from three CSS custom properties set by `App.vue` → `glassStyle`:

```
--glass-blur           (e.g. 25.6px at slider=0.8)
--glass-opacity-light  (e.g. 0.83 at slider=0.8)
--glass-opacity-dark   (e.g. 0.77 at slider=0.8)
```

The Settings "Glass Effect" slider drives all three simultaneously, so adjusting it proportionally affects Mica and Acrylic tiers. Inset uses flat values because blur inside a compositing layer has no visible effect.

---

## Implementation Changes Required

| Component              | Current         | Target       | Reason                         |
| ---------------------- | --------------- | ------------ | ------------------------------ |
| `WorkTimeBarChart.vue` | `glass-acrylic` | `glass-mica` | Passive display, should recede |
| `MobileWeekChart.vue`  | `glass-acrylic` | `glass-mica` | Passive display, should recede |

All other current assignments are already correct per this guideline.

---

## What Stays the Same

- All CSS class definitions in `src/assets/main.css` are already correct — no CSS changes needed.
- The slider system in `App.vue` is already correct.
- `CalendarOverview`, `form-actions`, `LogList`, `EventList`, `SettingView` cards, `TaskView` card, and `app-dock` are already on the right tier.
