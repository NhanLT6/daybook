# Glass Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Demote the two chart components from `glass-acrylic` to `glass-mica` so passive display surfaces visually recede behind primary interactive panels.

**Architecture:** Two one-line CSS class swaps. No CSS definitions change — `glass-mica` is already defined in `src/assets/main.css`. No logic changes, no new files.

**Tech Stack:** Vue 3, Vuetify 3, custom glass CSS in `src/assets/main.css`

---

## File Map

| File                                      | Change                                         |
| ----------------------------------------- | ---------------------------------------------- |
| `src/components/WorkTimeBarChart.vue:271` | `glass-acrylic` → `glass-mica` on root `VCard` |
| `src/components/MobileWeekChart.vue:89`   | `glass-acrylic` → `glass-mica` on root `VCard` |

---

### Task 1: Demote WorkTimeBarChart to glass-mica

**Files:**

- Modify: `src/components/WorkTimeBarChart.vue:271`

- [ ] **Step 1: Make the change**

  In `src/components/WorkTimeBarChart.vue`, line 271, change:

  ```html
  <VCard class="glass-acrylic pa-4"></VCard>
  ```

  to:

  ```html
  <VCard class="glass-mica pa-4"></VCard>
  ```

- [ ] **Step 2: Verify visually**

  With the dev server running (`pnpm run dev`), open the Home view. The monthly bar chart should now appear with a much subtler frost — barely-tinted, nearly transparent — compared to the form panel and log list beside it. The chart content (bars, labels) should still be fully readable.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/WorkTimeBarChart.vue
  git commit -m "feat(glass): demote WorkTimeBarChart to glass-mica tier"
  ```

---

### Task 2: Demote MobileWeekChart to glass-mica

**Files:**

- Modify: `src/components/MobileWeekChart.vue:89`

- [ ] **Step 1: Make the change**

  In `src/components/MobileWeekChart.vue`, line 89, change:

  ```html
  <VCard class="glass-acrylic pa-2"></VCard>
  ```

  to:

  ```html
  <VCard class="glass-mica pa-2"></VCard>
  ```

- [ ] **Step 2: Verify visually**

  On a mobile viewport (or browser DevTools mobile emulation), the compact week strip at the top should appear with a very subtle tint rather than the full frosted-panel look. The weekly bars and day labels should remain clearly visible.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/MobileWeekChart.vue
  git commit -m "feat(glass): demote MobileWeekChart to glass-mica tier"
  ```

---

### Task 3: Commit the design spec and guideline doc

- [ ] **Step 1: Stage and commit the spec**

  ```bash
  git add docs/superpowers/specs/2026-04-27-glass-design-system.md \
          docs/superpowers/plans/2026-04-27-glass-design-system.md
  git commit -m "docs: add glass design system guideline and implementation plan"
  ```
