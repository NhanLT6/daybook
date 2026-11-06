import { describe, expect, it } from 'vitest';

import { roomLayout } from '../room';
import { shelfLayout } from '../shelf';

// Plant pixels a grown plant reaches above its soil
const PLANT_HEIGHT = 130;

describe('three-tier shelf', () => {
  it('keeps all nine plant slots on three tiers, grown plants and vines clear of the next tier', () => {
    const height = 700;
    const slots = shelfLayout.slots(370, height);
    expect(slots.map((slot) => slot.index).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);

    const tiers = new Map<number, typeof slots>();
    for (const slot of slots) {
      const base = Math.round(slot.soilY + slot.pot.height * slot.scale);
      tiers.set(base, [...(tiers.get(base) ?? []), slot]);
    }
    const supports = [...tiers.keys()].sort((a, b) => a - b);
    expect(supports).toHaveLength(3);

    supports.forEach((base, index) => {
      expect(tiers.get(base)).toHaveLength(3);
      const nextSurface = supports[index + 1] ?? height * 0.925;
      for (const slot of tiers.get(base)!) {
        if (index > 0) expect(slot.soilY - PLANT_HEIGHT * slot.scale).toBeGreaterThan(supports[index - 1]! + 8);
        expect(slot.soilY + slot.hangRoom * slot.scale).toBeLessThan(nextSurface);
      }
    });
  });
});

describe('room corner', () => {
  const layout = roomLayout('espresso');

  it.each([
    [1504, 884],
    [1920, 1080],
    [374, 775],
  ])('fits every grown plant and the can inside a %i×%i scene', (width, height) => {
    for (const slot of layout.slots(width, height)) {
      expect(slot.soilY - PLANT_HEIGHT * slot.scale).toBeGreaterThan(0);
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(width);
    }
    const can = layout.canHome(width, height);
    expect(can.y).toBeLessThan(height);
    expect(can.x).toBeLessThan(width);
  });

  it('shows the plants bigger on a big screen than on a phone', () => {
    const desktop = layout.slots(1504, 884)[0]!.scale;
    const phone = layout.slots(374, 775)[0]!.scale;
    expect(desktop).toBeGreaterThan(1.1);
    expect(desktop).toBeGreaterThan(phone);
  });
});
