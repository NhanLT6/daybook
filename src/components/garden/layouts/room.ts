// A cool grey room seen straight on, open on the right to a small courtyard (a light well, open to the sky) with
// gravel, stone slabs and a clump of trees. From the left: a low cabinet with an espresso machine on top, the
// three-tier plant shelf, and a tall hanging stand with two trailing plants next to the courtyard.
// The only light falls in from above the courtyard: the room gets darker away from it. On narrow screens only the
// shelf stands, in the middle, still lit from the right.
import type { Ctx } from '../creatures/kit';
import type { DecorKey } from '../decor';
import type { Daylight } from './daylight';
import type { GardenLayout, LayoutSlot } from './kit';

import { DECOR } from '../decor';
import { CABINET, paintCabinet } from '../decor/cabinet';
import { paintPebbles } from '../decor/courtyard';
import { snowbellGrove } from '../decor/grove';
import { plaster, woodGrain } from '../decor/materials';
import { paintStand, STAND } from '../decor/stand';
import { seeded } from '../plants/wood';
import { POTS } from '../pots';
import { HANGING_SLOTS } from './kit';
import { canSpot, shelfLayout } from './shelf';

// Room units match the shelf drawing's own pixels (floor at 0.925 of its height)
const SHELF = { width: 420, height: 700, floor: 700 * 0.925 };
// The cabinet and its item are a bit smaller than true scale, so the plants stay the main thing
const FURNITURE = 0.75;
const CABINET_WIDTH = CABINET.width * FURNITURE;
const MARGIN = 24,
  CABINET_GAP = 44,
  // Between the shelf and the hanging stand: the watering can stands here
  STAND_GAP = 56,
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
// Pale cement-grey walls, light grey-washed oak boards, grey gravel: a cool, neutral room
const WALL = ['#E4E3E0', '#DAD9D6'];
const CEMENT = '#D2D1CD';
const FLOOR = ['#DCD1C2', '#D4C8B8', '#CDC1B0', '#D8CCBD'];
const GRAVEL = '#D3D2CE';
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
  c.fillStyle = '#ECEBE8';
  c.fillRect(0, wallFoot - height, right, height);
  c.fillStyle = '#F6F6F4';
  c.fillRect(0, wallFoot - height, right, Math.max(1, 2 * unit));
  c.fillStyle = 'rgba(70,70,70,.18)';
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
      c.fillStyle = 'rgba(80,65,50,.3)';
      c.fillRect(x, y, Math.max(1, unit), rowHeight);
      x += board;
      index += 3;
    }
    c.fillStyle = 'rgba(80,65,50,.26)';
    c.fillRect(0, y, width, Math.max(1, unit * 0.8));
    y += rowHeight;
    row++;
  }

  // Darker where the floor meets the wall, a soft sheen nearer the viewer
  const depthShade = c.createLinearGradient(0, wallFoot, 0, height);
  depthShade.addColorStop(0, 'rgba(50,45,40,.26)');
  depthShade.addColorStop(0.35, 'rgba(50,45,40,.05)');
  depthShade.addColorStop(1, 'rgba(255,252,248,.08)');
  c.fillStyle = depthShade;
  c.fillRect(0, wallFoot, width, depth);
}

// Where the courtyard's trees stand: a clump near the right edge, its crown reaching left into the open middle and
// running off the top of the picture (cut there, like a real view through an opening)
function groveOf(p: Plan, width: number, height: number) {
  const court = width - p.courtX;
  const ground = p.wallFoot + (height - p.wallFoot) * 0.16;
  return { x: p.courtX + court * 0.82, y: ground, tall: (ground * 1.3) / p.unit, reach: (court * 0.75) / p.unit };
}

// Courtyard pieces: a bed of pebbles round the trees' feet (the trees themselves move, see paintTrees)
function paintCourtPieces(c: Ctx, p: Plan, width: number, height: number) {
  const { unit, wallFoot } = p;
  const court = width - p.courtX;
  const ground = (t: number) => wallFoot + (height - wallFoot) * t;
  const place = (x: number, y: number, paint: () => void) => {
    c.save();
    c.translate(x, y);
    c.scale(unit, unit);
    paint();
    c.restore();
  };

  // The courtyard lies behind the room's edge: nothing out there may cross into the room
  c.save();
  courtShape(c, p, width, height);
  c.clip();

  const bed = { left: p.courtX + court * 0.5, top: ground(0.01), depth: ground(0.3) - ground(0.01) };
  place(bed.left, bed.top, () => paintPebbles(c, (width - bed.left) / unit + 20, bed.depth / unit, 0.29));

  c.restore();
}

// The trees, painted every frame so their branches can stir: each trunk and each branch is a bitmap made once per
// size, painted back to front (so branches of different trunks interleave), each branch turned a little about its
// joint, the upper ones (thinner wood) a little more
const groveCache = { key: '', pieces: [] as { canvas: HTMLCanvasElement; x: number; y: number; ox: number; oy: number; sway: number }[] };

function grovePieces(p: Plan, width: number, height: number) {
  const ratio = window.devicePixelRatio || 1;
  const key = `${width}x${height}@${ratio}`;
  if (groveCache.key === key) return groveCache.pieces;
  const grove = groveOf(p, width, height);
  const { unit } = p;
  groveCache.key = key;
  groveCache.pieces = snowbellGrove(grove.tall, grove.reach).map((piece) => {
    const [left, right, up, down] = piece.box;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((left + right) * unit * ratio);
    canvas.height = Math.ceil((up + down) * unit * ratio);
    const t = canvas.getContext('2d')!;
    t.scale(unit * ratio, unit * ratio);
    t.translate(left, up);
    piece.paint(t);
    return {
      canvas,
      x: grove.x + piece.x * unit,
      y: grove.y + piece.y * unit,
      ox: left * unit,
      oy: up * unit,
      sway: piece.sway,
    };
  });
  return groveCache.pieces;
}

function paintTrees(c: Ctx, width: number, height: number, time: number) {
  const p = plan(width, height);
  if (p.courtX >= width) return;
  const ratio = window.devicePixelRatio || 1;
  const gust = 0.6 + 0.4 * Math.sin(time * 0.23);
  c.save();
  courtShape(c, p, width, height);
  c.clip();
  grovePieces(p, width, height).forEach((piece, index) => {
    const sway = (Math.sin(time * 0.9 + index * 0.9) * 0.012 + Math.sin(time * 2.3 + index * 1.7) * 0.004) * gust * piece.sway;
    c.save();
    c.translate(piece.x, piece.y);
    c.rotate(sway);
    c.drawImage(piece.canvas, -piece.ox, -piece.oy, piece.canvas.width / ratio, piece.canvas.height / ratio);
    c.restore();
  });
  c.restore();
}

// Bare cement: faint horizontal streaks left by the trowel and a fine grain of light and dark specks, like noise
function paintCement(c: Ctx, x: number, y: number, w: number, h: number, unit: number) {
  const random = seeded(0.91);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.fillStyle = CEMENT;
  c.fillRect(x, y, w, h);

  for (let i = 0; i < h / (3 * unit); i++) {
    const sy = y + random() * h,
      sx = x + (random() - 0.2) * w,
      length = (60 + random() * 260) * unit;
    c.fillStyle = random() < 0.5 ? 'rgba(255,255,255,.12)' : 'rgba(70,70,68,.07)';
    c.fillRect(sx, sy, length, Math.max(1, (0.6 + random()) * unit));
  }

  const specks = Math.round((w * h) / (10 * Math.max(unit * unit, 0.3)));
  for (let i = 0; i < specks; i++) {
    c.fillStyle = random() < 0.5 ? 'rgba(60,60,58,.12)' : 'rgba(255,255,255,.2)';
    const size = Math.max(1, unit * (0.6 + random() * 0.8));
    c.fillRect(x + random() * w, y + random() * h, size, size);
  }
  c.restore();
}

// The courtyard's back wall is out in the open: the high walls around the light well (off the picture) shade its
// upper right in a soft diagonal, and a dark timber post marks where the room's roof ends
function paintCourtWall(c: Ctx, p: Plan, width: number) {
  const { unit, wallFoot } = p;
  paintCement(c, p.courtX, 0, width - p.courtX, wallFoot, unit);

  const shade = c.createLinearGradient(width, 0, width - 260 * unit, 200 * unit);
  shade.addColorStop(0, 'rgba(70,70,72,.3)');
  shade.addColorStop(0.55, 'rgba(70,70,72,.18)');
  shade.addColorStop(1, 'rgba(70,70,72,0)');
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

// Loose gravel: stones of every size and tone lying every which way, smaller toward the back wall, each with a
// soft shadow on its lower left and a lit upper right
function paintGravel(c: Ctx, p: Plan, width: number, height: number) {
  const { unit, wallFoot } = p;
  const random = seeded(0.53);
  const tones = ['#B9B8B3', '#C8C7C2', '#A9A8A3', '#D6D5D0', '#9C9B97', '#C2BCB2'];
  const left = p.courtX - 40 * unit;
  const count = Math.round(((width - left) * (height - wallFoot)) / (14 * Math.max(unit * unit, 0.2)));
  const stones = Array.from({ length: count }, () => ({
    x: left + random() * (width - left),
    y: wallFoot + random() * (height - wallFoot),
    size: 0.8 + random() * random() * 3.4,
    turn: random() * Math.PI,
    tone: tones[Math.floor(random() * tones.length)],
  })).sort((a, b) => a.y - b.y);
  for (const stone of stones) {
    const near = (stone.y - wallFoot) / (height - wallFoot);
    const r = stone.size * unit * (0.7 + near * 0.7);
    c.fillStyle = 'rgba(60,60,58,.25)';
    c.beginPath();
    c.ellipse(stone.x - r * 0.25, stone.y + r * 0.3, r, r * 0.6, stone.turn, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = stone.tone;
    c.beginPath();
    c.ellipse(stone.x, stone.y, r, r * 0.6, stone.turn, 0, Math.PI * 2);
    c.fill();
    if (r > 1.6) {
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath();
      c.ellipse(stone.x + r * 0.3, stone.y - r * 0.2, r * 0.35, r * 0.2, stone.turn, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// Two long stone slabs laid end to end beside the room's sill, from near the back wall to the bottom of the
// picture, a strip of gravel between them and the sill. Their faces carry the stone's own grain: mottled tone, fine
// specks and a few veins.
function paintSlabs(c: Ctx, p: Plan, width: number, height: number) {
  const { unit, wallFoot } = p;
  const court = width - p.courtX;
  const ground = (t: number) => wallFoot + (height - wallFoot) * t;
  // Both long edges run parallel to the courtyard's edge, so the slabs recede with the floor
  const leftAt = (y: number) => edgeAt(p, width, y) + (10 + 14 * ((y - wallFoot) / (height - wallFoot))) * unit;
  const rightAt = (y: number) => leftAt(y) + court * (0.24 + 0.06 * ((y - wallFoot) / (height - wallFoot)));
  const slabs = [
    { top: ground(0.1), bottom: ground(0.5), seed: 0.13 },
    { top: ground(0.55), bottom: height + 2, seed: 0.47 },
  ];
  for (const slab of slabs) {
    const outline = () => {
      c.beginPath();
      c.moveTo(leftAt(slab.top), slab.top);
      c.lineTo(rightAt(slab.top), slab.top);
      c.lineTo(rightAt(slab.bottom), slab.bottom);
      c.lineTo(leftAt(slab.bottom), slab.bottom);
      c.closePath();
    };
    // Shadow on the gravel below and to the left, then the slab's thickness along its front
    c.save();
    c.translate(-3 * unit, 4 * unit);
    outline();
    c.fillStyle = 'rgba(55,55,52,.3)';
    c.fill();
    c.restore();
    c.fillStyle = '#7E7C77';
    c.fillRect(leftAt(slab.bottom), slab.bottom, rightAt(slab.bottom) - leftAt(slab.bottom), 5 * unit);

    c.save();
    outline();
    c.clip();
    const left = leftAt(slab.bottom),
      right = rightAt(slab.top);
    const face = c.createLinearGradient(left, slab.top, right, slab.bottom);
    face.addColorStop(0, '#A19E97');
    face.addColorStop(1, '#B3B0A9');
    c.fillStyle = face;
    c.fillRect(left, slab.top, right - left, slab.bottom - slab.top);
    stoneGrain(c, left, slab.top, right - left, slab.bottom - slab.top, unit, slab.seed);
    c.restore();

    // Lit back and right edges, shaded left edge
    c.lineWidth = Math.max(1, 1.4 * unit);
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.beginPath();
    c.moveTo(leftAt(slab.top), slab.top);
    c.lineTo(rightAt(slab.top), slab.top);
    c.lineTo(rightAt(slab.bottom), slab.bottom);
    c.stroke();
    c.strokeStyle = 'rgba(70,70,66,.35)';
    c.beginPath();
    c.moveTo(leftAt(slab.top), slab.top);
    c.lineTo(leftAt(slab.bottom), slab.bottom);
    c.stroke();
  }
}

// Mottled, speckled stone: soft blotches of lighter and darker grey, a fine grain of specks, and a few hairline veins
function stoneGrain(c: Ctx, x: number, y: number, w: number, h: number, unit: number, seed: number) {
  const random = seeded(seed);
  for (let i = 0; i < 26; i++) {
    const bx = x + random() * w,
      by = y + random() * h,
      radius = (30 + random() * 90) * unit;
    const blotch = c.createRadialGradient(bx, by, 0, bx, by, radius);
    const tone = random() < 0.5 ? '255,255,255' : '80,78,72';
    blotch.addColorStop(0, `rgba(${tone},.12)`);
    blotch.addColorStop(1, `rgba(${tone},0)`);
    c.fillStyle = blotch;
    c.fillRect(bx - radius, by - radius * 0.5, radius * 2, radius);
  }
  const specks = Math.round((w * h) / (9 * Math.max(unit * unit, 0.3)));
  for (let i = 0; i < specks; i++) {
    c.fillStyle = random() < 0.55 ? 'rgba(60,58,55,.16)' : 'rgba(255,255,255,.28)';
    const size = Math.max(1, unit * (0.5 + random() * 1.2));
    c.fillRect(x + random() * w, y + random() * h, size, size);
  }
  c.lineWidth = Math.max(0.6, 0.7 * unit);
  for (let i = 0; i < 5; i++) {
    let vx = x + random() * w,
      vy = y + random() * h;
    c.strokeStyle = 'rgba(85,82,76,.22)';
    c.beginPath();
    c.moveTo(vx, vy);
    for (let step = 0; step < 6; step++) {
      vx += (20 + random() * 40) * unit;
      vy += (random() - 0.5) * 14 * unit;
      c.lineTo(vx, vy);
    }
    c.stroke();
  }
}

// Courtyard floor: loose grey gravel, two long stone slabs to step on, and a dark timber sill along
// the room's edge. Its back wall is the same plaster, out in the open.
function paintCourt(c: Ctx, p: Plan, width: number, height: number) {
  const { unit, wallFoot } = p;
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
  paintGravel(c, p, width, height);
  paintSlabs(c, p, width, height);
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
  c.fillStyle = 'rgba(255,245,235,.22)';
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
    paintCourtPieces(c, p, width, height);
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

// Leaf shade on the courtyard floor: the maples overhead (off the picture, above the light well) break the sun into
// soft patches that drift and flicker as the leaves stir. Patches come from one blurred sprite, so a frame stays cheap.
let shadeSprite: HTMLCanvasElement | null = null;
const SHADE_PATCHES = Array.from({ length: 34 }, (_, index) => {
  const random = seeded(0.05 + index * 0.027);
  return {
    x: random(),
    y: random(),
    size: 0.5 + random(),
    phase: random() * Math.PI * 2,
    speed: 0.5 + random() * 0.6,
  };
});

function paintLeafShade(c: Ctx, width: number, height: number, time: number, strength: number) {
  const p = plan(width, height);
  if (p.courtX >= width) return;
  if (!shadeSprite) {
    shadeSprite = document.createElement('canvas');
    shadeSprite.width = shadeSprite.height = 64;
    const s = shadeSprite.getContext('2d')!;
    const blob = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    blob.addColorStop(0, 'rgba(40,42,48,1)');
    blob.addColorStop(0.5, 'rgba(40,42,48,.6)');
    blob.addColorStop(1, 'rgba(40,42,48,0)');
    s.fillStyle = blob;
    s.fillRect(0, 0, 64, 64);
  }

  const { unit, wallFoot } = p;
  c.save();
  courtShape(c, p, width, height);
  c.clip();
  for (const patch of SHADE_PATCHES) {
    const stir = Math.sin(time * patch.speed + patch.phase);
    const x = p.courtX + patch.x * (width - p.courtX) + (stir * 7 + Math.sin(time * 1.9 + patch.phase) * 2) * unit,
      y = wallFoot + patch.y * (height - wallFoot);
    const near = (y - wallFoot) / (height - wallFoot);
    const w = 90 * patch.size * unit * (0.7 + near * 0.6);
    c.globalAlpha = (0.13 + 0.05 * Math.sin(time * 1.3 + patch.phase * 2)) * strength;
    c.drawImage(shadeSprite, x - w / 2, y - w * 0.18, w, w * 0.36);
  }
  c.restore();
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
    paintBackdrop: (c, width, height, dark, light) => paintRoom(c, width, height, decor, dark, light),
    paintLight: paintLightMap,
    // On the shelf's bottom tier, in its fourth spot
    canHome(width, height) {
      const p = plan(width, height);
      const spot = canSpot(SHELF.width, SHELF.height);
      return { x: p.shelfX + spot.x * p.unit, y: p.shelfY + spot.y * p.unit };
    },
    // A real can stands about twice as tall as these pots
    canScale: 2.8,
    toolScale: (width, height) => plan(width, height).unit,
    lightFromRight: true,
    // Light from above and to the right throws each plant's shadow onto the wall down and to the left
    castShadow: { x: 14, y: 14 },
    paintBehind: paintTrees,
    paintShade: paintLeafShade,
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
