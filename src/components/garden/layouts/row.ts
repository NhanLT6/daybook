import type { PotKey } from '../pots';
import type { GardenLayout } from './kit';

import { POTS } from '../pots';

// A row of 1–3 pots standing on the surface, no scenery. Plants are the first `count` slots of the garden
// state, so going from 1 to 3 pots keeps the plant you already have in the first pot.

// Plant pixels a grown plant needs above the soil, plus room for the pot and its shadow
const PLANT_HEIGHT = 130;
const POT_OF_SLOT: PotKey[] = ['terracotta', 'white', 'ceramic'];
// Plant pixels each pot needs across, so leaves of neighbours don't run into each other
const PLANT_WIDTH = 90;

export function rowLayout(count: 1 | 2 | 3): GardenLayout {
  return {
    slots(width, height) {
      const tallest = Math.max(...POT_OF_SLOT.slice(0, count).map((key) => POTS[key].height));
      // As big as the height allows, but never so big that the plants crowd the width
      const scale = Math.min(height / (PLANT_HEIGHT + tallest + 16), width / (count * PLANT_WIDTH + 20));
      return POT_OF_SLOT.slice(0, count).map((key, index) => {
        const pot = POTS[key];
        return {
          index,
          x: (width * (index + 1)) / (count + 1) - (count === 1 ? width * 0.04 : 0),
          soilY: height - (pot.height + 10) * scale,
          scale,
          pot,
          hangRoom: pot.height,
        };
      });
    },
    paintBackdrop: () => {},
    canHome: (width, height) => ({ x: width * 0.88, y: height - 8 }),
    canScale: 1.3,
    // A lone plant with a crowd of insects looks wrong: one visitor at a time, one more per extra pot
    maxVisitors: count,
  };
}
