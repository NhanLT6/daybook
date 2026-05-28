# Remember Last Selected Date — Design Spec

## Overview

Add an opt-in "Remember last selected date" feature to BulkLogForm that restores the date from the user's previous log entry, but only within a short time window. This supports sequential logging sessions (logging 2–3 entries in a row) without annoying users who log by week or return the next day.

---

## Motivation

The current behaviour auto-selects today on every save/cancel/mount. This suits daily loggers but annoys users who:
- Log multiple entries for the same date in one sitting
- Log for dates other than today (e.g. catching up on yesterday)

The feature is opt-in and defaults to OFF, so existing behaviour is preserved for all users until they enable it.

---

## Behaviour

### `selectedDates` reset rules

| Scenario | After save or cancel |
|---|---|
| Multiple dates selected (any toggle value) | `[]` |
| Single date, feature **OFF** | `[]` |
| Single date, feature **ON**, within window | `[rememberedDate]` |
| Single date, feature **ON**, window expired | `[]` |

### Initial load (mount)

Always start with `[]`. If the feature is ON and a non-expired `lastSelectedDate` exists in localStorage, restore it as the initial `selectedDates`.

### Midnight watcher

Updates `currentMonth` to today's month so the calendar stays on the right page for long-running tabs. Does **not** touch `selectedDates`.

### Session continuation window

**3 minutes** — hardcoded. Checked at restore time (save/cancel/mount) against the `savedAt` timestamp stored with the remembered date.

Rationale: tight enough to distinguish "active session" from "came back later", forgiving enough to survive a slow form fill or a brief distraction without breaking the chain.

---

## Data Model

A new `RememberedDate` type stored in localStorage via `useStorage`:

```ts
interface RememberedDate {
  date: string;    // ISO date string (YYYY-MM-DD)
  savedAt: number; // Date.now() at save time
}
```

---

## Settings Store Changes (`src/stores/settings.ts`)

Two new `useStorage` refs:

```ts
const rememberLastSelectedDate = useStorage('rememberLastSelectedDate', false);
const lastSelectedDate = useStorage<RememberedDate | null>('lastSelectedDate', null);
```

Both exposed from `useSettingsStore`.

---

## HomeView Changes (`src/views/HomeView.vue`)

### Constants

```ts
const REMEMBER_DATE_EXPIRY_MS = 3 * 60 * 1000;
```

### Helper

```ts
function getRememberedDate(): Date | null {
  const stored = settingsStore.lastSelectedDate;
  if (!settingsStore.rememberLastSelectedDate || !stored) return null;
  if (Date.now() - stored.savedAt > REMEMBER_DATE_EXPIRY_MS) return null;
  return new Date(stored.date);
}
```

### Initial value

```ts
// Before: const selectedDates = ref<Date[]>([now.value]);
const initialDate = getRememberedDate();
const selectedDates = ref<Date[]>(initialDate ? [initialDate] : []);
```

### After save (`saveBulkLogs`)

```ts
// Before: selectedDates.value = [now.value];
// Store from selectedDates.value[0] (a Date object) rather than logs[0].date
// (logs[0].date is in shortDateFormat 'MM/DD/YYYY', not safe for new Date())
// Only remember in create mode (not edit mode — editingLog is cleared after this block)
const isSingleCreate = !editingLog.value && logs.length === 1;
if (settingsStore.rememberLastSelectedDate && isSingleCreate) {
  settingsStore.lastSelectedDate = { date: selectedDates.value[0].toISOString(), savedAt: Date.now() };
  selectedDates.value = [selectedDates.value[0]];
} else {
  settingsStore.lastSelectedDate = null;
  selectedDates.value = [];
}
```

### After cancel (`onBulkCancel`)

```ts
// Before: selectedDates.value = [now.value];
const remembered = getRememberedDate();
selectedDates.value = remembered ? [remembered] : [];
editingLog.value = undefined;
```

### Midnight watcher

```ts
// Before: selectedDates.value = [now.value];
// After: only update currentMonth
watch(todayDateStr, () => {
  if (!editingLog.value) {
    currentMonth.value = dayjs().month() + 1;
  }
});
```

---

## Settings UI Changes (`src/views/SettingView.vue`)

Add as the last item in the Features card:

```html
<VSwitch
  v-model="settingsStore.rememberLastSelectedDate"
  label="Remember last selected date"
  persistent-hint
  hint="After saving a single-date log, the same date is pre-selected for your next entry — as long as you continue within 3 minutes. Useful for logging multiple entries in one sitting."
  color="primary"
/>
```

---

## Edge Cases

| Case | Outcome |
|---|---|
| User saves, types slowly for 4 min, cancels | Window expired → `[]`. Minor annoyance, acceptable trade-off. |
| User saves, closes tab, reopens within 3 min | Restored — consistent with sequential session intent. |
| User saves multi-date log | `lastSelectedDate` cleared, `selectedDates = []`. |
| Feature toggled OFF mid-session | Next restore ignores stored date → `[]`. |
| Two tabs open simultaneously | Last write wins — minor, not worth guarding against. |
| Edit mode save | `editingLog` check prevents remembering the date; `selectedDates` resets to `[]`. |

---

## Files Changed

- `src/stores/settings.ts` — add `rememberLastSelectedDate`, `lastSelectedDate`
- `src/views/HomeView.vue` — update init, save, cancel, midnight watcher
- `src/views/SettingView.vue` — add VSwitch to Features card
