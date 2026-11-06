// Three-tier wooden shelf with nine pots: three on each plank; saved plant indices stay unchanged.
import type { Ctx } from '../creatures/kit';
import type { PotKey } from '../pots';
import type { GardenLayout, LayoutSlot } from './kit';

import { SHELF_WOOD, woodGrain } from '../decor/materials';
import { POTS } from '../pots';

// Slot index → pot; slot order is the garden state's order, not the paint order
const POT_OF_SLOT: PotKey[] = [
  'terracotta',
  'white',
  'ceramic',
  'concrete',
  'terracotta',
  'white',
  'ceramic',
  'terracotta',
  'concrete',
];
const ROWS = { top: 0.25, middle: 0.54, bottom: 0.83 };
const FLOOR_Y = 0.925;
type Row = keyof typeof ROWS;
const ROW_OF_SLOT: Row[] = ['middle', 'middle', 'middle', 'bottom', 'bottom', 'bottom', 'top', 'top', 'top'];
const ROW_SCALE = { top: 1.4, middle: 1.4, bottom: 1.4 };
// Plants are drawn a little bigger than true to their pots (kept moderate so it doesn't look off); a grown plant
// may reach past the plank above, as on a real shelf
const PLANT_GROW = 1.15;
// Back to front, so lower rows paint over the vines hanging from higher ones
const PAINT_ORDER: Row[] = ['top', 'middle', 'bottom'];

export const PLANK_THICKNESS = 8;
const PLANK_DEPTH = 15,
  LEG_WIDTH = 12;

// Shelf wood (shared with the tall hanging stand), lit from the upper left like the plants
const WOOD = SHELF_WOOD;

function plank(c: Ctx, y: number, left: number, right: number) {
  const depth = PLANK_DEPTH,
    thickness = PLANK_THICKNESS;
  const top = c.createLinearGradient(0, y - depth, 0, y);
  top.addColorStop(0, WOOD.top[1]);
  top.addColorStop(1, WOOD.top[0]);
  c.fillStyle = top;
  c.beginPath();
  c.moveTo(left + 5, y - depth);
  c.lineTo(right - 5, y - depth);
  c.lineTo(right, y);
  c.lineTo(left, y);
  c.closePath();
  c.fill();
  woodGrain(c, left, y - depth, right - left, depth, y / 1000, { density: 4 });
  const face = c.createLinearGradient(0, y, 0, y + thickness);
  face.addColorStop(0, WOOD.face[0]);
  face.addColorStop(0.5, WOOD.face[1]);
  face.addColorStop(1, WOOD.face[2]);
  c.fillStyle = face;
  c.beginPath();
  c.roundRect(left, y, right - left, thickness, [0, 0, 2.5, 2.5]);
  c.fill();
  woodGrain(c, left, y, right - left, thickness, y / 997, { density: 5, knots: false });
  // Light falls from the left: the face fades darker toward the right end.
  const across = c.createLinearGradient(left, 0, right, 0);
  across.addColorStop(0, 'rgba(255,240,215,.12)');
  across.addColorStop(0.5, 'rgba(255,240,215,0)');
  across.addColorStop(1, 'rgba(40,20,10,.14)');
  c.fillStyle = across;
  c.fillRect(left, y, right - left, thickness);
  c.fillStyle = 'rgba(255,246,228,.45)';
  c.fillRect(left + 1, y, right - left - 2, 1);
  c.fillStyle = 'rgba(50,28,14,.28)';
  c.fillRect(left + 1, y + thickness - 1, right - left - 2, 1);
  const under = c.createLinearGradient(0, y + thickness, 0, y + thickness + 14);
  under.addColorStop(0, 'rgba(30,20,30,.26)');
  under.addColorStop(1, 'rgba(30,20,30,0)');
  c.fillStyle = under;
  c.fillRect(left + 4, y + thickness, right - left - 8, 14);
}

// Legs splay slightly outward toward the floor, for a steadier stance; returns the foot's centre x
function leg(
  c: Ctx,
  size: { width: number; height: number },
  x: number,
  top: number,
  bottom: number,
  legWidth: number,
  shadeBy: number,
) {
  const lean = ((x + legWidth / 2 - size.width / 2) * (bottom - top)) / (size.height * 12);
  const body = c.createLinearGradient(x, 0, x + legWidth, 0);
  body.addColorStop(0, WOOD.leg[1]);
  body.addColorStop(0.25, WOOD.leg[0]);
  body.addColorStop(0.7, WOOD.leg[1]);
  body.addColorStop(1, WOOD.leg[2]);
  c.save();
  c.transform(1, 0, lean / (bottom - top), 1, (-lean * top) / (bottom - top), 0);
  c.fillStyle = body;
  c.beginPath();
  c.roundRect(x, top, legWidth, bottom - top, [0, 0, 1.5, 1.5]);
  c.fill();
  woodGrain(c, x, top, legWidth, bottom - top, x / 977, { along: 'y', density: 5 });
  if (shadeBy) {
    c.fillStyle = `rgba(30,18,10,${shadeBy})`;
    c.fillRect(x, top, legWidth, bottom - top);
  }
  c.restore();
  return x + legWidth / 2 + lean;
}

function footShadow(c: Ctx, x: number, y: number, spread: number) {
  c.save();
  c.translate(x + spread * 0.3, y);
  c.scale(1, 0.25);
  const shadow = c.createRadialGradient(0, 0, 1, 0, 0, spread);
  shadow.addColorStop(0, 'rgba(25,15,20,.4)');
  shadow.addColorStop(1, 'rgba(25,15,20,0)');
  c.fillStyle = shadow;
  c.beginPath();
  c.arc(0, 0, spread, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

// A wooden frame: four slightly splayed legs, the back pair higher and darker so the frame reads as having
// depth, carrying planks (top first, given by their front edge); the top plank rests on the front legs.
// The plant shelf and the tall hanging stand are both built from it.
export function paintFrame(
  c: Ctx,
  size: { width: number; height: number },
  left: number,
  right: number,
  planks: number[],
  floorY: number,
) {
  const [topY, ...lower] = planks;
  for (const x of [left + 14, right - 14 - LEG_WIDTH]) {
    const footX = leg(c, size, x, topY - 4, floorY - 9, LEG_WIDTH - 1, 0.22);
    footShadow(c, footX, floorY - 9, 12);
  }
  for (const y of lower.reverse()) plank(c, y, left - 3, right + 3);
  for (const x of [left + 3, right - 3 - LEG_WIDTH]) {
    const footX = leg(c, size, x, topY + PLANK_THICKNESS - 2, floorY + 4, LEG_WIDTH, 0);
    footShadow(c, footX, floorY + 4, 15);
  }
  plank(c, topY, left - 3, right + 3);
}

function paintShelf(c: Ctx, width: number, height: number) {
  const planks = [ROWS.top, ROWS.middle, ROWS.bottom].map((row) => height * row);
  paintFrame(c, { width, height }, width * 0.05, width * 0.95, planks, height * FLOOR_Y);
}

// Longest vine on a shelf, in plant pixels; the hanging pots on the tall stand allow much longer ones
const SHELF_VINE = 105;

// A vine may hang over its own plank, but must stop above the next tier or the floor.
// In plant pixels, measured from the soil.
function hangRoom(row: Row, potKey: PotKey, height: number, scale: number, plantScale: number) {
  const nextRow = row === 'top' ? ROWS.middle : row === 'middle' ? ROWS.bottom : FLOOR_Y;
  const potHeight = POTS[potKey].height * scale;
  const freeBelowSoil = ((nextRow - ROWS[row]) * height - PLANK_DEPTH + potHeight) / plantScale;
  // On a shelf vines stay short enough not to curtain the plants on the tier below
  return Math.max(potHeight / plantScale, Math.min(SHELF_VINE, freeBelowSoil));
}

// Top and middle tiers hold three pots; the bottom tier has four spots, the last one for the watering can
function slotX(row: Row, at: number) {
  return row === 'bottom' ? 0.2 + at * 0.2 : 0.29 + at * 0.21;
}

// Where the can rests: the bottom tier's fourth spot
export function canSpot(width: number, height: number) {
  return { x: width * slotX('bottom', 3), y: height * ROWS.bottom - PLANK_DEPTH * 0.5 };
}

export const shelfLayout: GardenLayout = {
  slots(width, height) {
    const slots: LayoutSlot[] = [];
    for (const row of PAINT_ORDER) {
      ROW_OF_SLOT.forEach((slotRow, index) => {
        if (slotRow !== row) return;
        const pot = POTS[POT_OF_SLOT[index]];
        const scale = ROW_SCALE[row];
        const plantScale = scale * PLANT_GROW;
        // On a plank the pot stands mid-depth, not on the front edge
        const shelfY = height * ROWS[row] - PLANK_DEPTH * 0.5;
        slots.push({
          index,
          x: width * slotX(row, index % 3),
          soilY: shelfY - pot.height * scale,
          scale,
          plantScale,
          pot,
          hangRoom: hangRoom(row, POT_OF_SLOT[index], height, scale, plantScale),
        });
      });
    }
    return slots;
  },
  paintBackdrop: paintShelf,
  canHome: canSpot,
  canScale: 1.3,
};
