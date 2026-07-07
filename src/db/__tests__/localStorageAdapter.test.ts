import { createLocalStorageAdapter } from '@/db/adapters/localStorageAdapter';
import { runAdapterContract } from '@/db/__tests__/adapterContract';

runAdapterContract(
  () => createLocalStorageAdapter(),
  async () => {
    localStorage.clear();
  },
);
