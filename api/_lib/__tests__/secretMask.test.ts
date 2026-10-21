import { describe, expect, it } from 'vitest';

import { isMaskedSecret, maskSecret } from '../../../src/interfaces/ServerSettings';

describe('maskSecret', () => {
  it('keeps only the last 4 characters', () => {
    expect(maskSecret('ATATT3xFfGF0abcd')).toBe('••••••••abcd');
  });

  it('leaves an empty secret empty, so a deleted key reads as deleted', () => {
    expect(maskSecret('')).toBe('');
  });

  it('is stable when applied to an already masked value', () => {
    expect(maskSecret(maskSecret('ATATT3xFfGF0abcd'))).toBe('••••••••abcd');
  });
});

describe('isMaskedSecret', () => {
  it('tells a masked value from a real or empty one', () => {
    expect(isMaskedSecret(maskSecret('ATATT3xFfGF0abcd'))).toBe(true);
    expect(isMaskedSecret('ATATT3xFfGF0abcd')).toBe(false);
    expect(isMaskedSecret('')).toBe(false);
    expect(isMaskedSecret(undefined)).toBe(false);
  });
});
