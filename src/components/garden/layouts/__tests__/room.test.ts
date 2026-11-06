import { describe, expect, it } from 'vitest';

import { HANGING_SLOTS } from '../kit';
import { roomLayout } from '../room';
import { shelfLayout } from '../shelf';

// Plant pixels the tallest grown plant reaches above its soil (bougainvillea, dandelion: about 82)
const PLANT_HEIGHT = 85;

describe('three-tier shelf', () => {
  it('keeps all nine plant slots on three tiers, vines clear of the next tier', () => {
    const height = 700;
    const slots = shelfLayout.slots(420, height);
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
        expect(slot.soilY + slot.hangRoom * (slot.plantScale ?? slot.scale)).toBeLessThan(nextSurface);
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
      expect(slot.soilY - PLANT_HEIGHT * slot.plantScale!).toBeGreaterThan(0);
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(width);
    }
    const can = layout.canHome(width, height);
    expect(can.y).toBeLessThan(height);
    expect(can.x).toBeLessThan(width);
  });

  it('shows the plants bigger on a big screen than on a phone', () => {
    const plantScale = (width: number, height: number) =>
      layout.slots(width, height).find((slot) => slot.index === 0)!.plantScale!;
    expect(plantScale(1504, 884)).toBeGreaterThan(1.5);
    expect(plantScale(1504, 884)).toBeGreaterThan(plantScale(374, 775));
  });

  it('hangs two pots from the tall stand on wide screens only', () => {
    const hanging = (width: number, height: number) =>
      layout.slots(width, height).filter((slot) => HANGING_SLOTS.includes(slot.index));
    expect(hanging(1504, 884)).toHaveLength(2);
    expect(hanging(374, 775)).toHaveLength(0);
    // Vines from the top pot stop above the lower pot
    const [top, lower] = hanging(1504, 884);
    expect(top!.soilY + top!.hangRoom * top!.plantScale!).toBeLessThan(lower!.soilY);
  });
});
