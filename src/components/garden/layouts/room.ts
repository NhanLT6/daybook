// A corner of a room seen straight on: the three-tier plant shelf on the left, a low cabinet on the right
// with a window above it and one item on top (espresso machine or monitor), plastered wall and oak floor.
// On narrow screens there is no room for the cabinet, so the shelf stands alone in the middle.
import type { Ctx } from '../creatures/kit';
import type { DecorKey } from '../decor';
import type { GardenLayout } from './kit';

import { DECOR } from '../decor';
import { CABINET, paintCabinet } from '../decor/cabinet';
import { plaster, woodGrain } from '../decor/materials';
import { glassOf, paintWindowFrame, paintWindowView, WINDOW_REACH } from '../decor/window';
import { seeded } from '../plants/wood';
import { shelfLayout } from './shelf';

// Room units match the shelf drawing's own pixels (floor at 0.925 of its height)
const SHELF = { width: 420, height: 700, floor: 700 * 0.925 };
// Cabinet, its item and the window are a bit smaller than true scale, so the plants stay the main thing
const FURNITURE = 0.85;
const MARGIN = 40,
  GAP = 170,
  // Head room above the tallest top-tier plant
  TOP = 52,
  // How far the wall's foot sits behind the furniture's feet
  FLOOR_DEPTH = 90;
const ROOM_WIDTH = MARGIN * 2 + SHELF.width + GAP + CABINET.width * FURNITURE;

// Day palette; night darkens it in one pass, keeping the window and screens bright
const WALL = ['#F1EBDF', '#E7DECF'];
const FLOOR = ['#CBA47B', '#BE946A', '#B48A60', '#C79E74'];

interface Plan {
  // Pixels per room unit
  unit: number;
  footY: number;
  wallFoot: number;
  shelfX: number;
  shelfY: number;
  // Centre of the cabinet's foot, when there is room for it
  cabinet?: { x: number; y: number };
}

function plan(width: number, height: number): Plan {
  const footY = height * 0.92;
  const byHeight = (footY - height * 0.02) / (SHELF.floor + TOP);
  const withCabinet = width / ROOM_WIDTH >= byHeight * 0.6;
  const unit = withCabinet ? Math.min(byHeight, width / ROOM_WIDTH) : Math.min(byHeight, width / (SHELF.width + 30));
  const contentWidth = (withCabinet ? ROOM_WIDTH - MARGIN * 2 : SHELF.width) * unit;
  const left = (width - contentWidth) / 2;

  return {
    unit,
    footY,
    wallFoot: footY - FLOOR_DEPTH * unit,
    shelfX: left,
    shelfY: footY - SHELF.floor * unit,
    cabinet: withCabinet ? { x: left + (SHELF.width + GAP + (CABINET.width * FURNITURE) / 2) * unit, y: footY } : undefined,
  };
}

function paintWall(c: Ctx, width: number, wallFoot: number) {
  const wall = c.createLinearGradient(0, 0, 0, wallFoot);
  wall.addColorStop(0, WALL[0]);
  wall.addColorStop(1, WALL[1]);
  c.fillStyle = wall;
  c.fillRect(0, 0, width, wallFoot);
  plaster(c, 0, 0, width, wallFoot, 0.61);
}

// Skirting board along the wall's foot
function paintSkirting(c: Ctx, width: number, wallFoot: number, unit: number) {
  const height = 22 * unit;
  c.fillStyle = '#F6F2EA';
  c.fillRect(0, wallFoot - height, width, height);
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, wallFoot - height, width, Math.max(1, 2 * unit));
  c.fillStyle = 'rgba(90,75,55,.18)';
  c.fillRect(0, wallFoot - Math.max(1, 1.5 * unit), width, Math.max(1, 1.5 * unit));
}

// Oak boards running along the wall; rows get deeper toward the viewer, joints are staggered
function paintFloor(c: Ctx, width: number, height: number, wallFoot: number, unit: number) {
  const random = seeded(0.17);
  const depth = height - wallFoot;
  let y = wallFoot;
  while (y < height) {
    const near = (y - wallFoot) / depth;
    const rowHeight = Math.max(4, (9 + near * 26) * unit);
    let x = -random() * 300 * unit;
    while (x < width) {
      const boardLength = (220 + random() * 260) * unit * (1 + near * 0.6);
      c.fillStyle = FLOOR[Math.floor(random() * FLOOR.length)];
      c.fillRect(x, y, boardLength, rowHeight);
      woodGrain(c, x, y, boardLength, rowHeight, random(), { density: 4 / Math.max(unit, 0.5), knots: false });
      c.fillStyle = 'rgba(70,40,20,.35)';
      c.fillRect(x, y, Math.max(1, unit), rowHeight);
      x += boardLength;
    }
    c.fillStyle = 'rgba(70,40,20,.3)';
    c.fillRect(0, y, width, Math.max(1, unit * 0.8));
    y += rowHeight;
  }

  // Darker where the floor meets the wall, a soft sheen nearer the viewer
  const depthShade = c.createLinearGradient(0, wallFoot, 0, height);
  depthShade.addColorStop(0, 'rgba(60,40,20,.28)');
  depthShade.addColorStop(0.35, 'rgba(60,40,20,.06)');
  depthShade.addColorStop(1, 'rgba(255,240,220,.08)');
  c.fillStyle = depthShade;
  c.fillRect(0, wallFoot, width, depth);
}

// Soft oval shadow on the floor under a piece of furniture
function floorShadow(c: Ctx, x: number, y: number, halfWidth: number, unit: number) {
  c.save();
  c.translate(x, y);
  c.scale(1, 0.09);
  const shadow = c.createRadialGradient(0, 0, 0, 0, 0, halfWidth);
  shadow.addColorStop(0, 'rgba(50,30,15,.35)');
  shadow.addColorStop(1, 'rgba(50,30,15,0)');
  c.fillStyle = shadow;
  c.fillRect(-halfWidth, -halfWidth, halfWidth * 2, halfWidth * 2);
  c.restore();
  // A little contact darkening right at the feet
  c.fillStyle = 'rgba(40,25,10,.12)';
  c.fillRect(x - halfWidth * 0.8, y - unit, halfWidth * 1.6, unit * 2);
}

// Where the window hangs: centred over the cabinet, about a quarter wider than it, its sill just above the
// cabinet top (like a window behind a counter). It always shows whole, rod included, and shrinks on short
// screens; the curtains keep a strip of bare wall between them and the shelf.
function windowBox(p: Plan, width: number, height: number) {
  const cabinet = p.cabinet!;
  const scale = p.unit * FURNITURE;
  const sill = cabinet.y - (CABINET.height + 30) * scale;
  const top = height * 0.04 + WINDOW_REACH.top * scale;

  const shelfRight = p.shelfX + SHELF.width * p.unit;
  const roomLeft = shelfRight + 40 * p.unit + WINDOW_REACH.side * scale;
  const roomRight = width - 12 - WINDOW_REACH.side * scale;
  const halfWidth = Math.min(CABINET.width * 0.625 * scale, cabinet.x - roomLeft, roomRight - cabinet.x);

  const size = { width: (halfWidth * 2) / scale, height: (sill - top) / scale };
  return { x: cabinet.x - halfWidth, y: top, scale, size };
}

// Furniture, window frame and curtains are painted on their own layer, then laid on the room in one go:
// by day with one soft shadow cast to the lower right (sun from the upper left), at night darkened only
// where something was painted.
function furniture(c: Ctx, dark: boolean, unit: number, paint: (target: Ctx) => void) {
  const layer = document.createElement('canvas');
  layer.width = c.canvas.width;
  layer.height = c.canvas.height;
  const target = layer.getContext('2d')!;
  target.setTransform(c.getTransform());
  paint(target);
  target.setTransform(1, 0, 0, 1, 0, 0);
  if (dark) {
    target.globalCompositeOperation = 'source-atop';
    target.fillStyle = 'rgba(30,36,48,.52)';
    target.fillRect(0, 0, layer.width, layer.height);
  }

  const ratio = c.getTransform().a;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (!dark) {
    c.shadowColor = 'rgba(80,55,30,.3)';
    c.shadowBlur = 10 * unit * ratio;
    c.shadowOffsetX = 26 * unit * ratio;
    c.shadowOffsetY = 8 * unit * ratio;
  }
  c.drawImage(layer, 0, 0);
  c.restore();
}

// Fill a shape with soft edges, on every browser: the shape is drawn far off to the left and only its blurred
// shadow lands in place
function softFill(c: Ctx, color: string, blur: number, shape: (offset: number) => void) {
  const far = 20000;
  const ratio = c.getTransform().a;
  c.save();
  c.shadowColor = color;
  c.shadowBlur = blur * ratio;
  c.shadowOffsetX = far * ratio;
  c.fillStyle = '#000';
  c.beginPath();
  shape(-far);
  c.fill();
  c.restore();
}

// Sunlight through a window off to the upper left: a slanted two-by-two pane patch on the wall behind the
// shelf, and a longer one stretched across the floor in front of it. Makes the shelf the brightest place.
function paintSunlight(c: Ctx, p: Plan, height: number) {
  const { unit } = p;
  const left = p.shelfX - 70 * unit,
    patchWidth = (SHELF.width + 150) * unit;
  const top = height * 0.1,
    bottom = p.wallFoot;
  const slant = (bottom - top) * 0.32;
  const bar = 9 * unit;

  softFill(c, 'rgba(255,224,165,.5)', 7 * unit, (offset) => {
    for (const [col, row] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const x0 = left + col * (patchWidth / 2 + bar / 2) + offset,
        w = patchWidth / 2 - bar / 2;
      const y0 = top + row * ((bottom - top) / 2 + bar / 2),
        h = (bottom - top) / 2 - bar / 2;
      // The patch leans: lower rows sit further right, as light falling from the upper left would
      const shift = (y: number) => ((y - top) / (bottom - top)) * slant;
      c.moveTo(x0 + shift(y0), y0);
      c.lineTo(x0 + w + shift(y0), y0);
      c.lineTo(x0 + w + shift(y0 + h), y0 + h);
      c.lineTo(x0 + shift(y0 + h), y0 + h);
      c.closePath();
    }
  });

  // On the floor the same light lies flatter and longer, toward the viewer
  softFill(c, 'rgba(255,224,165,.32)', 10 * unit, (offset) => {
    const y0 = p.wallFoot + 4 * unit,
      y1 = height;
    c.moveTo(left + slant + offset, y0);
    c.lineTo(left + slant + patchWidth + offset, y0);
    c.lineTo(left + slant + patchWidth * 1.35 + offset, y1);
    c.lineTo(left + slant + patchWidth * 0.2 + offset, y1);
    c.closePath();
  });
}

// Light falls off away from the sunny corner: warm at the upper left, a touch darker at the right and the bottom
function paintFalloff(c: Ctx, width: number, height: number) {
  const warm = c.createRadialGradient(width * 0.2, height * 0.15, 0, width * 0.2, height * 0.15, width * 0.6);
  warm.addColorStop(0, 'rgba(255,238,205,.28)');
  warm.addColorStop(1, 'rgba(255,238,205,0)');
  c.fillStyle = warm;
  c.fillRect(0, 0, width, height);

  const fade = c.createLinearGradient(width * 0.45, 0, width, 0);
  fade.addColorStop(0, 'rgba(70,50,30,0)');
  fade.addColorStop(1, 'rgba(70,50,30,.16)');
  c.fillStyle = fade;
  c.fillRect(0, 0, width, height);

  const floor = c.createLinearGradient(0, height * 0.75, 0, height);
  floor.addColorStop(0, 'rgba(60,40,20,0)');
  floor.addColorStop(1, 'rgba(60,40,20,.14)');
  c.fillStyle = floor;
  c.fillRect(0, height * 0.75, width, height * 0.25);
}

function paintRoom(c: Ctx, width: number, height: number, decorKey: DecorKey, dark: boolean) {
  const p = plan(width, height);
  const { unit } = p;
  const decor = DECOR[decorKey];
  const pane = p.cabinet ? windowBox(p, width, height) : null;

  paintWall(c, width, p.wallFoot);
  if (pane) {
    // Daylight from the window warms the wall around it
    const cx = pane.x + (pane.size.width * pane.scale) / 2,
      cy = pane.y + (pane.size.height * pane.scale) / 2;
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, width * 0.45);
    glow.addColorStop(0, 'rgba(255,250,232,.3)');
    glow.addColorStop(1, 'rgba(255,250,232,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, width, p.wallFoot);
    c.save();
    c.translate(pane.x, pane.y);
    c.scale(pane.scale, pane.scale);
    paintWindowView(c, pane.size, dark);
    c.restore();
  }
  paintSkirting(c, width, p.wallFoot, unit);
  paintFloor(c, width, height, p.wallFoot, unit);
  if (!dark) paintSunlight(c, p, height);

  floorShadow(c, p.shelfX + (SHELF.width / 2) * unit, p.footY, SHELF.width * 0.62 * unit, unit);
  if (p.cabinet) {
    floorShadow(c, p.cabinet.x, p.cabinet.y, CABINET.width * FURNITURE * 0.62 * unit, unit);
  }

  if (dark) {
    // Night: multiply the whole room toward slate, lighter near the window, leaving the glass as painted
    c.save();
    c.beginPath();
    c.rect(0, 0, width, height);
    if (pane) {
      const glass = glassOf(pane.size);
      c.rect(pane.x + glass.x * pane.scale, pane.y + glass.y * pane.scale, glass.w * pane.scale, glass.h * pane.scale);
    }
    c.clip('evenodd');
    const cx = pane ? pane.x + (pane.size.width * pane.scale) / 2 : width / 2;
    const cy = pane ? pane.y + (pane.size.height * pane.scale) / 2 : height * 0.3;
    const night = c.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(width, height) * 0.7);
    night.addColorStop(0, '#8A93A3');
    night.addColorStop(0.5, '#56606F');
    night.addColorStop(1, '#3E4654');
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = night;
    c.fillRect(0, 0, width, height);
    c.restore();
  }

  // Frame, curtains and furniture darken as one layer at night, so only the glass stays bright
  furniture(c, dark, unit, (t) => {
    if (pane) {
      t.save();
      t.translate(pane.x, pane.y);
      t.scale(pane.scale, pane.scale);
      paintWindowFrame(t, pane.size);
      t.restore();
    }

    t.save();
    t.translate(p.shelfX, p.shelfY);
    t.scale(unit, unit);
    shelfLayout.paintBackdrop(t, SHELF.width, SHELF.height, dark);
    t.restore();

    if (p.cabinet) {
      t.save();
      t.translate(p.cabinet.x, p.cabinet.y);
      t.scale(unit * FURNITURE, unit * FURNITURE);
      paintCabinet(t);
      t.translate(0, -CABINET.height);
      decor.paint(t, dark);
      t.restore();
    }
  });

  if (!dark) paintFalloff(c, width, height);

  if (p.cabinet && decor.lit) {
    c.save();
    c.translate(p.cabinet.x, p.cabinet.y - CABINET.height * FURNITURE * unit);
    c.scale(unit * FURNITURE, unit * FURNITURE);
    decor.lit(c, dark);
    c.restore();
  }
}

export function roomLayout(decor: DecorKey): GardenLayout {
  return {
    slots(width, height) {
      const p = plan(width, height);
      return shelfLayout.slots(SHELF.width, SHELF.height).map((slot) => ({
        ...slot,
        x: p.shelfX + slot.x * p.unit,
        soilY: p.shelfY + slot.soilY * p.unit,
        scale: slot.scale * p.unit,
        plantScale: (slot.plantScale ?? slot.scale) * p.unit,
      }));
    },
    paintBackdrop: (c, width, height, dark) => paintRoom(c, width, height, decor, dark),
    canHome(width, height) {
      const p = plan(width, height);
      // On the floor between the shelf and the cabinet; alone, inside the shelf's lower tier
      if (p.cabinet) return { x: p.shelfX + (SHELF.width + GAP * 0.45) * p.unit, y: p.footY + 2 * p.unit };
      const point = shelfLayout.canHome(SHELF.width, SHELF.height);
      return { x: p.shelfX + point.x * p.unit, y: p.shelfY + point.y * p.unit };
    },
    canScale: shelfLayout.canScale,
    toolScale: (width, height) => plan(width, height).unit,
    maxVisitors: 5,
  };
}
