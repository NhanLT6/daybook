// Shared pieces for garden layouts: where each pot stands and what scenery sits behind it.
// The scene paints pots, plants, creatures, water and tools; a layout only decides positions and the backdrop,
// so a shelf, a window sill or a single pot in a corner all reuse the same scene.
import type { Ctx } from '../creatures/kit';
import type { Pot } from '../pots/kit';

export interface LayoutSlot {
  // Index into the garden state's plants: the same plant shows in every layout that places this index
  index: number;
  // Centre of the soil, in scene pixels
  x: number;
  soilY: number;
  scale: number;
  pot: Pot;
  // Plant pixels a trailing vine may hang below the soil before it hits something
  hangRoom: number;
}

export interface GardenLayout {
  // Slots for a scene of this size, in paint order: back to front
  slots: (width: number, height: number) => LayoutSlot[];
  // Fixed scenery behind the pots, painted once per size and theme
  paintBackdrop: (c: Ctx, width: number, height: number) => void;
  // Where the watering can rests (its base), and how big it is
  canHome: (width: number, height: number) => { x: number; y: number };
  canScale: number;
}
