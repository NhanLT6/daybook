import { COLLECTION_NAMES, type CollectionName, type DbSnapshot, type IdRecord, type StorageAdapter } from '@/db/types';

const PREFIX = 'daybook:v1:';
const key = (c: CollectionName) => `${PREFIX}${c}`;

function read<T extends IdRecord>(c: CollectionName): T[] {
  const raw = localStorage.getItem(key(c));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function write<T extends IdRecord>(c: CollectionName, rows: T[]): void {
  localStorage.setItem(key(c), JSON.stringify(rows));
}

export function createLocalStorageAdapter(): StorageAdapter {
  return {
    async init() {
      // no-op: keys are created lazily on first write
    },
    async getAll<T extends IdRecord>(c: CollectionName): Promise<T[]> {
      return read<T>(c);
    },
    async put<T extends IdRecord>(c: CollectionName, record: T): Promise<void> {
      const rows = read<T>(c).filter((r) => r.id !== record.id);
      rows.push(record);
      write(c, rows);
    },
    async putMany<T extends IdRecord>(c: CollectionName, records: T[]): Promise<void> {
      const incoming = new Map(records.map((r) => [r.id, r]));
      const kept = read<T>(c).filter((r) => !incoming.has(r.id));
      write(c, [...kept, ...records]);
    },
    async remove(c: CollectionName, id: string): Promise<void> {
      write(
        c,
        read(c).filter((r) => r.id !== id),
      );
    },
    async clear(c: CollectionName): Promise<void> {
      localStorage.removeItem(key(c));
    },
    async snapshot(): Promise<DbSnapshot> {
      const collections = Object.fromEntries(
        COLLECTION_NAMES.map((c) => [c, read(c)]),
      ) as DbSnapshot['collections'];
      return { schemaVersion: 1, collections };
    },
    async restore(s: DbSnapshot): Promise<void> {
      for (const c of COLLECTION_NAMES) write(c, s.collections[c] ?? []);
    },
  };
}
