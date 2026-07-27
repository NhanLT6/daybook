export const COLLECTION_NAMES = [
  'timeLogs',
  'projects',
  'tasks',
  'pinnedProjects',
  'categories',
  'events',
] as const;

export type CollectionName = (typeof COLLECTION_NAMES)[number];

export interface IdRecord {
  id: string;
}

export type DbSnapshot = {
  schemaVersion: number;
  collections: Record<CollectionName, IdRecord[]>;
};

export interface StorageAdapter {
  init(): Promise<void>;
  getAll<T extends IdRecord>(c: CollectionName): Promise<T[]>;
  put<T extends IdRecord>(c: CollectionName, record: T): Promise<void>;
  putMany<T extends IdRecord>(c: CollectionName, records: T[]): Promise<void>;
  remove(c: CollectionName, id: string): Promise<void>;
  clear(c: CollectionName): Promise<void>;
  snapshot(): Promise<DbSnapshot>;
  restore(s: DbSnapshot): Promise<void>;
}

export interface Collection<T extends IdRecord> {
  all(): Promise<T[]>;
  add(r: T): Promise<void>;
  addMany(r: T[]): Promise<void>;
  upsert(r: T): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
