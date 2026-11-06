// Garden layouts the user can pick in Settings → Garden. Plants keep their slot index in every layout.
// More pots in a row is one more entry: { label: '2 plants', height: …, create: () => rowLayout(2) }.
import type { GardenLayout } from './kit';

import { roomLayout } from './room';
import { rowLayout } from './row';

export interface GardenLayoutOption {
  label: string;
  // Fallback height when the canvas is not filling its page
  height: number;
  create: () => GardenLayout;
}

export const GARDEN_LAYOUTS = {
  shelf: { label: 'Coffee corner', height: 640, create: () => roomLayout('espresso') },
  one: { label: 'One plant', height: 240, create: () => rowLayout(1) },
} satisfies Record<string, GardenLayoutOption>;

export type GardenLayoutKey = keyof typeof GARDEN_LAYOUTS;
