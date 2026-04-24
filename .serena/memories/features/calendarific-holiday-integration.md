# Calendarific Holiday Integration

## How it works

### Data flow
1. `src/apis/holidayApi.ts` — `fetchHolidays(year)` calls Calendarific REST API directly from the browser (client-side axios via `httpClient`). Fetches Vietnam (`country: 'VN'`) holidays for the given year. Maps results to `AppEvent[]` with `type: 'holiday'`.
2. `src/App.vue` — `autoFetchEvents()` runs on `onMounted`. Guards with: "only fetch if no holiday events for the current year exist in localStorage". If none found, calls `fetchHolidays` and appends results to `events`.
3. `events` is persisted via `useStorage<AppEvent[]>(storageKeys.events, [])` (key: `'events'`). Both `EventList.vue` and `CalendarOverview.vue` read from the same key independently.

### AppEvent shape (src/interfaces/Event.ts)
```ts
interface AppEvent {
  id: string      // "holiday-{YYYY-MM-DD}-{slug}"
  title: string
  date: string    // "YYYY-MM-DD"
  endDate?: string
  startTime?: string
  endTime?: string
  type: 'holiday' | 'custom'
  description?: string
}
```

### Display
- `CalendarOverview.vue`: renders holiday dots in deep-purple (`#673AB7`), custom events in indigo (`#3F51B5`)
- `EventList.vue`: shows holiday image avatar vs custom icon; filtered by selected month

## Known issues / why events may not display

1. **Missing API key**: `VITE_CALENDARIFIC_API_KEY` is NOT in `.env.local`. The key must be added there for local dev, and in Vercel env vars for production. Without it, the API call returns an auth error → `fetchHolidays` catches it silently and returns `[]`.
2. **No Vercel API proxy**: Unlike Jira (which goes through `/api/jira/fetch-tickets.ts`), Calendarific is called directly from the browser. If Calendarific doesn't send CORS headers, the request will be blocked. Consider proxying through a Vercel function.
3. **One-time fetch guard**: Once any holiday event for the current year exists in localStorage, `autoFetchEvents` skips fetching entirely. If the stored data is stale or corrupted, manually clear `localStorage.events` to force a re-fetch.
