import type { PotKey } from '../pots';
import type { GardenLayout } from './kit';

import { POTS } from '../pots';

// One pot on its own, centred, no scenery: for a small floating window or a corner of the screen.

// Plant pixels a grown plant needs above the soil, plus the pot below it
const PLANT_HEIGHT = 130;

export function singleLayout(index: number, potKey: PotKey = 'terracotta'): GardenLayout {
  const pot = POTS[potKey];
  const scaleFor = (height: number) => height / (PLANT_HEIGHT + pot.height + 16);
  return {
    slots: (width, height) => {
      const scale = scaleFor(height);
      return [{ index, x: width * 0.45, soilY: height - (pot.height + 8) * scale, scale, pot, hangRoom: pot.height }];
    },
    paintBackdrop: () => {},
    canHome: (width, height) => ({ x: width * 0.86, y: height - 6 }),
    canScale: 1,
  };
}
