import type { Category } from '@/interfaces/Category';
import type { AppEvent } from '@/interfaces/Event';
import type { Project } from '@/interfaces/Project';
import type { Task } from '@/interfaces/Task';
import type { TimeLog } from '@/interfaces/TimeLog';

import type { Collection, CollectionName, DbSnapshot, IdRecord, StorageAdapter } from '@/db/types';

export type PinnedProject = IdRecord;

function makeCollection<T extends IdRecord>(adapter: StorageAdapter, name: CollectionName): Collection<T> {
  return {
    all: () => adapter.getAll<T>(name),
    add: (r) => adapter.put<T>(name, r),
    addMany: (r) => adapter.putMany<T>(name, r),
    upsert: (r) => adapter.put<T>(name, r),
    remove: (id) => adapter.remove(name, id),
    clear: () => adapter.clear(name),
  };
}

export interface Repository {
  timeLogs: Collection<TimeLog & IdRecord>;
  projects: Collection<Project & IdRecord>;
  tasks: Collection<Task & IdRecord>;
  pinnedProjects: Collection<PinnedProject>;
  categories: Collection<Category>;
  events: Collection<AppEvent>;
  export(): Promise<DbSnapshot>;
  import(s: DbSnapshot): Promise<void>;
}

export function createRepository(adapter: StorageAdapter): Repository {
  return {
    timeLogs: makeCollection(adapter, 'timeLogs'),
    projects: makeCollection(adapter, 'projects'),
    tasks: makeCollection(adapter, 'tasks'),
    pinnedProjects: makeCollection(adapter, 'pinnedProjects'),
    categories: makeCollection(adapter, 'categories'),
    events: makeCollection(adapter, 'events'),
    export: () => adapter.snapshot(),
    import: (s) => adapter.restore(s),
  };
}
