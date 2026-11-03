// Two-tier wooden shelf with nine pots: three on each plank and three on the floor in front.
import type { Ctx } from '../creatures/kit';
import type { PotKey } from '../pots';
import type { GardenLayout, LayoutSlot } from './kit';

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
const ROWS = { top: 0.33, middle: 0.62, floor: 0.925 };
type Row = keyof typeof ROWS;
const ROW_OF_SLOT: Row[] = ['middle', 'middle', 'middle', 'floor', 'floor', 'floor', 'top', 'top', 'top'];
const ROW_SCALE = { top: 0.9, middle: 1, floor: 1.12 };
// Back to front, so lower rows paint over the vines hanging from higher ones
const PAINT_ORDER: Row[] = ['top', 'middle', 'floor'];

const PLANK_DEPTH = 15,
  PLANK_THICKNESS = 8,
  LEG_WIDTH = 12;

// Shelf wood, lit from the upper left like the plants; night darkens it through the scene's tint.
const WOOD = {
  top: ['#E9C08F', '#D6A774'],
  face: ['#DDAE79', '#C08A55', '#A8733F'],
  leg: ['#D9A872', '#B27C48', '#8E5E33'],
};

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
  const face = c.createLinearGradient(0, y, 0, y + thickness);
  face.addColorStop(0, WOOD.face[0]);
  face.addColorStop(0.5, WOOD.face[1]);
  face.addColorStop(1, WOOD.face[2]);
  c.fillStyle = face;
  c.beginPath();
  c.roundRect(left, y, right - left, thickness, [0, 0, 2.5, 2.5]);
  c.fill();
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

function paintShelf(c: Ctx, width: number, height: number) {
  const size = { width, height };
  const left = width * 0.05,
    right = width * 0.95;
  const topY = height * ROWS.top,
    floorY = height * ROWS.floor;

  // Back legs sit higher and darker, so the shelf reads as having depth.
  for (const x of [left + 14, right - 14 - LEG_WIDTH]) {
    const footX = leg(c, size, x, topY - 4, floorY - 9, LEG_WIDTH - 1, 0.22);
    footShadow(c, footX, floorY - 9, 12);
  }
  plank(c, height * ROWS.middle, left - 3, right + 3);
  for (const x of [left + 3, right - 3 - LEG_WIDTH]) {
    const footX = leg(c, size, x, topY + PLANK_THICKNESS - 2, floorY + 4, LEG_WIDTH, 0);
    footShadow(c, footX, floorY + 4, 15);
  }
  plank(c, topY, left - 3, right + 3);
}

// How far a trailing vine may hang: from the top shelf past the plank toward the middle one, from the middle
// shelf a little less, on the floor only down the pot
function hangRoom(row: Row, potKey: PotKey) {
  if (row === 'top') return 105;
  if (row === 'middle') return 90;
  return POTS[potKey].height;
}

export const shelfLayout: GardenLayout = {
  slots(width, height) {
    const slots: LayoutSlot[] = [];
    for (const row of PAINT_ORDER) {
      ROW_OF_SLOT.forEach((slotRow, index) => {
        if (slotRow !== row) return;
        const pot = POTS[POT_OF_SLOT[index]];
        const scale = ROW_SCALE[row];
        // On a plank the pot stands mid-depth, not on the front edge
        const shelfY = height * ROWS[row] - (row === 'floor' ? 0 : PLANK_DEPTH * 0.5);
        slots.push({
          index,
          x: width * (0.29 + (index % 3) * 0.21),
          soilY: shelfY - pot.height * scale,
          scale,
          pot,
          hangRoom: hangRoom(row, POT_OF_SLOT[index]),
        });
      });
    }
    return slots;
  },
  paintBackdrop: paintShelf,
  canHome: (width, height) => ({ x: width * 0.87, y: height * ROWS.floor + 2 }),
  canScale: 1.3,
};
