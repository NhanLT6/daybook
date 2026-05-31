# Notification Center Design

## Status

Implemented as the foundation for replacing toast-style feedback with a header notification island. `vue-sonner` has been removed from the active source and `package.json`.

## Goals

- Use one header-mounted surface for passive notifications, interactive confirmations, greeting messages, and catch-up summaries.
- Keep the interaction model click/tap based on both desktop and mobile.
- Let confirmations behave like lightweight dialogs: they open immediately and require a user decision. Clicking outside is treated as cancel.
- Keep the visual design close to the app header: compact state uses the same acrylic background variables, no compact shadow, and dark mode uses the dark header acrylic.
- Keep catch-up as a ready-only notification. It does not show greeting, preparing, or error states.

## Main Files

- `src/stores/notificationCenter.ts`
  - Pinia store and notification/action types.
  - Owns queue state, active item selection, auto-dismiss timers, action loading, confirm expansion, and confirm-collapse rules.
- `src/components/NotificationIsland.vue`
  - Header-mounted island UI rendered inside `VAppBar` by `src/App.vue`.
  - Shows compact state and expanded queued list.
  - Uses `onClickOutside` from VueUse.
- `src/composables/useGreetingNotifications.ts`
  - Produces standalone `greeting` notifications using local cadence storage.
- `src/composables/useCatchUpSummary.ts`
  - Produces `catchup` notifications only after a summary is ready.
- `src/common/storageKeys.ts`
  - Owns greeting and catch-up localStorage keys.

## Store API

Use `useNotificationCenterStore()` and prefer shorthand methods for ordinary notifications:

```ts
notificationCenter.success('Log added');

notificationCenter.error('Failed to sync Jira tickets', {
  message: error instanceof Error ? error.message : 'Unknown error occurred',
});
```

Available shorthand methods:

```ts
notificationCenter.greeting(title, options);
notificationCenter.success(title, options);
notificationCenter.info(title, options);
notificationCenter.warning(title, options);
notificationCenter.error(title, options);
notificationCenter.confirm(title, options);
notificationCenter.activity(title, options);
notificationCenter.catchup(title, options);
```

Each shorthand method delegates to `enqueue`, so priority, persistence, auto-dismiss, replacement by `id`, and confirm expansion rules stay centralized.

Use `enqueue` directly only when dynamic construction is clearer than a shorthand call:

```ts
notificationCenter.enqueue({
  kind,
  title,
  message,
});
```

Supported kinds:

```ts
type NotificationKind =
  | 'greeting'
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'confirm'
  | 'activity'
  | 'catchup';
```

Notification shape:

```ts
interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
  description?: string;
  createdAt: number;
  priority?: number;
  autoDismissMs?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
  payload?: Record<string, unknown>;
}
```

Action shape:

```ts
interface NotificationAction {
  id: string;
  label: string;
  tone?: 'default' | 'primary' | 'danger';
  closeOnComplete?: boolean;
  onClick?: () => void | Promise<void>;
}
```

## Queue Rules

- Items are sorted by priority first, then newest `createdAt`.
- Default priorities:
  - `confirm`: 90
  - `error`: 80
  - `catchup`: 70
  - `activity`: 60
  - `greeting`: 50
  - `warning`: 45
  - `success`: 40
  - `info`: 30
- Default auto-dismiss:
  - `success`: 3000ms
  - `greeting`: 4200ms
  - `info`: 4000ms
  - `warning`: 5000ms
- `error`, `confirm`, `activity`, `catchup`, and any actionable notification are always persistent.
- Persistence is enforced by the store. Callers cannot make `confirm` or actionable items passive by passing `persistent: false`.
- Re-enqueueing an existing `id` replaces the item and resets its timer.

## Confirm Behavior

Confirm notifications are the interactive replacement for delete confirmation toasts.

Rules:

- Enqueueing a `confirm` item immediately expands the island.
- See also: auto-expansion rules shared with other kinds in the Island UI Behavior section.
- Confirm items do not auto-dismiss.
- Confirm items do not show the quick dismiss icon.
- Clicking outside the island while a confirm is active dismisses the confirm and is treated as cancel.
- Running a `closeOnComplete` confirm action dismisses that confirm.
- After a completed confirm action, the island collapses unless another confirm is still the active item.

Current delete example:

```ts
notificationCenter.confirm('Delete log?', {
  message: `${log.project} · ${log.task}`,
  actions: [
    {
      id: 'cancel',
      label: 'Cancel',
      closeOnComplete: true,
    },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      closeOnComplete: true,
      onClick: () => {
        emit('deleteLog', log);
      },
    },
  ],
});
```

## Island UI Behavior

Visibility:

- The island is hidden when the queue is empty and the idle window has expired. It is not an always-visible element.
- The island becomes visible the moment any notification is enqueued.
- When the queue empties, a **5-second idle window** begins. The island remains visible during this window showing the compact idle state ("All done"). If a new notification arrives during the window the timer cancels and the island stays visible. After the window expires the island hides with the sling-out animation.
- If the island is expanded when the queue empties, it collapses first, then the idle window starts.
- Clicking to expand while the idle window is running cancels the timer. Closing the expanded panel restarts a fresh 5-second window.

Compact state:

- Rendered in the center of the header dock.
- Width is fixed at `196px`; height is `32px`.
- Uses the same acrylic variables as the header:
  - light: `--glass-opacity-light`
  - dark: `--glass-opacity-dark`
  - blur: `--glass-blur`
- Shows idle text ("All done") during the idle window when no items are queued.
- Shows active notification title when there are queued items.
- Shows a count chip only when more than one item is queued.
- No hover expansion.

Expanded state:

- Opens on compact click/tap or when an auto-expanding notification is enqueued.
- Auto-expanding kinds: `confirm`, `greeting`, `warning`, `error`. These expand immediately on enqueue because they require user attention.
- Any notification can also opt in by passing `expandOnEnqueue: true` to `enqueue` directly (used by the "New Update" release notification, which keeps `info` kind but needs prominence).
- Grows downward from the compact slot so it does not get clipped by the top viewport edge.
- Uses one panel containing a vertical list, not separate floating toast cards.
- Shows the `Notifications` header only when more than one notification is listed.
- Uses minimal item styling: no item borders and no panel divider.
- Panel close icon is intentionally absent. Outside click handles collapse or confirm cancel.

## Island Animations

The island uses a sling-bounce animation for appear and disappear. All animations are driven by the Web Animations API via Vue `<Transition :css="false">` JS hooks so the scale and width/height transitions can be orchestrated independently.

**Sling-in** (island appears from hidden):
- Scale from `0.04` → overshoots to `1.12` at 55% → dips to `0.97` → settles at `1.0`.
- Duration: 300 ms. Easing: `linear` (curve baked into keyframe stops).
- Single bounce. Plays for all notification kinds.

**Sling-out** (island hides after idle window):
- Scale `1.0` → brief outward blip `1.05` at 30% → shrinks to `0.04`, opacity fades to 0.
- Duration: 220 ms.

**Expanding entry** — auto-expanding notifications (confirm, error, greeting, warning, or `expandOnEnqueue: true`) that arrive while the island is hidden:
- The island slings in to the compact pill shape first (same 300 ms sling-in animation).
- At **55% into the sling-in (≈ 165 ms)**, the width/height expand transition fires. This is the moment the scale hits its overshoot peak, so the bounce energy carries directly into the panel opening.
- Expand transition: `width 280 ms cubic-bezier(0.34,1.4,0.56,1)`, `height 280 ms` same curve, `border-radius 220 ms ease`.
- If an auto-expanding notification arrives while the island is **already visible** (compact), the existing compact→expanded transition plays unchanged — no sling involved.

**Implementation notes:**
- `effectiveExpanded` is a local computed in `NotificationIsland.vue` that returns `false` while the entry animation is in progress, so the template renders compact content during the sling-in regardless of store state. This ensures the sling always starts from a pill shape.
- The `ready` flag (which gates width/height CSS transitions) is no longer set in `onMounted`. The `@enter` hook owns it: set to `true` at 165 ms for expanding entries, or on animation finish for normal entries.
- The `notification-slot` and `notification-shell` are both gated by `v-if="isVisible"`. Only the shell has a `<Transition>` wrapper; the slot appears/disappears instantly.

## Greeting Behavior

Greeting is standalone. It is not part of catch-up.

Storage keys:

- `notificationGreetingFirstSeenAt`
- `notificationGreetingLastShownAt`

Cadence:

- First visit: show one greeting immediately.
- Return/reload/visibility return/user interaction after 4 hours: show a short welcome-back greeting.
- Reloads before 4 hours do not show another greeting.

Current copy:

- First visit title: `Good morning`, `Good afternoon`, or `Good evening`.
- First visit message: `Ready to log your day?`
- Return title: `Welcome back`
- Return message: `Back at it?`

## Catch-Up Behavior

Catch-up is now a background producer, not a visible widget state machine.

Flow:

1. Wait for server settings, with a 5 second fallback.
2. If Gemini is disabled or missing an API key, stop silently.
3. If catch-up was dismissed today, stop silently.
4. If today's cached summary exists, enqueue a `catchup` notification.
5. Otherwise collect recent logs, call `/api/standup`, cache the markdown, then enqueue `catchup`.
6. If summary generation fails, stop silently for this foundation phase.

Catch-up notification:

- `kind: 'catchup'`
- `title: 'Catch-up'`
- Markdown summary is stored in `payload.markdown`.
- Rendered with `marked` and sanitized with `DOMPurify`.
- Persistent until the user presses `Dismiss`.

Storage kept:

- Daily dismissed date.
- Cached summary per date.
- Last fetched timestamp.

Removed dependency:

- No `catchUpEnabled` setting.
- Catch-up availability is based only on Gemini configuration.

## Sonner Migration

Active source no longer uses `vue-sonner`.

Migrated feedback:

- Log create/update/delete/import.
- AI log save/undo.
- Delete log confirmation.
- Delete event confirmation.
- Settings save.
- Jira sync.
- Jira connection test.
- App auto Jira sync.
- Release notification.
- Catch-up ready state.
- Greeting notifications.

`<Toaster />` was removed from `src/App.vue`, and `vue-sonner` was removed from `package.json`.

Historical docs may still mention `vue-sonner`; those are not active implementation references.

## Self-Review Notes

The implementation was revised to avoid two patch-style shortcuts:

- Persistence is enforced in the store, not trusted at each call site. Confirm and actionable items stay persistent even if a caller passes passive options.
- The expanded island is no longer treated as a keyboard-toggleable button. This avoids collapsing an active confirm with Enter or Space and avoids nested button semantics around the expanded panel.

The decorative `notification-slot` no longer paints its own acrylic layer. The compact shell is the visible slot, which avoids double-applying translucent backgrounds over the header.

## Testing

Current unit coverage:

- Enqueue and dismiss.
- Shorthand method behavior.
- Passive auto-dismiss.
- Default success timeout.
- Confirm persistence.
- Confirm auto-expansion.
- Action execution.
- Async action loading.
- Completed confirm action collapse.
- Greeting cadence helpers.
- Catch-up availability and ready enqueue behavior.

Recommended manual scenarios:

- Create one log and confirm `Log added` appears then auto-dismisses after about 3 seconds.
- Delete a log and confirm the island opens immediately with `Cancel` and `Delete`.
- Click outside the delete confirm and confirm no delete occurs.
- Click `Cancel` and confirm no delete occurs.
- Click `Delete` and confirm the item is deleted and a success notification appears compactly.
- Switch dark mode and confirm compact island uses the dark header acrylic, not the light background.
- Queue multiple notifications and confirm the expanded list stays inside one island panel.
- Disable Gemini and reload; confirm no catch-up notification appears.
- Enable Gemini with recent logs; confirm catch-up appears only when ready.

## Extension Guidance

- Use shorthand methods for simple feedback, such as `notificationCenter.success('Log added')`.
- Use `notificationCenter.enqueue` directly only for cases where dynamic kind/title construction is clearer.
- Use `confirm` only when the user must decide before the operation continues.
- Prefer `actions` for interaction inside the island. Any notification with actions will be persistent.
- Use stable `id` values when a producer should replace an existing notification, such as `greeting` or `catchup-${date}`.
- Put complex rendered content in `payload` and render it explicitly in `NotificationIsland.vue`.
- Keep generic notification state in the store. Keep feature-specific production logic in composables or views.
- If future actions need failure UI, add a deliberate error-handling policy to `runAction`; do not let each button invent its own pattern.

## Known Limits

- There are no component-level tests for outside-click confirm cancel because the project currently tests the store and composables, not mounted Vue components.
- The idle compact text reads the current month storage key from component setup time. A long-running tab crossing into a new month may need a follow-up reactive storage-key improvement.
