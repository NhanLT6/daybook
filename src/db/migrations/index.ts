import { CURRENT_SCHEMA_VERSION, getSchemaVersion, setSchemaVersion } from '@/db/dbMeta';

import type { StorageAdapter } from '@/db/types';

import { migrateLegacyLocalStorage } from '@/db/migrations/001-legacy-localstorage';

export async function runMigrations(adapter: StorageAdapter): Promise<void> {
  let version = getSchemaVersion();
  if (version < 1) {
    await migrateLegacyLocalStorage(adapter);
    version = 1;
    setSchemaVersion(version);
  }
  // future: if (version < 2) { ... }
  if (version !== CURRENT_SCHEMA_VERSION) setSchemaVersion(CURRENT_SCHEMA_VERSION);
}
