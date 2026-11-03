// Every layout the user can pick in Settings → Garden, in menu order: add or remove one here.
// More pots in a row is one more entry: { label: '2 plants', height: …, create: () => rowLayout(2) }.
import type { GardenLayout } from './kit';

import { rowLayout } from './row';
import { shelfLayout } from './shelf';

export interface GardenLayoutOption {
  label: string;
  // Canvas height in the Insights column
  height: number;
  create: () => GardenLayout;
}

export const GARDEN_LAYOUTS = {
  one: { label: 'One plant', height: 240, create: () => rowLayout(1) },
  shelf: { label: 'Shelf', height: 340, create: () => shelfLayout },
} satisfies Record<string, GardenLayoutOption>;

export type GardenLayoutKey = keyof typeof GARDEN_LAYOUTS;
