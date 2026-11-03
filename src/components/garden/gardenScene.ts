// Garden scene, ported from the Talksum garden mock: a two-tier wooden shelf against a plain wall, nine pots,
// plants and insects all painted with Canvas 2D. The drawing code stays close to the mock on purpose; game
// rules (drops, which plant grows) live in useGarden.ts and the scene only reads that state. Insects and other
// creatures each live in their own file under ./creatures.

import { CREATURES } from './creatures';
import { PLANTS, type PlantKey } from './plants';
import {
  type Actor,
  type Ctx,
  type GardenWorld,
  type Goal,
  type Spot,
  type Spots,
  TAU,
  between,
  clamp,
} from './creatures/kit';

// Plant names and painters, one file per plant
export const SPECIES = PLANTS;
export type SpeciesKey = PlantKey;

export const MAX_STAGE = 4;
export const SLOT_COUNT = 9;

export interface GardenPlant {
  species: SpeciesKey;
  stage: number; // 0 seed … 4 grown
  seed: number; // keeps the plant's shape the same while it grows
}

interface Pot {
  width: number;
  height: number;
  top: number;
  bottom: number;
  rim: number;
  belly?: number;
  colors: string[];
}
type PotType = 'terracotta' | 'white' | 'ceramic' | 'concrete';

export function newSeed() {
  return 1 + Math.floor(Math.random() * 2147483646);
}

function seeded(seed: number): () => number {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

function plantTag(c: Ctx) {
  c.fillStyle = '#C9A77A';
  c.fillRect(6, -16, 2, 16);
  c.fillStyle = '#F1E6D2';
  c.beginPath();
  c.roundRect(3, -24, 9, 9, 1.5);
  c.fill();
  c.fillStyle = 'rgba(90,70,50,.5)';
  c.fillRect(5, -21, 5, 1);
  c.fillRect(5, -19, 4, 1);
}

function paintPlant(c: Ctx, species: SpeciesKey, stage: number, seed: number, room = 40) {
  if (stage === 0) {
    plantTag(c);
    return;
  }
  PLANTS[species].paint(c, stage, seeded(seed), room);
  if (stage === 1) plantTag(c);
}

// Pots: clay, glazed and concrete, each lit from the left with a contact shadow.
const POTS = {
  terracotta: { width: 40, height: 32, top: 1, bottom: 0.72, rim: 6, colors: ['#E59A6E', '#BE6A41', '#7A3B22'] },
  white: {
    width: 36,
    height: 34,
    top: 0.92,
    bottom: 0.62,
    rim: 0,
    belly: 1.06,
    colors: ['#FFFDFB', '#E6DED8', '#B2A8A1'],
  },
  ceramic: {
    width: 42,
    height: 26,
    top: 1,
    bottom: 0.58,
    rim: 0,
    belly: 1.04,
    colors: ['#F4EEDF', '#D9CDB5', '#A39477'],
  },
  concrete: { width: 38, height: 30, top: 1, bottom: 0.9, rim: 0, colors: ['#D8DADA', '#A9ADAE', '#6F7475'] },
};

function potShape(c: Ctx, pot: Pot) {
  const half = pot.width / 2,
    topHalf = half * pot.top,
    bottomHalf = half * pot.bottom;
  const bellyHalf = half * (pot.belly || 1);
  c.beginPath();
  c.moveTo(-topHalf, 0);
  c.bezierCurveTo(-bellyHalf, pot.height * 0.45, -bottomHalf - 2, pot.height, -bottomHalf, pot.height);
  c.quadraticCurveTo(0, pot.height + 3.2, bottomHalf, pot.height);
  c.bezierCurveTo(bottomHalf + 2, pot.height, bellyHalf, pot.height * 0.45, topHalf, 0);
  c.closePath();
}

function sideGradient(c: Ctx, half: number, colors: string[]) {
  const gradient = c.createLinearGradient(-half, 0, half, 0);
  gradient.addColorStop(0, colors[1]);
  gradient.addColorStop(0.22, colors[0]);
  gradient.addColorStop(0.6, colors[1]);
  gradient.addColorStop(1, colors[2]);
  return gradient;
}

function paintPotBack(c: Ctx, type: PotType) {
  const pot = POTS[type],
    half = pot.width / 2;
  // Soft cast shadow toward the lower right, then a tight dark core where the pot meets the surface.
  c.save();
  c.translate(half * 0.35, pot.height + 1.5);
  c.scale(1, 0.22);
  const cast = c.createRadialGradient(0, 0, 1, 0, 0, half * 1.6);
  cast.addColorStop(0, 'rgba(30,20,30,.32)');
  cast.addColorStop(1, 'rgba(30,20,30,0)');
  c.fillStyle = cast;
  c.beginPath();
  c.arc(0, 0, half * 1.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
  const bottomHalf = half * pot.bottom;
  c.save();
  c.translate(0, pot.height + 1.2);
  c.scale(1, 0.2);
  const core = c.createRadialGradient(0, 0, bottomHalf * 0.5, 0, 0, bottomHalf * 1.25);
  core.addColorStop(0, 'rgba(20,12,20,.55)');
  core.addColorStop(1, 'rgba(20,12,20,0)');
  c.fillStyle = core;
  c.beginPath();
  c.arc(0, 0, bottomHalf * 1.25, 0, Math.PI * 2);
  c.fill();
  c.restore();

  potShape(c, pot);
  c.fillStyle = sideGradient(c, half, pot.colors);
  c.fill();
  c.save();
  potShape(c, pot);
  c.clip();
  const base = c.createLinearGradient(0, pot.height, 0, pot.height * 0.55);
  base.addColorStop(0, 'rgba(30,20,30,.28)');
  base.addColorStop(1, 'rgba(30,20,30,0)');
  c.fillStyle = base;
  c.fillRect(-half * 1.2, 0, half * 2.4, pot.height + 5);
  const shine = c.createLinearGradient(-half * 0.42, 0, -half * 0.22, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,255,255,.32)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = shine;
  c.fillRect(-half, 0, half * 2, pot.height + 5);
  c.restore();

  if (pot.rim) {
    const rimHalf = half * 1.06;
    c.fillStyle = sideGradient(c, rimHalf, pot.colors);
    // Rim bands curve with the opening, the same way the base curves.
    const rimBottom = pot.rim - 2;
    c.beginPath();
    c.moveTo(-rimHalf, 0);
    c.lineTo(-rimHalf, rimBottom);
    c.quadraticCurveTo(0, rimBottom + 3.2, rimHalf, rimBottom);
    c.lineTo(rimHalf, 0);
    c.ellipse(0, 0, rimHalf, 4.2, 0, 0, Math.PI, true);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(60,25,15,.3)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-half * 0.98, rimBottom + 0.6);
    c.quadraticCurveTo(0, rimBottom + 3.6, half * 0.98, rimBottom + 0.6);
    c.stroke();
  }
  const soilHalf = half * pot.top * 0.9;
  const soil = c.createLinearGradient(0, -3, 0, 3);
  soil.addColorStop(0, '#2E2019');
  soil.addColorStop(1, '#5A4130');
  c.fillStyle = pot.colors[2];
  c.beginPath();
  c.ellipse(0, 0, half * pot.top * (pot.rim ? 1.06 : 1), 4.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = soil;
  c.beginPath();
  c.ellipse(0, 0.6, soilHalf, 3.2, 0, 0, Math.PI * 2);
  c.fill();
}

function paintWateringCan(c: Ctx, x: number, baseY: number, withShadow = true) {
  if (withShadow) {
    c.fillStyle = 'rgba(30,20,40,.25)';
    c.beginPath();
    c.ellipse(x + 3, baseY, 13, 2.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  const metal = c.createLinearGradient(x - 9, 0, x + 9, 0);
  metal.addColorStop(0, '#9CC9C2');
  metal.addColorStop(0.3, '#CFEAE4');
  metal.addColorStop(1, '#4F8A82');
  c.fillStyle = metal;
  c.beginPath();
  c.roundRect(x - 9, baseY - 18, 18, 18, 3);
  c.fill();
  c.strokeStyle = '#5E9890';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x - 8, baseY - 12);
  c.lineTo(x - 18, baseY - 22);
  c.stroke();
  c.beginPath();
  c.arc(x + 2, baseY - 19, 6, Math.PI, 0);
  c.stroke();
  c.fillStyle = '#4F8A82';
  c.beginPath();
  c.ellipse(x - 19, baseY - 23, 2.4, 1.6, -0.7, 0, Math.PI * 2);
  c.fill();
}

// Garden trowel standing on its blade tip (0, 0), handle up: wooden grip, steel blade lit from the left
function paintShovelShape(c: Ctx) {
  const wood = c.createLinearGradient(-2, 0, 2, 0);
  wood.addColorStop(0, '#D9A872');
  wood.addColorStop(1, '#8E5E33');
  c.fillStyle = wood;
  c.beginPath();
  c.roundRect(-1.6, -44, 3.2, 26, 1.6);
  c.fill();
  c.fillStyle = '#6F7475';
  c.fillRect(-1.2, -20, 2.4, 5);

  const steel = c.createLinearGradient(-6, 0, 6, 0);
  steel.addColorStop(0, '#E4E7E8');
  steel.addColorStop(0.45, '#B9BEC0');
  steel.addColorStop(1, '#7C8285');
  c.fillStyle = steel;
  c.beginPath();
  c.moveTo(-5.5, -16);
  c.lineTo(5.5, -16);
  c.quadraticCurveTo(6.5, -6, 0, 0);
  c.quadraticCurveTo(-6.5, -6, -5.5, -16);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(40,45,50,.35)';
  c.lineWidth = 0.6;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.5)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-3, -14);
  c.quadraticCurveTo(-3.6, -8, -1, -3);
  c.stroke();
}

// ── Scene ───────────────────────────────────────────────────────────────────────

interface Layer {
  canvas: HTMLCanvasElement;
  context: Ctx;
}

export interface GardenSceneOptions {
  height: number;
  nightFilterId: string;
  getPlants: () => (GardenPlant | null)[];
  getDrops: () => number;
}

export interface GardenScene {
  resize: () => void;
  setTheme: (theme: { dark: boolean; primary: string; onPrimary: string }) => void;
  slotAt: (x: number, y: number) => number;
  slotAnchor: (index: number) => { x: number; y: number };
  pulse: (index: number) => void;
  pour: (index: number, fromStage: number) => void;
  isPouring: () => boolean;
  dig: (index: number, onDone: () => void) => void;
  destroy: () => void;
}

const POT_TYPES: PotType[] = [
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
// Plant bitmaps span 130 plant pixels above the soil and the rest below it, room for hanging vines
const PLANT_BITMAP_HEIGHT = 300;


export function createGardenScene(canvas: HTMLCanvasElement, options: GardenSceneOptions): GardenScene {
  const ctx = canvas.getContext('2d')!;
  let width = 0;
  const height = options.height;
  let dark = false;
  let badge = { primary: '#4A8C6A', onPrimary: '#FFFFFF' };
  let backdrop: HTMLCanvasElement | null = null;
  let foreground: Layer | null = null;
  let frameId = 0;
  const drops: { x: number; y: number; vy: number; delay: number; groundY: number }[] = [];
  const sparkles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const ripples: { x: number; y: number; life: number }[] = [];
  // Pours run on the clock, not frame count, so a slow frame rate never leaves the can stuck mid-pour
  const POUR_MS = 1400;
  const pours: { toX: number; toY: number; start: number }[] = [];
  const pulses = new Map<number, number>();
  const plantBitmaps = new Map<string, HTMLCanvasElement>();
  // While a pour plays, the plant keeps showing its old stage until the water lands
  const shownOverride = new Map<number, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const state = {
    get plants() {
      return options.getPlants();
    },
  };

  // Each creature in its own file (./creatures); the scene only runs the ones that fit the theme
  const freshActors = () =>
    CREATURES.map((creature) => Array.from({ length: creature.count }, (_, slot) => creature.create(slot)));
  let actors: Actor[][] = freshActors();
  let lastCreatureTime = 0;

  const pixelRatio = () => window.devicePixelRatio || 1;
  const shownStage = (index: number) => shownOverride.get(index) ?? state.plants[index]?.stage ?? 0;

  function layer(): Layer {
    const ratio = pixelRatio();
    const surface = document.createElement('canvas');
    surface.width = width * ratio;
    surface.height = height * ratio;
    const context = surface.getContext('2d')!;
    context.scale(ratio, ratio);
    return { canvas: surface, context };
  }

  function resize() {
    const ratio = pixelRatio();
    width = canvas.parentElement?.clientWidth ?? 0;
    if (!width) return;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    plantBitmaps.clear();
    foreground = null;
    buildBackdrop();
  }

  function slotPosition(index: number) {
    const row = ROW_OF_SLOT[index],
      column = index % 3;
    const scale = ROW_SCALE[row];
    const pot = POTS[POT_TYPES[index]];
    // On a plank the pot stands mid-depth, not on the front edge.
    const shelfY = height * ROWS[row] - (row === 'floor' ? 0 : PLANK_DEPTH * 0.5);
    const x = width * (0.29 + column * 0.21);
    return { x, shelfY, soilY: shelfY - pot.height * scale, scale, row };
  }

  // The shelf is the only fixed layer: painted once per size and theme, then copied every frame
  function buildBackdrop() {
    const surface = layer();
    paintShelf(surface.context);
    if (dark) nightTint(surface.context);
    backdrop = surface.canvas;
  }

  // How far a trailing vine may hang below the soil, in plant pixels: from the top shelf it falls past the
  // plank toward the middle shelf, from the middle shelf a little less, on the floor only down the pot
  function hangRoom(index: number) {
    const row = ROW_OF_SLOT[index];
    if (row === 'top') return 105;
    if (row === 'middle') return 90;
    return POTS[POT_TYPES[index]].height;
  }

  function plantBitmap(index: number): HTMLCanvasElement {
    const plant = state.plants[index]!;
    const stage = shownStage(index);
    const key = `${index}-${plant.species}-${stage}-${plant.seed}`;
    const cached = plantBitmaps.get(key);
    if (cached) return cached;
    const ratio = pixelRatio();
    const bitmap = document.createElement('canvas');
    bitmap.width = 200 * ratio;
    bitmap.height = PLANT_BITMAP_HEIGHT * ratio;
    const c = bitmap.getContext('2d')!;
    c.scale(ratio, ratio);
    c.translate(100, 130);
    paintPlant(c, plant.species, stage, plant.seed, hangRoom(index));
    plantBitmaps.set(key, bitmap);
    return bitmap;
  }

  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    if (!width || !backdrop) return;
    const time = now / 1000;
    // No wall: the shelf stands straight on the Insights glass
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backdrop, 0, 0, width, height);
    if (!foreground || foreground.canvas.width !== canvas.width) foreground = layer();
    const c = foreground.context;
    c.clearRect(0, 0, width, height);

    // Every slot has a pot; an empty one waits for a plant to be picked
    for (const row of ['top', 'middle', 'floor'] as Row[]) {
      for (let index = 0; index < SLOT_COUNT; index++) {
        if (ROW_OF_SLOT[index] !== row) continue;
        const { x, shelfY, scale } = slotPosition(index);
        const pot = POTS[POT_TYPES[index]];
        c.save();
        c.translate(x, shelfY - pot.height * scale);
        c.scale(scale, scale);
        paintPotBack(c, POT_TYPES[index]);
        c.restore();
        if (!state.plants[index]) continue;
        paintCreatures(c, time, index);

        const pulse = pulses.get(index) || 0;
        const grow = 1 + Math.sin(pulse * Math.PI) * 0.12;
        const lift = digLift(index, now);
        c.save();
        c.globalAlpha = lift.alpha;
        c.translate(x + lift.x, shelfY - pot.height * scale + 0.5 - lift.y);
        c.rotate(lift.tilt);
        c.rotate(Math.sin(time * 1.1 + index) * 0.018);
        c.scale(scale * grow, scale * grow);
        c.drawImage(plantBitmap(index), -100, -130, 200, PLANT_BITMAP_HEIGHT);
        c.restore();
        if (pulse > 0) pulses.set(index, Math.max(0, pulse - 0.025));
      }
    }

    paintCan(c, now);
    paintShovel(c, now);
    updateCreatures(time);
    paintCreatures(c, time);
    if (dark) nightTint(c);
    ctx.drawImage(foreground.canvas, 0, 0, width, height);
    paintCreatureLight(time);
    paintWater();
    paintDropBadge();
  }

  // Night: tint only what is already painted, so lamps and windows can stay bright.
  let tintMask: Layer | null = null;
  function nightTint(c: Ctx) {
    if (!tintMask || tintMask.canvas.width !== c.canvas.width) tintMask = layer();
    const copy = tintMask.context;
    copy.clearRect(0, 0, width, height);
    copy.drawImage(c.canvas, 0, 0, width, height);
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, c.canvas.width, c.canvas.height);
    c.filter = `url(#${options.nightFilterId})`;
    c.drawImage(tintMask.canvas, 0, 0);
    c.restore();
  }

  // Shelf wood, lit from the upper left like the plants; night darkens it through nightTint.
  const WOOD = {
    light: {
      top: ['#E9C08F', '#D6A774'],
      face: ['#DDAE79', '#C08A55', '#A8733F'],
      leg: ['#D9A872', '#B27C48', '#8E5E33'],
    },
  };

  const PLANK_DEPTH = 15,
    PLANK_THICKNESS = 8,
    LEG_WIDTH = 12;

  function plank(c: Ctx, y: number, left: number, right: number) {
    const wood = WOOD.light,
      depth = PLANK_DEPTH,
      thickness = PLANK_THICKNESS;
    const top = c.createLinearGradient(0, y - depth, 0, y);
    top.addColorStop(0, wood.top[1]);
    top.addColorStop(1, wood.top[0]);
    c.fillStyle = top;
    c.beginPath();
    c.moveTo(left + 5, y - depth);
    c.lineTo(right - 5, y - depth);
    c.lineTo(right, y);
    c.lineTo(left, y);
    c.closePath();
    c.fill();
    const face = c.createLinearGradient(0, y, 0, y + thickness);
    face.addColorStop(0, wood.face[0]);
    face.addColorStop(0.5, wood.face[1]);
    face.addColorStop(1, wood.face[2]);
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

  // A shelf with legs that splay slightly outward toward the floor, for a steadier stance.
  function legLean(x: number, top: number, bottom: number) {
    return ((x - width / 2) * (bottom - top)) / (height * 12);
  }

  function leg(c: Ctx, x: number, top: number, bottom: number, legWidth: number, shadeBy: number) {
    const wood = WOOD.light,
      lean = legLean(x + legWidth / 2, top, bottom);
    const body = c.createLinearGradient(x, 0, x + legWidth, 0);
    body.addColorStop(0, wood.leg[1]);
    body.addColorStop(0.25, wood.leg[0]);
    body.addColorStop(0.7, wood.leg[1]);
    body.addColorStop(1, wood.leg[2]);
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

  function paintShelf(c: Ctx) {
    const left = width * 0.05,
      right = width * 0.95,
      legWidth = LEG_WIDTH;
    const topY = height * ROWS.top,
      floorY = height * ROWS.floor;

    // Back legs sit higher and darker, so the shelf reads as having depth.
    for (const x of [left + 14, right - 14 - legWidth]) {
      const footX = leg(c, x, topY - 4, floorY - 9, legWidth - 1, 0.22);
      footShadow(c, footX, floorY - 9, 12);
    }
    plank(c, height * ROWS.middle, left - 3, right + 3);
    for (const x of [left + 3, right - 3 - legWidth]) {
      const footX = leg(c, x, topY + PLANK_THICKNESS - 2, floorY + 4, legWidth, 0);
      footShadow(c, footX, floorY + 4, 15);
    }
    plank(c, topY, left - 3, right + 3);
  }

  // Landing places read from the plant's own pixels: upper leaf edges, flowers, and covered spots under leaves.
  const plantSpotCache = new WeakMap<HTMLCanvasElement, Spots>();
  function plantSpots(index: number): Spots {
    const plant = state.plants[index];
    const empty: Spots = { tops: [], flowers: [], inside: [] };
    if (!plant || shownStage(index) < 2) return empty;
    const bitmap = plantBitmap(index);
    const cachedSpots = plantSpotCache.get(bitmap);
    if (cachedSpots) return cachedSpots;

    const ratio = bitmap.width / 200,
      data = bitmap.getContext('2d')!.getImageData(0, 0, bitmap.width, bitmap.height).data;
    const pixel = (u: number, v: number) => {
      const px = Math.round(u * ratio),
        py = Math.round(v * ratio);
      if (px < 0 || py < 0 || px >= bitmap.width || py >= bitmap.height) return [0, 0, 0, 0];
      const offset = (py * bitmap.width + px) * 4;
      return [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
    };
    const isFlower = ([red, green, blue]: number[]) => {
      const high = Math.max(red, green, blue),
        low = Math.min(red, green, blue);
      if (high - low < 60 || (high - low) / high < 0.4) return false;
      const hue =
        high === red
          ? (((green - blue) / (high - low) + 6) % 6) * 60
          : high === green
            ? ((blue - red) / (high - low) + 2) * 60
            : ((red - green) / (high - low) + 4) * 60;
      return hue < 52 || hue > 280;
    };

    // Only flowering species offer nectar; tomato reds and orange petioles are not flowers.
    const blooms = !!PLANTS[plant.species].flowering;
    const spots: Spots = { tops: [], flowers: [], inside: [] };
    for (let v = 4; v < 128; v += 1.5) {
      for (let u = 10; u < 190; u += 1.5) {
        const here = pixel(u, v);
        if (here[3] < 200) continue;
        const spot = { dx: u - 100, dy: v - 130 };
        if (blooms && isFlower(here)) spots.flowers.push(spot);
        else if (pixel(u, v - 2.5)[3] < 40) spots.tops.push(spot);
        else if (
          v < 122 &&
          [
            [-4, 0],
            [4, 0],
            [0, -4],
            [0, 4],
            [-3, -3],
            [3, -3],
          ].every(([du, dv]) => pixel(u + du, v + dv)[3] > 230)
        )
          spots.inside.push(spot);
      }
    }
    plantSpotCache.set(bitmap, spots);
    return spots;
  }

  function plantedIndices() {
    return state.plants
      .map((plant, index) => (plant && shownStage(index) >= 2 ? index : -1))
      .filter((index) => index >= 0);
  }
  function flowerSlots() {
    return plantedIndices().filter((index) => plantSpots(index).flowers.length > 2);
  }

  // A perch moves with its plant's sway, so a landed insect rides the leaf.
  function spotWorld(index: number, spot: Spot, time: number) {
    const { x, soilY, scale } = slotPosition(index);
    const sway = Math.sin(time * 1.1 + index) * 0.018;
    const along = spot.dx * scale,
      down = spot.dy * scale;
    return {
      x: x + along * Math.cos(sway) - down * Math.sin(sway),
      y: soilY + 0.5 + along * Math.sin(sway) + down * Math.cos(sway),
      scale,
    };
  }
  function rimSpot(index: number): Spot {
    const pot = POTS[POT_TYPES[index]];
    return { dx: between(-0.32, 0.32) * pot.width, dy: 1.2, rim: true };
  }
  function airPoint(): Goal {
    return { x: between(0.12, 0.88) * width, y: between(0.08, 0.5) * height };
  }
  function exitPoint(): Goal {
    return { x: Math.random() < 0.5 ? -40 : width + 40, y: between(0.05, 0.55) * height };
  }
  const world: GardenWorld = {
    get width() {
      return width;
    },
    height,
    plantSpots,
    plantedIndices,
    flowerSlots,
    spotWorld,
    rimSpot,
    potWidth: (index) => POTS[POT_TYPES[index]].width,
    airPoint,
    exitPoint,
    onScreen: (name) => {
      const index = CREATURES.findIndex((creature) => creature.name === name);
      return index < 0 ? 0 : actors[index].filter((actor) => actor.mode !== 'away').length;
    },
  };

  // Run every creature that belongs to the current theme
  function eachActive(visit: (creature: (typeof CREATURES)[number], actor: Actor) => void) {
    CREATURES.forEach((creature, index) => {
      if (creature.night !== dark) return;
      actors[index].forEach((actor) => visit(creature, actor));
    });
  }

  function updateCreatures(time: number) {
    const dt = Math.min(0.05, time - lastCreatureTime || 0.016);
    lastCreatureTime = time;
    eachActive((creature, actor) => creature.update(actor, world, dt, time));
  }

  // With behindIndex, paints only the creatures tucked behind that plant; without, everything in front
  function paintCreatures(c: Ctx, time: number, behindIndex: number | null = null) {
    eachActive((creature, actor) => {
      if (actor.mode === 'away') return;
      if ((creature.behindSlot?.(actor) ?? null) === behindIndex) creature.paint(c, actor, time);
    });
  }

  function paintCreatureLight(time: number) {
    eachActive((creature, actor) => {
      if (actor.mode !== 'away') creature.paintLight?.(ctx, actor, time);
    });
  }



  const CAN_SCALE = 1.3;
  function floorCanPosition() {
    return { x: width * 0.87, y: height * ROWS.floor + 2 };
  }

  function paintCan(c: Ctx, now: number) {
    const home = floorCanPosition();
    const pouring = pours[0];
    if (!pouring) {
      c.save();
      c.translate(home.x, home.y);
      c.scale(CAN_SCALE, CAN_SCALE);
      paintWateringCan(c, 0, 0);
      c.restore();
      return;
    }

    const progress = Math.min(1, (now - pouring.start) / POUR_MS);
    const ease = (value: number) => value * value * (3 - 2 * value);
    let x = pouring.toX,
      y = pouring.toY,
      tilt = 0;
    if (progress < 0.25) {
      const move = ease(progress / 0.25);
      x = home.x + (pouring.toX - home.x) * move;
      y = home.y + (pouring.toY - home.y) * move - Math.sin(move * Math.PI) * 24;
    } else if (progress < 0.7) {
      tilt = Math.min(1, (progress - 0.25) / 0.08) * 0.7;
    } else {
      const back = ease((progress - 0.7) / 0.3);
      tilt = Math.max(0, 1 - back * 3) * 0.7;
      x = pouring.toX + (home.x - pouring.toX) * back;
      y = pouring.toY + (home.y - pouring.toY) * back - Math.sin(back * Math.PI) * 24;
    }
    c.save();
    c.translate(x, y);
    c.rotate(-tilt);
    c.scale(CAN_SCALE, CAN_SCALE);
    paintWateringCan(c, 0, 0, false);
    c.restore();
    if (progress >= 1) pours.shift();
  }

  function paintWater() {
    for (let index = drops.length - 1; index >= 0; index--) {
      const drop = drops[index];
      if (drop.delay > 0) {
        drop.delay--;
        continue;
      }
      drop.vy += 0.35;
      drop.y += drop.vy;
      ctx.fillStyle = 'rgba(120,190,230,.95)';
      ctx.beginPath();
      ctx.ellipse(drop.x, drop.y, 1.8, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (drop.y >= drop.groundY) {
        ripples.push({ x: drop.x, y: drop.groundY, life: 1 });
        drops.splice(index, 1);
      }
    }
    for (let index = ripples.length - 1; index >= 0; index--) {
      const ripple = ripples[index];
      ctx.strokeStyle = `rgba(150,205,235,${ripple.life})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(ripple.x, ripple.y, 8 * (1.4 - ripple.life), 2 * (1.4 - ripple.life), 0, 0, Math.PI * 2);
      ctx.stroke();
      ripple.life -= 0.05;
      if (ripple.life <= 0) ripples.splice(index, 1);
    }
    for (let index = sparkles.length - 1; index >= 0; index--) {
      const spark = sparkles[index];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life -= 0.02;
      ctx.globalAlpha = Math.max(0, spark.life);
      ctx.fillStyle = '#FFE7A3';
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      if (spark.life <= 0) sparkles.splice(index, 1);
    }
  }

  // Drops ready to pour, as a small badge on the watering can's lower right corner
  function paintDropBadge() {
    if (pours.length) return;
    const home = floorCanPosition();
    const x = home.x + 7 * CAN_SCALE,
      y = home.y - 2;
    const label = String(options.getDrops());
    ctx.save();
    ctx.fillStyle = badge.primary;
    ctx.beginPath();
    ctx.arc(x, y, 8.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = badge.onPrimary;
    ctx.font = '700 11px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
    ctx.restore();
  }

  // Nearest pot to a point on the canvas, or -1 when the point is not near any pot
  function slotAt(x: number, y: number) {
    let found = -1,
      best = 40;
    for (let index = 0; index < SLOT_COUNT; index++) {
      const slot = slotPosition(index);
      const distance = Math.hypot(x - slot.x, y - (slot.soilY - 14 * slot.scale));
      if (distance < best) {
        best = distance;
        found = index;
      }
    }
    return found;
  }

  function pour(index: number, fromStage: number) {
    const plant = state.plants[index];
    if (!plant) return;
    shownOverride.set(index, fromStage);
    const { x, soilY, scale } = slotPosition(index);
    // Tilted 0.7 rad, the spout tip sits 29px left and 5px above the can's base (times its scale).
    const spoutY = soilY - 40 * scale - 5 * CAN_SCALE;
    pours.push({ toX: x + 29 * CAN_SCALE, toY: spoutY + 5 * CAN_SCALE, start: performance.now() });
    for (let count = 0; count < 12; count++) {
      drops.push({
        x: x + (Math.random() - 0.5) * 5,
        y: spoutY,
        vy: 0.5,
        delay: 30 + count * 2,
        groundY: soilY + Math.random() * 2,
      });
    }
    const timer = setTimeout(() => {
      timers.delete(timer);
      shownOverride.delete(index);
      pulses.set(index, 1);
      if (state.plants[index]?.stage === MAX_STAGE) {
        for (let count = 0; count < 16; count++)
          sparkles.push({ x, y: soilY - 30, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.8) * 2, life: 1 });
      }
    }, 950);
    timers.add(timer);
  }

  // ── Shovel: a double-click on a grown plant digs it out of its pot ──
  const DIG_MS = 1400;
  const digs = new Map<number, { start: number; onDone: () => void }>();
  const clods: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  const easeInOut = (value: number) => value * value * (3 - 2 * value);

  function dig(index: number, onDone: () => void) {
    if (!state.plants[index] || digs.has(index)) return;
    digs.set(index, { start: performance.now(), onDone });
  }

  // How far the plant has come out of the soil: it rises once the shovel levers up, then fades away
  function digLift(index: number, now: number) {
    const job = digs.get(index);
    if (!job) return { x: 0, y: 0, tilt: 0, alpha: 1 };
    const progress = clamp((now - job.start) / DIG_MS, 0, 1);
    const out = easeInOut(clamp((progress - 0.5) / 0.5, 0, 1));
    return { x: out * 10, y: out * 46, tilt: out * 0.25, alpha: 1 - clamp((progress - 0.75) / 0.25, 0, 1) };
  }

  function paintShovel(c: Ctx, now: number) {
    for (const [index, job] of digs) {
      const progress = (now - job.start) / DIG_MS;
      if (progress >= 1) {
        digs.delete(index);
        job.onDone();
        continue;
      }
      const { x, soilY, scale } = slotPosition(index);
      // Swoops in from the upper right, pushes into the soil, then levers the plant up and leaves
      const tipX = x + 12 * scale;
      const tipY = soilY + 4 * scale;
      let px = tipX;
      let py = tipY;
      let angle = 0.5;
      let alpha = 1;
      if (progress < 0.3) {
        const move = easeInOut(progress / 0.3);
        px = tipX + (1 - move) * 60;
        py = tipY - (1 - move) * 70 - 8;
        angle = 0.5 + (1 - move) * 0.4;
      } else if (progress < 0.5) {
        py = tipY - 8 + easeInOut((progress - 0.3) / 0.2) * 8;
        if (Math.random() < 0.5) {
          clods.push({ x: tipX + between(-6, 6), y: soilY, vx: between(-0.9, 0.9), vy: between(-2.4, -1.2), life: 1 });
        }
      } else {
        const lever = easeInOut((progress - 0.5) / 0.5);
        angle = 0.5 - lever * 0.7;
        py = tipY - lever * 40;
        px = tipX + lever * 18;
        alpha = 1 - clamp((progress - 0.8) / 0.2, 0, 1);
      }
      c.save();
      c.globalAlpha = alpha;
      c.translate(px, py);
      c.rotate(angle);
      c.scale(scale, scale);
      paintShovelShape(c);
      c.restore();
    }

    // Bits of soil thrown up by the blade
    for (let index = clods.length - 1; index >= 0; index--) {
      const clod = clods[index];
      clod.vy += 0.18;
      clod.x += clod.vx;
      clod.y += clod.vy;
      clod.life -= 0.03;
      c.globalAlpha = Math.max(0, clod.life);
      c.fillStyle = '#4A3528';
      c.beginPath();
      c.arc(clod.x, clod.y, 1.3, 0, TAU);
      c.fill();
      c.globalAlpha = 1;
      if (clod.life <= 0) clods.splice(index, 1);
    }
  }

  resize();
  frameId = requestAnimationFrame(frame);

  return {
    resize,
    setTheme(theme) {
      // Day and night creatures start over when the theme flips
      if (theme.dark !== dark) {
        CREATURES.forEach((creature) => creature.reset?.());
        actors = freshActors();
      }
      dark = theme.dark;
      badge = { primary: theme.primary, onPrimary: theme.onPrimary };
      plantBitmaps.clear();
      if (width) buildBackdrop();
    },
    slotAt,
    slotAnchor(index) {
      const slot = slotPosition(index);
      return { x: slot.x, y: slot.soilY };
    },
    pulse(index) {
      pulses.set(index, 0.5);
    },
    pour,
    isPouring: () => pours.length > 0 || digs.size > 0,
    dig,
    destroy() {
      cancelAnimationFrame(frameId);
      timers.forEach(clearTimeout);
    },
  };
}

// Small preview of a grown plant in its pot, for the plant picker
export function paintPlantPreview(target: HTMLCanvasElement, species: SpeciesKey, size: number) {
  const ratio = window.devicePixelRatio || 1;
  target.width = size * ratio;
  target.height = size * ratio;
  const c = target.getContext('2d')!;
  c.scale(ratio, ratio);
  c.translate(size / 2, size * 0.6);
  c.scale(size / 90, size / 90);
  paintPotBack(c, 'terracotta');
  c.translate(0, 0.5);
  paintPlant(c, species, MAX_STAGE, 110);
}
