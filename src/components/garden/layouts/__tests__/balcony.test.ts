import { describe, expect, it } from 'vitest';

import { BALCONY, balconyLayout, createBalconySpace } from '../balcony';
import { shelfLayout } from '../shelf';

describe('three-tier shelf in the balcony', () => {
  it('supports all nine saved plant slots on three raised tiers, with vines clear of the next tier', () => {
    const slots = shelfLayout.slots(340, 620);
    expect(slots.map((slot) => slot.index).sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const tiers = new Map<number, typeof slots>();
    for (const slot of slots) {
      const base = Math.round(slot.soilY + slot.pot.height * slot.scale);
      tiers.set(base, [...(tiers.get(base) ?? []), slot]);
    }
    expect(tiers.size).toBe(3);
    const supports = [...tiers.keys()].sort((a, b) => a - b);
    supports.forEach((base, index) => {
      expect(tiers.get(base)).toHaveLength(3);
      if (index > 0) {
        for (const slot of tiers.get(base)!) {
          expect(slot.soilY - 130 * slot.scale).toBeGreaterThan(supports[index - 1]! + 8);
        }
      }
      const nextSurface = supports[index + 1] ?? 620 * 0.925;
      for (const slot of tiers.get(base)!) {
        expect(slot.soilY + slot.hangRoom * slot.scale).toBeLessThan(nextSurface);
      }
    });
    expect(supports[2]).toBeLessThan(620 * 0.925 - 20);
  });

  it.each([
    [1344, 984],
    [374, 775],
    [1920, 1080],
  ])('keeps the rack clear of the railing and door at %s×%s', (width, height) => {
    const space = createBalconySpace(width, height);
    const slots = balconyLayout.slots(width, height);
    expect(space.project([0, BALCONY.height, 0]).y).toBeLessThan(0);
    expect(space.project([0, 0, 0]).y).toBeGreaterThan(height);
    const leftJoin = space.project([-1, 0, BALCONY.depth]);
    const rightJoin = space.project([1, 0, BALCONY.depth]);
    for (const slot of slots) {
      expect(slot.x - 100 * slot.scale).toBeGreaterThan(leftJoin.x);
      expect(slot.x + 100 * slot.scale).toBeLessThan(rightJoin.x);
      expect(slot.soilY - 130 * slot.scale).toBeGreaterThan(0);
    }
    const feet = space.project([0, 0, BALCONY.shelfDepth]);
    expect(space.shelf.y + (620 * 0.925 + 4) * space.shelf.scale).toBeCloseTo(feet.y);
    expect(balconyLayout.canHome(width, height).y).toBeCloseTo(feet.y);
    const doorBottom = space.project([1, 0, BALCONY.shelfDepth]);
    const doorTop = space.project([1, BALCONY.doorHeight, BALCONY.shelfDepth]);
    const topSupport = Math.min(...slots.map((slot) => slot.soilY + slot.pot.height * slot.scale));
    const rackHeightRatio = (feet.y - topSupport) / (doorBottom.y - doorTop.y);
    expect(rackHeightRatio).toBeGreaterThan(0.59);
    expect(rackHeightRatio).toBeLessThan(0.65);
  });
});
