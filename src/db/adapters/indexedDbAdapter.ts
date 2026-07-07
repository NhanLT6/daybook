import { type IDBPDatabase, openDB } from 'idb';

import { COLLECTION_NAMES, type CollectionName, type DbSnapshot, type IdRecord, type StorageAdapter } from '@/db/types';

const DB_VERSION = 1;

export function createIndexedDbAdapter(dbName = 'daybook'): StorageAdapter & { close(): void } {
  let dbPromise: Promise<IDBPDatabase> | null = null;

  const getDb = () => {
    if (!dbPromise) {
      dbPromise = openDB(dbName, DB_VERSION, {
        upgrade(db) {
          for (const c of COLLECTION_NAMES) {
            if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' });
          }
        },
      });
    }
    return dbPromise;
  };

  return {
    async init() {
      await getDb();
    },
    async getAll<T extends IdRecord>(c: CollectionName): Promise<T[]> {
      return (await (await getDb()).getAll(c)) as T[];
    },
    async put<T extends IdRecord>(c: CollectionName, record: T): Promise<void> {
      await (await getDb()).put(c, record);
    },
    async putMany<T extends IdRecord>(c: CollectionName, records: T[]): Promise<void> {
      const db = await getDb();
      const tx = db.transaction(c, 'readwrite');
      await Promise.all(records.map((r) => tx.store.put(r)));
      await tx.done;
    },
    async remove(c: CollectionName, id: string): Promise<void> {
      await (await getDb()).delete(c, id);
    },
    async clear(c: CollectionName): Promise<void> {
      await (await getDb()).clear(c);
    },
    async snapshot(): Promise<DbSnapshot> {
      const db = await getDb();
      const entries = await Promise.all(COLLECTION_NAMES.map(async (c) => [c, await db.getAll(c)] as const));
      return { schemaVersion: DB_VERSION, collections: Object.fromEntries(entries) as DbSnapshot['collections'] };
    },
    async restore(s: DbSnapshot): Promise<void> {
      const db = await getDb();
      const tx = db.transaction([...COLLECTION_NAMES], 'readwrite');
      await Promise.all(
        COLLECTION_NAMES.map(async (c) => {
          await tx.objectStore(c).clear();
          for (const r of s.collections[c] ?? []) await tx.objectStore(c).put(r);
        }),
      );
      await tx.done;
    },
    close(): void {
      if (dbPromise) {
        dbPromise.then((db) => db.close());
        dbPromise = null;
      }
    },
  };
}
