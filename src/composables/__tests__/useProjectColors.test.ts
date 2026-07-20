import { describe, expect, it } from 'vitest';

import { deriveTaskShades } from '@/composables/useProjectColors';

const HEX = /^#[0-9a-f]{6}$/i;

describe('deriveTaskShades', () => {
  it('returns one distinct hex per task', () => {
    const shades = deriveTaskShades('#A8D4F0', 3, false);
    expect(shades).toHaveLength(3);
    shades.forEach((s) => expect(s).toMatch(HEX));
    expect(new Set(shades).size).toBe(3); // all distinct
  });

  it('returns a single shade for count 1', () => {
    const shades = deriveTaskShades('#A8D4F0', 1, false);
    expect(shades).toHaveLength(1);
    expect(shades[0]).toMatch(HEX);
  });

  it('returns empty for count 0', () => {
    expect(deriveTaskShades('#A8D4F0', 0, false)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(deriveTaskShades('#A8E6CF', 4, true)).toEqual(deriveTaskShades('#A8E6CF', 4, true));
  });

  it('produces distinct shades in dark mode too', () => {
    const shades = deriveTaskShades('#C4B8E8', 3, true);
    expect(new Set(shades).size).toBe(3);
  });
});
