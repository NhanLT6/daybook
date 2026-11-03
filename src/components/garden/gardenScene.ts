// Garden scene, ported from the Talksum garden mock: pots, plants and insects all painted with Canvas 2D.
// Game rules (drops, which plant grows) live in useGarden.ts and the scene only reads that state. Everything the
// scene paints comes from its own folder, one file each: plants, pots, creatures, tools (watering can, trowel)
// and layouts. A layout decides where the pots stand and paints the scenery behind them (the shelf is one), so
// another arrangement is a new file under ./layouts, not a change here.
import type { Actor, Ctx, GardenWorld, Goal, Spot, Spots } from './creatures/kit';
import type { GardenLayout, LayoutSlot } from './layouts/kit';
import type { PlantKey } from './plants';

import { CREATURES } from './creatures';
import { between, clamp, TAU } from './creatures/kit';
import { shelfLayout } from './layouts/shelf';
import { PLANTS } from './plants';
import { paintPlant } from './plants/paint';
import { POTS } from './pots';
import { paintPot } from './pots/kit';
import { paintShovelShape } from './tools/shovel';
import { paintWateringCan } from './tools/wateringCan';

export { newSeed } from './plants/paint';

// Plant names and painters, one file per plant
export const SPECIES = PLANTS;
export type SpeciesKey = PlantKey;

export const MAX_STAGE = 4;
// Plant slots kept in the garden state; a layout shows some or all of them
export const SLOT_COUNT = 9;

export interface GardenPlant {
  species: SpeciesKey;
  stage: number; // 0 seed … 4 grown
  seed: number; // keeps the plant's shape the same while it grows
}

// ── Scene ───────────────────────────────────────────────────────────────────────

interface Layer {
  canvas: HTMLCanvasElement;
  context: Ctx;
}

// Night tint colour matrix, shared by every garden (each document needs its own <filter> element with it)
export const NIGHT_MATRIX = '0.80 0 0 0 0  0 0.78 0 0 0  0 0 0.91 0 0  0 0 0 1 0';

export interface GardenSceneOptions {
  height: number;
  nightFilterId: string;
  getPlants: () => (GardenPlant | null)[];
  getDrops: () => number;
  // Where the pots stand; the two-tier shelf when left out
  layout?: GardenLayout;
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

// Plant bitmaps span 130 plant pixels above the soil and the rest below it, room for hanging vines
const PLANT_BITMAP_HEIGHT = 300;

export function createGardenScene(canvas: HTMLCanvasElement, options: GardenSceneOptions): GardenScene {
  const ctx = canvas.getContext('2d')!;
  const layout = options.layout ?? shelfLayout;
  let width = 0;
  const height = options.height;
  // Recomputed on resize: the layout's slots in paint order, and the same slots by plant index
  let slots: LayoutSlot[] = [];
  const slotByIndex = new Map<number, LayoutSlot>();
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
    slots = layout.slots(width, height);
    slotByIndex.clear();
    slots.forEach((slot) => slotByIndex.set(slot.index, slot));
    plantBitmaps.clear();
    foreground = null;
    buildBackdrop();
  }

  // Only plant indices the layout places exist in this scene
  const slotOf = (index: number) => slotByIndex.get(index)!;

  // The layout's scenery is the only fixed layer: painted once per size and theme, then copied every frame
  function buildBackdrop() {
    const surface = layer();
    layout.paintBackdrop(surface.context, width, height);
    if (dark) nightTint(surface.context);
    backdrop = surface.canvas;
  }

  function plantBitmap(index: number): HTMLCanvasElement {
    const plant = state.plants[index]!;
    const stage = shownStage(index);
    const key = `${index}-${plant.species}-${stage}-${plant.seed}`;
    const cached = plantBitmaps.get(key);
    if (cached) return cached;
    // Painted at the size it is shown, so a plant scaled up in a large layout stays sharp
    const ratio = pixelRatio() * Math.max(1, slotOf(index).scale);
    const bitmap = document.createElement('canvas');
    bitmap.width = 200 * ratio;
    bitmap.height = PLANT_BITMAP_HEIGHT * ratio;
    const c = bitmap.getContext('2d')!;
    c.scale(ratio, ratio);
    c.translate(100, 130);
    paintPlant(c, plant.species, stage, plant.seed, slotOf(index).hangRoom);
    plantBitmaps.set(key, bitmap);
    return bitmap;
  }

  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    if (!width || !backdrop) return;
    const time = now / 1000;
    // No wall: the scenery stands straight on whatever is behind the canvas
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(backdrop, 0, 0, width, height);
    if (!foreground || foreground.canvas.width !== canvas.width) foreground = layer();
    const c = foreground.context;
    c.clearRect(0, 0, width, height);

    // Every slot has a pot; an empty one waits for a plant to be picked
    for (const { index, x, soilY, scale, pot } of slots) {
      c.save();
      c.translate(x, soilY);
      c.scale(scale, scale);
      paintPot(c, pot);
      c.restore();
      if (!state.plants[index]) continue;
      paintCreatures(c, time, index);

      const pulse = pulses.get(index) || 0;
      const grow = 1 + Math.sin(pulse * Math.PI) * 0.12;
      const lift = digLift(index, now);
      c.save();
      c.globalAlpha = lift.alpha;
      c.translate(x + lift.x, soilY + 0.5 - lift.y);
      c.rotate(lift.tilt);
      c.rotate(Math.sin(time * 1.1 + index) * 0.03);
      c.scale(scale * grow, scale * grow);
      c.drawImage(plantBitmap(index), -100, -130, 200, PLANT_BITMAP_HEIGHT);
      c.restore();
      if (pulse > 0) pulses.set(index, Math.max(0, pulse - 0.025));
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

  // Landing places read from the plant's own pixels: upper leaf edges, flowers, and covered spots under leaves.
  const plantSpotCache = new WeakMap<HTMLCanvasElement, Spots>();
  function plantSpots(index: number): Spots {
    const plant = state.plants[index];
    const empty: Spots = { tops: [], flowers: [], inside: [], seeds: [] };
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
    // Seed fluff is thin and pale, so it is read before the solid-pixel test
    const drifts = !!PLANTS[plant.species].drifts;
    const isFluff = ([red, green, blue, alpha]: number[]) =>
      alpha > 90 && Math.min(red, green, blue) > 215 && Math.max(red, green, blue) - Math.min(red, green, blue) < 30;
    const spots: Spots = { tops: [], flowers: [], inside: [], seeds: [] };
    for (let v = 4; v < 128; v += 1.5) {
      for (let u = 10; u < 190; u += 1.5) {
        const here = pixel(u, v);
        const spot = { dx: u - 100, dy: v - 130 };
        if (drifts && isFluff(here)) {
          spots.seeds.push(spot);
          continue;
        }
        if (here[3] < 200) continue;
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

  // Only plants this layout shows: creatures never fly to a pot that is off screen
  function plantedIndices() {
    return slots.map((slot) => slot.index).filter((index) => state.plants[index] && shownStage(index) >= 2);
  }
  function flowerSlots() {
    return plantedIndices().filter((index) => plantSpots(index).flowers.length > 2);
  }
  function seedSlots() {
    return plantedIndices().filter((index) => plantSpots(index).seeds.length > 4);
  }

  // A perch moves with its plant's sway, so a landed insect rides the leaf.
  function spotWorld(index: number, spot: Spot, time: number) {
    const { x, soilY, scale } = slotOf(index);
    const sway = Math.sin(time * 1.1 + index) * 0.03;
    const along = spot.dx * scale,
      down = spot.dy * scale;
    return {
      x: x + along * Math.cos(sway) - down * Math.sin(sway),
      y: soilY + 0.5 + along * Math.sin(sway) + down * Math.cos(sway),
      scale,
    };
  }
  function rimSpot(index: number): Spot {
    const pot = slotOf(index).pot;
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
    get height() {
      return height;
    },
    plantSpots,
    plantedIndices,
    flowerSlots,
    seedSlots,
    spotWorld,
    rimSpot,
    potWidth: (index) => slotOf(index).pot.width,
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
      if (creature.night !== undefined && creature.night !== dark) return;
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

  const CAN_SCALE = layout.canScale;
  const floorCanPosition = () => layout.canHome(width, height);

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
    for (const slot of slots) {
      const distance = Math.hypot(x - slot.x, y - (slot.soilY - 14 * slot.scale));
      if (distance < best) {
        best = distance;
        found = slot.index;
      }
    }
    return found;
  }

  function pour(index: number, fromStage: number) {
    const plant = state.plants[index];
    if (!plant) return;
    shownOverride.set(index, fromStage);
    const { x, soilY, scale } = slotOf(index);
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
      const { x, soilY, scale } = slotOf(index);
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
      const slot = slotOf(index);
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
  paintPot(c, POTS.terracotta);
  c.translate(0, 0.5);
  paintPlant(c, species, MAX_STAGE, 110);
}
