// A corner of a room seen straight on: a tall hanging stand with two trailing plants at the far left, the
// three-tier plant shelf, and a low cabinet on the right with a window above it and one item on top (espresso
// machine or monitor); plastered wall and oak floor. On narrow screens only the shelf stands, in the middle.
import type { Ctx } from '../creatures/kit';
import type { DecorKey } from '../decor';
import type { GardenLayout, LayoutSlot } from './kit';

import { DECOR } from '../decor';
import { CABINET, paintCabinet } from '../decor/cabinet';
import { plaster, woodGrain } from '../decor/materials';
import { paintStand, STAND } from '../decor/stand';
import { glassOf, paintWindowFrame, paintWindowView, WINDOW_REACH } from '../decor/window';
import { POTS } from '../pots';
import { seeded } from '../plants/wood';
import { HANGING_SLOTS } from './kit';
import { shelfLayout } from './shelf';

// Room units match the shelf drawing's own pixels (floor at 0.925 of its height)
const SHELF = { width: 420, height: 700, floor: 700 * 0.925 };
// Cabinet, its item and the window are a bit smaller than true scale, so the plants stay the main thing
const FURNITURE = 0.85;
const MARGIN = 40,
  GAP = 170,
  // Between the hanging stand and the shelf
  STAND_GAP = 60,
  // Head room above the tallest top-tier plant
  TOP = 52,
  // How far the wall's foot sits behind the furniture's feet
  FLOOR_DEPTH = 90;
const ROOM_WIDTH = MARGIN * 2 + STAND.width + STAND_GAP + SHELF.width + GAP + CABINET.width * FURNITURE;

// Hanging pots: the shelf's pot size and plant growth
const HANG_POT = POTS.bowl,
  HANG_SCALE = 1.4,
  HANG_GROW = 1.15;

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
  // Centres of the hanging stand's and the cabinet's feet, when there is room for them
  stand?: { x: number; y: number };
  cabinet?: { x: number; y: number };
}

function plan(width: number, height: number): Plan {
  const footY = height * 0.92;
  const byHeight = (footY - height * 0.02) / (SHELF.floor + TOP);
  const withCabinet = width / ROOM_WIDTH >= byHeight * 0.6;
  const unit = withCabinet ? Math.min(byHeight, width / ROOM_WIDTH) : Math.min(byHeight, width / (SHELF.width + 30));
  const contentWidth = (withCabinet ? ROOM_WIDTH - MARGIN * 2 : SHELF.width) * unit;
  const left = (width - contentWidth) / 2;
  const shelfX = withCabinet ? left + (STAND.width + STAND_GAP) * unit : left;

  return {
    unit,
    footY,
    wallFoot: footY - FLOOR_DEPTH * unit,
    shelfX,
    shelfY: footY - SHELF.floor * unit,
    stand: withCabinet ? { x: left + (STAND.width / 2) * unit, y: footY } : undefined,
    cabinet: withCabinet
      ? { x: shelfX + (SHELF.width + GAP + (CABINET.width * FURNITURE) / 2) * unit, y: footY }
      : undefined,
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
// by day with one soft shadow cast to the lower left (light from the window on the right), at night darkened only
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
    c.shadowOffsetX = -26 * unit * ratio;
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

type Pane = ReturnType<typeof windowBox>;

// Sunlight from the window on the right: a soft shaft from the glass down to the floor, and the window's three
// panes laid on the floor as a slanted patch running left toward the shelf. The cabinet, painted later, stands
// in front of part of it.
function paintSunlight(c: Ctx, p: Plan, pane: Pane, height: number) {
  const { unit } = p;
  const glass = glassOf(pane.size);
  const gx = pane.x + glass.x * pane.scale,
    gy = pane.y + glass.y * pane.scale,
    gw = glass.w * pane.scale,
    gh = glass.h * pane.scale;

  // Floor patch: the far edge sits at the wall's foot, shifted left; the near edge further left and wider
  const far = { y: p.wallFoot + 4 * unit, left: gx - gw * 0.8, width: gw };
  const near = { y: height, left: gx - gw * 1.95, width: gw * 1.3 };
  const bar = 8 * unit;
  softFill(c, 'rgba(255,224,165,.5)', 8 * unit, (offset) => {
    for (let column = 0; column < 3; column++) {
      const from = column / 3,
        to = (column + 1) / 3;
      const edge = (row: typeof far, at: number, gap: number) => row.left + row.width * at + gap + offset;
      c.moveTo(edge(far, from, column ? bar / 2 : 0), far.y);
      c.lineTo(edge(far, to, column < 2 ? -bar / 2 : 0), far.y);
      c.lineTo(edge(near, to, column < 2 ? -bar / 2 : 0), near.y);
      c.lineTo(edge(near, from, column ? bar / 2 : 0), near.y);
      c.closePath();
    }
  });

  // The shaft: a faint warm band from the glass to the patch
  const shaft = c.createLinearGradient(gx + gw / 2, gy, near.left + near.width / 2, near.y);
  shaft.addColorStop(0, 'rgba(255,236,200,.24)');
  shaft.addColorStop(1, 'rgba(255,236,200,0)');
  c.fillStyle = shaft;
  c.beginPath();
  c.moveTo(gx, gy);
  c.lineTo(gx + gw, gy + gh * 0.3);
  c.lineTo(near.left + near.width, near.y);
  c.lineTo(near.left, near.y);
  c.closePath();
  c.fill();
}

// Light falls off away from the window: warm between the window and the shelf, a touch darker at the far left
// and the bottom
function paintFalloff(c: Ctx, width: number, height: number) {
  const warm = c.createRadialGradient(width * 0.62, height * 0.35, 0, width * 0.62, height * 0.35, width * 0.55);
  warm.addColorStop(0, 'rgba(255,238,205,.22)');
  warm.addColorStop(1, 'rgba(255,238,205,0)');
  c.fillStyle = warm;
  c.fillRect(0, 0, width, height);

  const fade = c.createLinearGradient(width * 0.4, 0, 0, 0);
  fade.addColorStop(0, 'rgba(70,50,30,0)');
  fade.addColorStop(1, 'rgba(70,50,30,.14)');
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
  if (!dark && pane) paintSunlight(c, p, pane, height);

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

    if (p.stand) {
      t.save();
      t.translate(p.stand.x, p.stand.y);
      t.scale(-unit, unit);
      paintStand(t, (HANG_POT.width / 2) * HANG_POT.top * HANG_SCALE * 0.92);
      t.restore();
    }

    // Shelf, stand and cabinet are painted lit from the left: mirrored, so they're lit from the window
    t.save();
    t.translate(p.shelfX + SHELF.width * unit, p.shelfY);
    t.scale(-unit, unit);
    shelfLayout.paintBackdrop(t, SHELF.width, SHELF.height, dark);
    t.restore();

    if (p.cabinet) {
      t.save();
      t.translate(p.cabinet.x, p.cabinet.y);
      t.scale(unit * FURNITURE, unit * FURNITURE);
      t.save();
      t.scale(-1, 1);
      paintCabinet(t);
      t.restore();
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

// The two pots hanging from the stand's beams; a vine may hang until just above the next pot's ring, or the floor
function hangingSlots(p: Plan): LayoutSlot[] {
  if (!p.stand) return [];
  const { unit } = p;
  const scale = HANG_SCALE * unit,
    plantScale = scale * HANG_GROW;
  return STAND.beams.map((beamHeight, row) => {
    const soilY = p.footY - (beamHeight - STAND.drop) * unit;
    const stopAt = row === 0 ? p.footY - (STAND.beams[1] - 20) * unit : p.footY - 12 * unit;
    return {
      index: HANGING_SLOTS[row],
      x: p.stand!.x,
      soilY,
      scale,
      plantScale,
      pot: HANG_POT,
      hangRoom: (stopAt - soilY) / plantScale,
    };
  });
}

export function roomLayout(decor: DecorKey): GardenLayout {
  return {
    slots(width, height) {
      const p = plan(width, height);
      const shelf = shelfLayout.slots(SHELF.width, SHELF.height).map((slot) => ({
        ...slot,
        x: p.shelfX + slot.x * p.unit,
        soilY: p.shelfY + slot.soilY * p.unit,
        scale: slot.scale * p.unit,
        plantScale: (slot.plantScale ?? slot.scale) * p.unit,
      }));
      return [...hangingSlots(p), ...shelf];
    },
    paintBackdrop: (c, width, height, dark) => paintRoom(c, width, height, decor, dark),
    // On the floor right against the shelf's right foot; on a phone, just inside it
    canHome(width, height) {
      const p = plan(width, height);
      const besideFoot = p.cabinet ? SHELF.width * 0.95 + 26 : SHELF.width * 0.84;
      return { x: p.shelfX + besideFoot * p.unit, y: p.footY + 3 * p.unit };
    },
    // A real can stands about twice as tall as these pots
    canScale: 2.8,
    toolScale: (width, height) => plan(width, height).unit,
    lightFromRight: true,
    maxVisitors: 5,
  };
}
