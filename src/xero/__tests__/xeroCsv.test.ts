import { describe, expect, it } from 'vitest';

import { xeroExportCsv, xeroImportCsv } from '@/xero/xeroCsv';

describe('xero csv', () => {
  it('exports ISO dates in the Xero template format', () => {
    const csv = xeroExportCsv([{ id: '1', date: '2026-07-01', project: 'P', task: 'T', duration: 2, type: 'log' }]);
    expect(csv).toContain('07-01-26');
    expect(csv).toContain('IsLogged');
  });

  it('imports Xero dates back to ISO', () => {
    const csv = 'Id,Date,Project,Task,Duration,Type,Description,IsLogged\n1,07-01-26,P,T,2,log,,false';
    expect(xeroImportCsv(csv)[0].date).toBe('2026-07-01');
  });

  it('imports a blank task cell as undefined, not an empty string', () => {
    const csv = 'Id,Date,Project,Task,Duration,Type,Description,IsLogged\n1,07-01-26,P,,2,log,,false';
    expect(xeroImportCsv(csv)[0].task).toBeUndefined();
  });
});
