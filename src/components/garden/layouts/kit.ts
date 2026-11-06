// Shared pieces for garden layouts: where each pot stands and what scenery sits behind it.
// The scene paints pots, plants, creatures, water and tools; a layout only decides positions and the backdrop,
// so a shelf, a window sill or a single pot in a corner all reuse the same scene.
import type { Ctx } from '../creatures/kit';
import type { Daylight } from './daylight';
import type { Pot } from '../pots/kit';

// Plant indices that hang from the tall stand: only trailing plants are offered there
export const HANGING_SLOTS = [9, 10];

export interface LayoutSlot {
  // Index into the garden state's plants: the same plant shows in every layout that places this index
  index: number;
  // Centre of the soil, in scene pixels
  x: number;
  soilY: number;
  scale: number;
  // Plant pixels to scene pixels; left out, the plant matches its pot (scale). Bigger lets grown plants
  // spill over the shelf like real ones do
  plantScale?: number;
  pot: Pot;
  // Plant pixels a trailing vine may hang below the soil before it hits something
  hangRoom: number;
}

interface Point {
  x: number;
  y: number;
}
export interface LightShaft {
  top: [Point, Point];
  bottom: [Point, Point];
}

export interface GardenLayout {
  // Slots for a scene of this size, in paint order: back to front
  slots: (width: number, height: number) => LayoutSlot[];
  // Fixed scenery behind the pots, painted once per size and theme
  // light: the part of the day by day (see ./daylight), null in dark mode
  paintBackdrop: (c: Ctx, width: number, height: number, dark: boolean, light?: Daylight | null) => void;
  // Light and shade multiplied over everything, plants included: white where the light falls, darker away from it
  paintLight?: (c: Ctx, width: number, height: number, dark: boolean, light?: Daylight | null) => void;
  // Where the watering can rests (its base), and how big it is
  canHome: (width: number, height: number) => { x: number; y: number };
  canScale: number;
  // Optional scene transform for tools when a layout embeds a scaled arrangement.
  toolScale?: (width: number, height: number) => number;
  // Light comes from the right (a window on that side): pots and plants, which are painted lit from the upper
  // left, are drawn mirrored so their highlights face the light
  lightFromRight?: boolean;
  // Where a plant's shadow falls on the wall behind it, in plant pixels (before mirroring); none by night
  castShadow?: { x: number; y: number };
  // A sunbeam as two edges, top (at the window) and bottom (on the floor), each left point then right; the scene
  // lets dust drift in it by day
  lightShaft?: (width: number, height: number, slant?: number) => LightShaft | null;
  // Moving scenery painted every frame behind the pots and plants: a tree stirring in the wind. `sun` is how
  // strong the light is for its shadows (0 none)
  paintBehind?: (c: Ctx, width: number, height: number, time: number, sun: number) => void;
  // Moving shade painted every frame by day, over the pots and plants but under the light map: leaf shadows
  // stirring on the courtyard floor. `strength` follows the sun's.
  paintShade?: (c: Ctx, width: number, height: number, time: number, strength: number) => void;
  // Most insects out at once; left out for no limit
  maxVisitors?: number;
}
