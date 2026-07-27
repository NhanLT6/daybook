import { computed } from 'vue';

import type { TimeLog } from '@/interfaces/TimeLog';

import { useCollection } from '@/composables/useCollection';

type StoredTimeLog = TimeLog & { id: string };

export function useTimeLogs() {
  const c = useCollection<StoredTimeLog>('timeLogs');
  const logs = computed(() => c.items.value);

  // ISO 'YYYY-MM-DD' compares lexicographically, so string comparison == date comparison.
  const forMonth = (monthIso: string): TimeLog[] => c.items.value.filter((l) => l.date.startsWith(`${monthIso}-`));
  const inRange = (fromIso: string, toIso: string): TimeLog[] =>
    c.items.value.filter((l) => l.date >= fromIso && l.date <= toIso);

  return {
    logs,
    loading: c.loading,
    ready: c.ready,
    reload: c.reload,
    forMonth,
    inRange,
    add: c.add,
    addMany: c.addMany,
    upsert: c.upsert,
    save: (log: StoredTimeLog) => c.upsert(log),
    remove: c.remove,
    clear: c.clear,
  };
}
