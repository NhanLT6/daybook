import { deleteDB } from 'idb';

import { createIndexedDbAdapter } from '@/db/adapters/indexedDbAdapter';
import { runAdapterContract } from '@/db/__tests__/adapterContract';

const DB_NAME = 'daybook-test';
let currentAdapter: ReturnType<typeof createIndexedDbAdapter> | null = null;

runAdapterContract(
  () => {
    currentAdapter = createIndexedDbAdapter(DB_NAME);
    return currentAdapter;
  },
  async () => {
    // Close the adapter's DB connection before deleting
    if (currentAdapter) {
      currentAdapter.close();
    }
    await deleteDB(DB_NAME);
  },
);
