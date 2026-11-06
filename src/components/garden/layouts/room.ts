// A plain white room seen straight on, open on the right to a small courtyard (a light well, open to the sky)
// floored with raked Japanese gravel. From the left: a low cabinet with one item on top (espresso machine or
// monitor), the three-tier plant shelf, and a tall hanging stand with two trailing plants next to the courtyard.
// The only light falls in from above the courtyard: the room gets darker away from it. On narrow screens only the
// shelf stands, in the middle, still lit from the right.
import type { Ctx } from '../creatures/kit';
import type { DecorKey } from '../decor';
import type { Daylight } from './daylight';
import type { GardenLayout, LayoutSlot } from './kit';

import { DECOR } from '../decor';
import { CABINET, paintCabinet } from '../decor/cabinet';
import { BENCH, paintBamboo, paintBench, paintLantern, paintMaple, paintMoss } from '../decor/courtyard';
import { plaster, woodGrain } from '../decor/materials';
import { paintStand, STAND } from '../decor/stand';
import { seeded } from '../plants/wood';
import { POTS } from '../pots';
import { HANGING_SLOTS } from './kit';
import { shelfLayout } from './shelf';

// Room units match the shelf drawing's own pixels (floor at 0.925 of its height)
const SHELF = { width: 420, height: 700, floor: 700 * 0.925 };
// The cabinet and its item are a bit smaller than true scale, so the plants stay the main thing
const FURNITURE = 0.75;
const CABINET_WIDTH = CABINET.width * FURNITURE;
const MARGIN = 24,
  CABINET_GAP = 44,
  // Between the shelf and the hanging stand: the watering can stands here
  STAND_GAP = 96,
  // Bare floor between the stand and the courtyard
  COURT_PAD = 36,
  // Head room above the tallest top-tier plant
  TOP = 52,
  // How far the wall's foot sits behind the furniture's feet
  FLOOR_DEPTH = 90;
const ROOM_WIDTH = MARGIN + CABINET_WIDTH + CABINET_GAP + SHELF.width + STAND_GAP + STAND.width + COURT_PAD;
// The courtyard takes about a third of the whole width (more on wide screens)
const COURT_WIDTH = ROOM_WIDTH * 0.45;

// Hanging pots: the shelf's pot size and plant growth
const HANG_POT = POTS.bowl,
  HANG_SCALE = 1.4,
  HANG_GROW = 1.15;

// Nearly white plaster; light oak boards; pale grey gravel
const WALL = ['#F8F6F2', '#EFECE6'];
const FLOOR = ['#CDA77E', '#C39C72', '#BA9268', '#C8A177'];
const GRAVEL = '#D9D4CA';
// The timber post where the room's roof ends, and the sill under it
const POST = 14;

interface Plan {
  // Pixels per room unit
  unit: number;
  footY: number;
  wallFoot: number;
  shelfX: number;
  shelfY: number;
  // Where the room ends and the courtyard begins (at the wall's foot); the canvas edge when there is no courtyard
  courtX: number;
  // Centres of the cabinet's and the hanging stand's feet, when there is room for them
  cabinet?: { x: number; y: number };
  stand?: { x: number; y: number };
}

function plan(width: number, height: number): Plan {
  const footY = height * 0.92;
  const byHeight = (footY - height * 0.02) / (SHELF.floor + TOP);
  const full = ROOM_WIDTH + COURT_WIDTH;
  const wide = width / full >= byHeight * 0.6;
  const unit = wide ? Math.min(byHeight, width / full) : Math.min(byHeight, width / (SHELF.width + 30));
  const base = { unit, footY, wallFoot: footY - FLOOR_DEPTH * unit, shelfY: footY - SHELF.floor * unit };
  if (!wide) return { ...base, shelfX: (width - SHELF.width * unit) / 2, courtX: width };

  // The room keeps its width; spare width goes to the courtyard on the right and bare wall on the left
  const left = Math.max(0, (width - full * unit) / 2);
  const shelfX = left + (MARGIN + CABINET_WIDTH + CABINET_GAP) * unit;
  return {
    ...base,
    shelfX,
    courtX: left + ROOM_WIDTH * unit,
    cabinet: { x: left + (MARGIN + CABINET_WIDTH / 2) * unit, y: footY },
    stand: { x: shelfX + (SHELF.width + STAND_GAP + STAND.width / 2) * unit, y: footY },
  };
}

// The courtyard's edge runs back toward the middle of the picture, so on the floor it leans a little outward
// toward the viewer
function edgeAt(p: Plan, width: number, y: number) {
  return p.courtX + ((y - p.wallFoot) / (p.footY - p.wallFoot)) * (p.courtX - width / 2) * 0.12;
}

// The open courtyard as a path: its wall right of the post, its floor right of the edge
function courtShape(c: Ctx, p: Plan, width: number, height: number) {
  c.beginPath();
  c.moveTo(p.courtX, 0);
  c.lineTo(width, 0);
  c.lineTo(width, height);
  c.lineTo(edgeAt(p, width, height), height);
  c.lineTo(edgeAt(p, width, p.wallFoot), p.wallFoot);
  c.closePath();
}

function paintWall(c: Ctx, width: number, wallFoot: number) {
  const wall = c.createLinearGradient(0, 0, 0, wallFoot);
  wall.addColorStop(0, WALL[0]);
  wall.addColorStop(1, WALL[1]);
  c.fillStyle = wall;
  c.fillRect(0, 0, width, wallFoot);
  plaster(c, 0, 0, width, wallFoot, 0.61);
}

// Skirting board along the room's wall, stopping at the courtyard
function paintSkirting(c: Ctx, right: number, wallFoot: number, unit: number) {
  const height = 22 * unit;
  c.fillStyle = '#F8F6F1';
  c.fillRect(0, wallFoot - height, right, height);
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, wallFoot - height, right, Math.max(1, 2 * unit));
  c.fillStyle = 'rgba(90,75,55,.18)';
  c.fillRect(0, wallFoot - Math.max(1, 1.5 * unit), right, Math.max(1, 1.5 * unit));
}

// Oak boards along the wall in a regular stagger: every board the same length, each row's joints a third of a
// board on from the row behind, so the joints step across the floor in a steady rhythm
function paintFloor(c: Ctx, p: Plan, width: number, height: number) {
  const { unit, wallFoot } = p;
  const depth = height - wallFoot;
  const random = seeded(0.17);
  let y = wallFoot,
    row = 0;
  while (y < height) {
    const near = (y - wallFoot) / depth;
    const rowHeight = Math.max(4, (9 + near * 26) * unit);
    const board = 300 * unit * (1 + near * 0.6);
    let x = -((row % 3) / 3) * board,
      index = row;
    while (x < width) {
      c.fillStyle = FLOOR[index % FLOOR.length];
      c.fillRect(x, y, board, rowHeight);
      woodGrain(c, x, y, board, rowHeight, random(), { density: 4 / Math.max(unit, 0.5), knots: false });
      c.fillStyle = 'rgba(70,40,20,.35)';
      c.fillRect(x, y, Math.max(1, unit), rowHeight);
      x += board;
      index += 3;
    }
    c.fillStyle = 'rgba(70,40,20,.3)';
    c.fillRect(0, y, width, Math.max(1, unit * 0.8));
    y += rowHeight;
    row++;
  }

  // Darker where the floor meets the wall, a soft sheen nearer the viewer
  const depthShade = c.createLinearGradient(0, wallFoot, 0, height);
  depthShade.addColorStop(0, 'rgba(60,40,20,.28)');
  depthShade.addColorStop(0.35, 'rgba(60,40,20,.06)');
  depthShade.addColorStop(1, 'rgba(255,240,220,.08)');
  c.fillStyle = depthShade;
  c.fillRect(0, wallFoot, width, depth);
}

// What fills the courtyard. Preview only for now: localStorage `gardenCourt` = maple | bamboo | bench
type CourtStyle = 'maple' | 'bamboo' | 'bench';
function courtStyle(): CourtStyle {
  try {
    const style = localStorage.getItem('gardenCourt');
    if (style === 'bamboo' || style === 'bench') return style;
  } catch {
    // No storage
  }
  return 'maple';
}

// Courtyard pieces, back to front: a tree or bamboo against the back wall, moss, a stone lantern, and (bench
// style) a low bench for potted plants
function paintCourtPieces(c: Ctx, p: Plan, width: number, height: number, glow: number) {
  const { unit, wallFoot } = p;
  const court = width - p.courtX;
  const ground = (t: number) => wallFoot + (height - wallFoot) * t;
  const place = (x: number, y: number, paint: () => void, scale = unit) => {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    paint();
    c.restore();
  };
  const style = courtStyle();

  const backY = ground(0.12);
  if (style === 'bamboo') place(p.courtX + court * 0.7, backY, () => paintBamboo(c, (backY - height * 0.04) / unit));
  else place(p.courtX + court * 0.66, backY, () => paintMaple(c, (backY - height * 0.04) / unit, style === 'maple'));

  place(p.courtX + court * 0.28, ground(0.5), () => paintMoss(c, 60, 10, 0.12));
  place(p.courtX + court * 0.7, ground(0.2), () => paintMoss(c, 70, 8, 0.27));
  place(p.courtX + court * 0.24, ground(0.42), () => paintLantern(c, glow), unit * 0.95);
  if (style === 'bench') place(p.courtX + court * 0.6, ground(0.62), () => paintBench(c));
}

// Slots on the courtyard bench (bench style only)
const BENCH_SLOTS = [11, 12, 13];
function benchSlots(p: Plan, width: number, height: number): LayoutSlot[] {
  if (p.courtX >= width || courtStyle() !== 'bench') return [];
  const court = width - p.courtX;
  const benchX = p.courtX + court * 0.6,
    benchTop = p.wallFoot + (height - p.wallFoot) * 0.62 - BENCH.height * p.unit;
  const pot = POTS.ceramic,
    scale = 1.4 * p.unit;
  return BENCH_SLOTS.map((index, at) => ({
    index,
    x: benchX + (at - 1) * BENCH.width * 0.32 * p.unit,
    soilY: benchTop - pot.height * scale,
    scale,
    plantScale: scale * 1.15,
    pot,
    hangRoom: 20,
  }));
}

// The courtyard's back wall is out in the open: the high walls around the light well (off the picture) shade its
// upper right in a soft diagonal, and a dark timber post marks where the room's roof ends
function paintCourtWall(c: Ctx, p: Plan, width: number) {
  const { unit, wallFoot } = p;
  const shade = c.createLinearGradient(width, 0, width - 260 * unit, 200 * unit);
  shade.addColorStop(0, 'rgba(90,80,70,.3)');
  shade.addColorStop(0.55, 'rgba(90,80,70,.18)');
  shade.addColorStop(1, 'rgba(90,80,70,0)');
  c.fillStyle = shade;
  c.fillRect(p.courtX, 0, width - p.courtX, wallFoot);

  const post = POST * unit;
  const wood = c.createLinearGradient(p.courtX - post, 0, p.courtX, 0);
  wood.addColorStop(0, '#5E4632');
  wood.addColorStop(0.6, '#7E6046');
  wood.addColorStop(1, '#94745A');
  c.fillStyle = wood;
  c.fillRect(p.courtX - post, 0, post, wallFoot + 2 * unit);
  woodGrain(c, p.courtX - post, 0, post, wallFoot, 0.71, { along: 'y', density: 3, knots: false });
}

// Courtyard floor: pale gravel raked into long parallel lines, a flat stepping stone, and a dark timber sill along
// the room's edge. Its back wall is the same plaster, out in the open.
function paintCourt(c: Ctx, p: Plan, width: number, height: number) {
  const { unit, wallFoot } = p;
  const random = seeded(0.53);
  c.save();
  c.beginPath();
  c.moveTo(edgeAt(p, width, wallFoot), wallFoot);
  c.lineTo(width, wallFoot);
  c.lineTo(width, height);
  c.lineTo(edgeAt(p, width, height), height);
  c.closePath();
  c.clip();

  c.fillStyle = GRAVEL;
  c.fillRect(p.courtX - 100 * unit, wallFoot, width, height - wallFoot);
  // Pebbles: tiny light and dark specks
  const specks = Math.round(((width - p.courtX) * (height - wallFoot)) / (22 * Math.max(unit, 0.4)));
  for (let i = 0; i < specks; i++) {
    const x = p.courtX - 40 * unit + random() * (width - p.courtX + 40 * unit),
      y = wallFoot + random() * (height - wallFoot);
    c.fillStyle = random() < 0.5 ? 'rgba(120,110,95,.22)' : 'rgba(255,255,250,.45)';
    c.beginPath();
    c.ellipse(x, y, (0.8 + random()) * unit * 1.4, (0.5 + random() * 0.5) * unit * 1.4, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Raked lines, further apart toward the viewer, each a lit ridge over a shaded furrow
  for (let y = wallFoot + 6 * unit, gap = 7 * unit; y < height; y += gap, gap *= 1.09) {
    for (const [offset, color] of [
      [0, 'rgba(110,98,82,.45)'],
      [-1.6, 'rgba(255,255,250,.7)'],
    ] as const) {
      c.strokeStyle = color;
      c.lineWidth = Math.max(0.6, 0.9 * unit * (gap / (7 * unit)) * 0.5);
      c.beginPath();
      for (let x = p.courtX - 40 * unit; x <= width; x += 8 * unit) {
        const wave = Math.sin(x / (90 * unit)) * 0.6 * unit;
        if (x === p.courtX - 40 * unit) c.moveTo(x, y + offset * unit + wave);
        else c.lineTo(x, y + offset * unit + wave);
      }
      c.stroke();
    }
  }
  // A flat stepping stone off the sill
  const sx = p.courtX + (width - p.courtX) * 0.42,
    sy = wallFoot + (height - wallFoot) * 0.62;
  const stone = c.createRadialGradient(sx - 20 * unit, sy - 8 * unit, 0, sx, sy, 70 * unit);
  stone.addColorStop(0, '#B9B4AB');
  stone.addColorStop(1, '#8E8A83');
  c.fillStyle = 'rgba(70,60,50,.25)';
  c.beginPath();
  c.ellipse(sx + 4 * unit, sy + 6 * unit, 64 * unit, 15 * unit, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = stone;
  c.beginPath();
  c.ellipse(sx, sy, 62 * unit, 14 * unit, -0.03, 0, Math.PI * 2);
  c.fill();
  c.restore();

  // Timber sill where the room's floor ends: it starts right under the post and widens toward the viewer, its
  // right edge running along the courtyard's edge
  const post = POST * unit,
    widen = 1.8;
  const top = edgeAt(p, width, wallFoot),
    bottom = edgeAt(p, width, height);
  c.fillStyle = '#7A5A3E';
  c.beginPath();
  c.moveTo(top - post, wallFoot);
  c.lineTo(top, wallFoot);
  c.lineTo(bottom, height);
  c.lineTo(bottom - post * widen, height);
  c.closePath();
  c.fill();
  // Its lit face toward the courtyard
  c.fillStyle = 'rgba(255,230,200,.25)';
  c.beginPath();
  c.moveTo(top - post * 0.35, wallFoot);
  c.lineTo(top, wallFoot);
  c.lineTo(bottom, height);
  c.lineTo(bottom - post * widen * 0.35, height);
  c.closePath();
  c.fill();
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

// Furniture is painted on its own layer, then laid on the room in one go with one soft shadow cast down and to
// the left, away from the courtyard's light.
function furniture(c: Ctx, dark: boolean, unit: number, paint: (target: Ctx) => void) {
  const layer = document.createElement('canvas');
  layer.width = c.canvas.width;
  layer.height = c.canvas.height;
  const target = layer.getContext('2d')!;
  target.setTransform(c.getTransform());
  paint(target);
  target.setTransform(1, 0, 0, 1, 0, 0);

  const ratio = c.getTransform().a;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.shadowColor = dark ? 'rgba(10,14,24,.35)' : 'rgba(80,55,30,.3)';
  c.shadowBlur = 10 * unit * ratio;
  c.shadowOffsetX = -18 * unit * ratio;
  c.shadowOffsetY = 10 * unit * ratio;
  c.drawImage(layer, 0, 0);
  c.restore();
}

// Where the light reaches: rays come down from above the courtyard, leaning left by `slant` per unit they drop.
// A point is lit when its ray, traced back up, clears the room's edge; everything in the courtyard is lit.
function lightLine(p: Plan, slant: number) {
  const length = Math.hypot(1, slant);
  // Unit normal pointing to the lit side, and the line's anchor at the top of the room's edge
  return { x: p.courtX, y: 0, nx: 1 / length, ny: slant / length };
}

// Sun (or moon) laid over the lit side of the room and over the courtyard, before the furniture
function paintSun(c: Ctx, p: Plan, width: number, height: number, rgb: string, strength: number, slant: number) {
  const line = lightLine(p, slant);
  const soft = 40 * p.unit;
  const glow = c.createLinearGradient(
    line.x - line.nx * soft,
    line.y - line.ny * soft,
    line.x + line.nx * width * 0.5,
    line.y + line.ny * width * 0.5,
  );
  glow.addColorStop(0, `rgba(${rgb},0)`);
  glow.addColorStop(0.15, `rgba(${rgb},${(0.3 * strength).toFixed(2)})`);
  glow.addColorStop(1, `rgba(${rgb},${(0.12 * strength).toFixed(2)})`);
  c.fillStyle = glow;
  c.fillRect(0, 0, width, height);
  if (p.courtX < width) {
    c.fillStyle = `rgba(${rgb},${(0.1 * strength).toFixed(2)})`;
    courtShape(c, p, width, height);
    c.fill();
  }
}

// The light map: multiplied over the whole scene, plants included. White where the light falls, toward `shade`
// away from it, with a soft edge along the line where the room's roof cuts the light off.
function paintLightMap(c: Ctx, width: number, height: number, dark: boolean, light?: Daylight | null) {
  const p = plan(width, height);
  const lit = dark ? '#A3ADBF' : light?.sun ? '#FFFFFF' : '#E3E4EE';
  const shade = dark ? '#40465A' : (light?.shade ?? '#B9B1A6');
  const slant = dark ? 0.55 : (light?.sun?.slant ?? 0.2);
  const line = lightLine(p, slant);
  const reach = width * 0.9,
    soft = 26 * p.unit;
  const map = c.createLinearGradient(
    line.x - line.nx * reach,
    line.y - line.ny * reach,
    line.x + line.nx * soft,
    line.y + line.ny * soft,
  );
  const at = (distance: number) => (distance + reach) / (reach + soft);
  map.addColorStop(0, shade);
  map.addColorStop(at(-reach * 0.45), mix(shade, lit, 0.45));
  map.addColorStop(at(-soft), mix(shade, lit, 0.7));
  map.addColorStop(1, lit);
  c.fillStyle = map;
  c.fillRect(0, 0, width, height);
  // The courtyard is open to the sky: all of it is lit
  if (p.courtX < width) {
    c.fillStyle = lit;
    courtShape(c, p, width, height);
    c.fill();
  }
}

// Blend two #rrggbb colours
function mix(from: string, to: string, t: number) {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  const parts = [1, 3, 5].map((at) => Math.round(channel(from, at) + (channel(to, at) - channel(from, at)) * t));
  return `rgb(${parts.join(',')})`;
}

function paintRoom(c: Ctx, width: number, height: number, decorKey: DecorKey, dark: boolean, light?: Daylight | null) {
  const p = plan(width, height);
  const { unit } = p;
  const decor = DECOR[decorKey];

  paintWall(c, width, p.wallFoot);
  paintSkirting(c, p.courtX, p.wallFoot, unit);
  paintFloor(c, p, width, height);
  if (p.courtX < width) {
    paintCourtWall(c, p, width);
    paintCourt(c, p, width, height);
    paintCourtPieces(c, p, width, height, dark ? 1 : light?.lamp ? 0.6 : 0);
  }
  if (dark) paintSun(c, p, width, height, '205,215,235', 0.5, 0.55);
  else if (light?.sun) paintSun(c, p, width, height, light.sun.rgb, light.sun.strength, light.sun.slant);

  floorShadow(c, p.shelfX + (SHELF.width / 2) * unit, p.footY, SHELF.width * 0.62 * unit, unit);
  if (p.cabinet) floorShadow(c, p.cabinet.x, p.cabinet.y, CABINET_WIDTH * 0.62 * unit, unit);
  if (p.stand) floorShadow(c, p.stand.x, p.stand.y, STAND.width * 0.62 * unit, unit);

  // Everything here is painted lit from the left, so it is mirrored to face the courtyard's light
  furniture(c, dark, unit, (t) => {
    if (p.stand) {
      t.save();
      t.translate(p.stand.x, p.stand.y);
      t.scale(-unit, unit);
      paintStand(t, (HANG_POT.width / 2) * HANG_POT.top * HANG_SCALE * 0.92);
      t.restore();
    }

    t.save();
    t.translate(p.shelfX + SHELF.width * unit, p.shelfY);
    t.scale(-unit, unit);
    shelfLayout.paintBackdrop(t, SHELF.width, SHELF.height, dark);
    t.restore();

    if (p.cabinet) {
      t.save();
      t.translate(p.cabinet.x, p.cabinet.y);
      t.scale(-unit * FURNITURE, unit * FURNITURE);
      paintCabinet(t);
      t.translate(0, -CABINET.height);
      decor.paint(t, dark);
      t.restore();
    }
  });

  if (p.cabinet && decor.lit) {
    c.save();
    c.translate(p.cabinet.x, p.cabinet.y - CABINET.height * FURNITURE * unit);
    c.scale(-unit * FURNITURE, unit * FURNITURE);
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
      return [...hangingSlots(p), ...shelf, ...benchSlots(p, width, height)];
    },
    paintBackdrop: (c, width, height, dark, light) => paintRoom(c, width, height, decor, dark, light),
    paintLight: paintLightMap,
    // On the floor between the shelf and the hanging stand; on a phone, just inside the shelf's right foot
    canHome(width, height) {
      const p = plan(width, height);
      const besideFoot = p.stand ? SHELF.width + STAND_GAP * 0.45 : SHELF.width * 0.84;
      return { x: p.shelfX + besideFoot * p.unit, y: p.footY + 3 * p.unit };
    },
    // A real can stands about twice as tall as these pots
    canScale: 2.8,
    toolScale: (width, height) => plan(width, height).unit,
    lightFromRight: true,
    // Light from above and to the right throws each plant's shadow onto the wall down and to the left
    castShadow: { x: 14, y: 14 },
    // The band of sunlight falling in from the courtyard's edge, where dust drifts by day
    lightShaft(width, height, slant = 0.5) {
      const p = plan(width, height);
      if (!p.stand) return null;
      const drop = p.footY;
      return {
        top: [
          { x: p.courtX - 160 * p.unit, y: 0 },
          { x: p.courtX, y: 0 },
        ],
        bottom: [
          { x: p.courtX - 160 * p.unit - drop * slant, y: drop },
          { x: p.courtX - drop * slant, y: drop },
        ],
      };
    },
    maxVisitors: 5,
  };
}
