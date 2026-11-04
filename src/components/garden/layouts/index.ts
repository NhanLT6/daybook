// Every layout the user can pick in Settings → Garden, in menu order: add or remove one here.
// More pots in a row is one more entry: { label: '2 plants', height: …, create: () => rowLayout(2) }.
import type { GardenLayout } from './kit';

import { balconyLayout } from './balcony';
import { rowLayout } from './row';

export interface GardenLayoutOption {
  label: string;
  // Fallback height when the canvas is not filling its page
  height: number;
  create: () => GardenLayout;
}

export const GARDEN_LAYOUTS = {
  shelf: { label: 'Balcony shelf', height: 640, create: () => balconyLayout },
  one: { label: 'One plant', height: 240, create: () => rowLayout(1) },
} satisfies Record<string, GardenLayoutOption>;

export type GardenLayoutKey = keyof typeof GARDEN_LAYOUTS;
