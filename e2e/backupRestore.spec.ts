import { expect, type Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Backup / restore is the app's only safety net for local-only data, and import is
 * destructive (it replaces every collection). These cover the round trip end to end.
 *
 * Seeds via the legacy `timeLogs-YYYY-MM` key: on a fresh context the schema version
 * is 0, so migration 001 imports it into the unified collections — which is how the
 * app gets data without hand-writing IndexedDB.
 */

test.use({ viewport: { width: 1440, height: 900 } });

const LOGS = [
  { id: 'b1', date: '2026-07-01', project: 'Alpha', task: 'Dev', duration: 300, type: 'log', description: 'endpoint work' },
  { id: 'b2', date: '2026-07-02', project: 'Beta', task: 'QA', duration: 60, type: 'log', description: 'smoke testing' },
];

async function seed(page: Page) {
  await page.addInitScript((logs) => {
    localStorage.setItem('timeLogs-2026-07', JSON.stringify(logs));
    localStorage.setItem('projects-2026-07', JSON.stringify([{ title: 'Alpha' }, { title: 'Beta' }]));
    localStorage.setItem('tasks-2026-07', JSON.stringify([
      { project: 'Alpha', title: 'Dev' },
      { project: 'Beta', title: 'QA' },
    ]));
    localStorage.setItem('events', JSON.stringify([{ id: 'e1', title: 'Team offsite', date: '2026-07-15', type: 'custom' }]));
  }, LOGS);
}

/**
 * Read straight out of IndexedDB — proves durability, not just Vue reactivity.
 * Retries because a reload can destroy the execution context mid-evaluate.
 */
async function readStore(page: Page, store: string): Promise<Record<string, unknown>[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await evaluateStore(page, store);
    } catch (err) {
      if (attempt >= 5) throw err;
      await page.waitForTimeout(300);
    }
  }
}

async function evaluateStore(page: Page, store: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(async (name) => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const q = indexedDB.open('daybook');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const rows = await new Promise<Record<string, unknown>[]>((res) => {
      const r = db.transaction(name, 'readonly').objectStore(name).getAll();
      r.onsuccess = () => res(r.result);
    });
    db.close();
    return rows;
  }, store);
}

async function wipeDb(page: Page) {
  await page.evaluate(async () => {
    const stores = ['timeLogs', 'projects', 'tasks', 'pinnedProjects', 'categories', 'events'];
    const db: IDBDatabase = await new Promise((res, rej) => {
      const q = indexedDB.open('daybook');
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  });
}

test('exports a snapshot, and importing it restores every collection', async ({ page }) => {
  await seed(page);
  await page.goto('/setting');
  await expect(page.locator('main').getByText('Backup & Restore')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export backup/i }).click();
  const backupPath = (await (await downloadPromise).path())!;

  const snapshot = JSON.parse(readFileSync(backupPath, 'utf8'));
  expect(snapshot.collections.timeLogs).toHaveLength(2);
  expect(snapshot.collections.events).toHaveLength(1);

  await wipeDb(page);
  await page.reload();
  await page.waitForLoadState('load');
  await expect(page.locator('main').getByText('Backup & Restore')).toBeVisible();
  await expect.poll(async () => (await readStore(page, 'timeLogs')).length, { timeout: 10000 }).toBe(0);

  // Regression: VFileInput emits a single File (not an array) when `multiple` is
  // unset, so the import handler used to bail silently and restore nothing.
  await page.setInputFiles('input[type="file"][accept="application/json"]', backupPath);

  await expect.poll(async () => (await readStore(page, 'timeLogs')).length, { timeout: 15000 }).toBe(2);
  expect((await readStore(page, 'events')).map((e) => e.id)).toEqual(['e1']);
  expect((await readStore(page, 'projects')).map((p) => p.id).sort()).toEqual(['Alpha', 'Beta']);
});

test('custom events survive the upgrade when the holiday fetch returns nothing', async ({ page }) => {
  // Regression: replaceAll() cleared the collection and then threw DataCloneError on
  // Vue reactive proxies, permanently destroying the user's own events on first load.
  await seed(page);
  await page.goto('/');
  await expect(page.locator('main').getByText('Logs', { exact: true }).first()).toBeVisible();

  await expect.poll(async () => (await readStore(page, 'events')).map((e) => e.id), { timeout: 15000 }).toEqual(['e1']);
});
