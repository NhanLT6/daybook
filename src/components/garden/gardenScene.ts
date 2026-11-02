// Garden scene, ported from the Talksum garden mock: a two-tier wooden shelf against a plain wall, nine pots,
// plants and insects all painted with Canvas 2D. The drawing code stays close to the mock on purpose; game
// rules (drops, which plant grows) live in useGarden.ts and the scene only reads that state.

export type Ctx = CanvasRenderingContext2D;

export const SPECIES = {
  trauba: { name: 'Pothos', done: 'trails long vines' },
  cachua: { name: 'Cherry tomato', done: 'bears fruit' },
  duongxi: { name: 'Fern', done: 'is lush and full' },
  cuc: { name: 'Daisy', done: 'is in bloom' },
  senda: { name: 'Succulent', done: 'is in flower' },
  xuongrong: { name: 'Cactus', done: 'is in bloom' },
  hacam: { name: 'Bird of paradise', done: 'stands tall' },
} as const;

export type SpeciesKey = keyof typeof SPECIES;

export const MAX_STAGE = 4;
export const SLOT_COUNT = 9;

export interface GardenPlant {
  species: SpeciesKey;
  stage: number; // 0 seed … 4 grown
  seed: number; // keeps the plant's shape the same while it grows
}

type LeafShape = 'heart' | 'plump' | 'oval';
interface Tone {
  light: string;
  mid: string;
  dark: string;
}
interface Vec3 {
  x: number;
  y: number;
  z: number;
}
interface LadybirdPose {
  open: number;
  wings: number;
  buzz: boolean;
  stride: number;
  legsDown: boolean;
  time: number;
}
interface ButterflyPose {
  mode: string;
  yaw: number;
  theta: number;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  bob: number;
  scale: number;
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

const LIGHT = { x: -0.6, y: -0.8 };
const TAU = Math.PI * 2;
const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const between = (low: number, high: number) => low + Math.random() * (high - low);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const approach = (value: number, goal: number, rate: number, dt: number) =>
  value + (goal - value) * Math.min(1, rate * dt);

export function newSeed() {
  return 1 + Math.floor(Math.random() * 2147483646);
}

function seeded(seed: number): () => number {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

// Painting helpers: every shape is lit from the upper left and shaded toward its base.
const TONES = {
  deep: { light: '#86B95E', mid: '#4F8C3F', dark: '#2B5A2B' },
  fresh: { light: '#C3DE73', mid: '#82B44C', dark: '#4A7C32' },
  sage: { light: '#9BC797', mid: '#5F9A6D', dark: '#356549' },
  waxy: { light: '#A9D3AE', mid: '#6FA98A', dark: '#3E7563' },
};

function leafPath(c: Ctx, length: number, width: number, shape: LeafShape) {
  c.beginPath();
  c.moveTo(0, 0);
  if (shape === 'heart') {
    c.bezierCurveTo(-length * 0.14, -width * 1.15, length * 0.55, -width * 1.25, length, 0);
    c.bezierCurveTo(length * 0.55, width * 1.25, -length * 0.14, width * 1.15, 0, 0);
  } else if (shape === 'plump') {
    c.bezierCurveTo(length * 0.1, -width * 1.1, length * 1.02, -width * 0.9, length, 0);
    c.bezierCurveTo(length * 1.02, width * 0.9, length * 0.1, width * 1.1, 0, 0);
  } else {
    c.bezierCurveTo(length * 0.25, -width, length * 0.75, -width, length, 0);
    c.bezierCurveTo(length * 0.75, width, length * 0.25, width, 0, 0);
  }
  c.closePath();
}

function paintLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  tone: Tone,
  shape: LeafShape = 'oval',
  depth = 0,
  blush: string | null = null,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  leafPath(c, length, width, shape);
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  const across = c.createLinearGradient(0, -width, 0, width);
  across.addColorStop(0, upperLit ? tone.light : tone.dark);
  across.addColorStop(0.5, tone.mid);
  across.addColorStop(1, upperLit ? tone.dark : tone.mid);
  c.fillStyle = across;
  c.fill();

  const along = c.createLinearGradient(0, 0, length, 0);
  along.addColorStop(0, 'rgba(12,40,22,.42)');
  along.addColorStop(0.55, 'rgba(12,40,22,0)');
  c.fillStyle = along;
  c.fill();
  if (blush) {
    const tip = c.createRadialGradient(length, 0, 0, length, 0, length * 0.5);
    tip.addColorStop(0, blush);
    tip.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = tip;
    c.fill();
  }
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill();
  }

  c.strokeStyle = 'rgba(225,245,170,.28)';
  c.lineWidth = 0.7;
  c.stroke();
  if (shape !== 'plump') {
    c.strokeStyle = 'rgba(235,250,205,.32)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(length * 0.06, 0);
    c.quadraticCurveTo(length * 0.5, -width * 0.12, length * 0.88, 0);
    c.stroke();
  }
  c.restore();
}

function stem(
  c: Ctx,
  fromX: number,
  fromY: number,
  controlX: number,
  controlY: number,
  toX: number,
  toY: number,
  thickness: number,
  color = '#5B7D3A',
) {
  c.strokeStyle = color;
  c.lineWidth = thickness;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(fromX, fromY);
  c.quadraticCurveTo(controlX, controlY, toX, toY);
  c.stroke();
}

function glossyBall(c: Ctx, x: number, y: number, radius: number, light: string, mid: string, dark: string) {
  const body = c.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.1, x, y, radius);
  body.addColorStop(0, light);
  body.addColorStop(0.55, mid);
  body.addColorStop(1, dark);
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath();
  c.ellipse(x - radius * 0.38, y - radius * 0.42, radius * 0.22, radius * 0.14, -0.6, 0, Math.PI * 2);
  c.fill();
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

// Plant painters: same seed every stage, so a plant keeps its shape while it grows.
const PLANT_PAINTERS = {
  trauba(c: Ctx, stage: number, random: () => number) {
    const leaves = [];
    for (let index = 0; index < 11; index++) {
      const drape = index >= 7;
      const angle = drape
        ? (index % 2 ? 0.25 : Math.PI - 0.25) + (random() - 0.5) * 0.3
        : -Math.PI / 2 + (random() - 0.5) * 2.3;
      const reach = (drape ? 20 + random() * 10 : 16 + random() * 22) * (0.55 + stage * 0.1);
      leaves.push({ angle, reach, drape, depth: random(), size: 9 + random() * 5, twist: (random() - 0.5) * 0.7 });
    }
    const visible = leaves.slice(0, [0, 2, 4, 7, 11][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const endX = Math.cos(leaf.angle) * leaf.reach;
      const endY = leaf.drape ? leaf.reach * 0.4 : Math.sin(leaf.angle) * leaf.reach;
      stem(c, 0, 0, endX * 0.5, Math.min(endY, 0) - (leaf.drape ? 14 : 8), endX, endY, 1.3);
      const size = leaf.size * (0.6 + stage * 0.12);
      const pointing = leaf.drape ? Math.PI / 2 + (endX > 0 ? -0.5 : 0.5) : leaf.angle + leaf.twist;
      paintLeaf(
        c,
        endX,
        endY,
        pointing,
        size * 1.6,
        size * 0.62,
        leaf.depth > 0.6 ? TONES.deep : TONES.fresh,
        'heart',
        leaf.depth * 0.8,
      );
    }
    if (stage === 4) {
      stem(c, 0, 0, 3, -18, 2, -34, 1.3);
      paintLeaf(c, 2, -34, -Math.PI / 2 - 0.2, 12, 4, TONES.fresh, 'heart', 0);
    }
  },

  duongxi(c: Ctx, stage: number, random: () => number) {
    const fronds = [];
    for (let index = 0; index < 20; index++) {
      fronds.push({ angle: -Math.PI / 2 + (random() - 0.5) * 1.5, length: 50 + random() * 24, depth: random() });
    }
    const visible = fronds.slice(0, [0, 4, 8, 13, 20][stage]).sort((a, b) => b.depth - a.depth);
    for (const frond of visible) {
      const length = frond.length * (0.5 + stage * 0.13);
      const point = (t: number) => ({
        x: Math.cos(frond.angle) * length * t,
        y: Math.sin(frond.angle) * length * t + t * t * length * 0.18,
      });
      const tone = frond.depth > 0.55 ? TONES.deep : TONES.fresh;
      c.strokeStyle = '#4D7434';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 0);
      for (let t = 0.1; t <= 1.001; t += 0.1) {
        const p = point(t);
        c.lineTo(p.x, p.y);
      }
      c.stroke();
      // A frond is widest about a quarter of the way up, then narrows evenly to a point.
      for (let t = 0.08; t < 0.985; t += 0.045) {
        const p = point(t),
          next = point(t + 0.02);
        const tangent = Math.atan2(next.y - p.y, next.x - p.x);
        const profile = t < 0.25 ? 0.65 + 0.35 * (t / 0.25) : (1 - t) / 0.75;
        const size = Math.max(1.2, 10 * profile) * (0.75 + stage * 0.07);
        paintLeaf(c, p.x, p.y, tangent - 1.0, size, size * 0.34, tone, 'oval', frond.depth * 0.7);
        paintLeaf(c, p.x, p.y, tangent + 1.0, size, size * 0.34, tone, 'oval', frond.depth * 0.7);
      }
      const tip = point(0.985),
        end = point(1);
      paintLeaf(c, tip.x, tip.y, Math.atan2(end.y - tip.y, end.x - tip.x), 2.2, 0.7, tone, 'oval', frond.depth * 0.7);
    }
  },

  senda(c: Ctx, stage: number, random: () => number) {
    const rings = [0, 2, 3, 4, 4][stage];
    const leaves = [];
    for (let ring = rings; ring >= 1; ring--) {
      const count = 6 + ring;
      for (let index = 0; index < count; index++) {
        const around = (index / count) * Math.PI * 2 + ring * 0.6 + random() * 0.2;
        leaves.push({ around, ring, length: (5 + ring * 3.4) * (0.75 + stage * 0.07) });
      }
    }
    leaves.sort((a, b) => Math.sin(a.around) - Math.sin(b.around));
    for (const leaf of leaves) {
      const tilt = 0.55 + 0.45 * Math.abs(Math.cos(leaf.around));
      const lift = (rings + 1 - leaf.ring) * 2.6;
      const angle = Math.atan2(Math.sin(leaf.around) * 0.42 - lift * 0.05, Math.cos(leaf.around));
      const back = Math.sin(leaf.around) < 0;
      paintLeaf(
        c,
        0,
        -lift - 2,
        angle,
        leaf.length * tilt,
        leaf.length * 0.36,
        TONES.waxy,
        'plump',
        back ? 0.45 : 0,
        stage >= 3 && leaf.ring >= rings - 1 ? 'rgba(214,120,150,.75)' : 'rgba(214,120,150,.25)',
      );
    }
    if (stage === 4) {
      stem(c, 3, -12, 14, -40, 8, -52, 1.6, '#9C8C5E');
      for (let index = 0; index < 4; index++)
        glossyBall(c, 8 + (index - 1.5) * 4, -52 + Math.abs(index - 1.5) * 3, 2.6, '#FFC59A', '#F08A4E', '#B5552C');
    }
  },

  xuongrong(c: Ctx, stage: number, random: () => number) {
    const radius = [0, 8, 12, 15, 18][stage];
    const half = radius * 1.08,
      centerY = -half;
    // Barrel profile: flatter top and base than a ball.
    const halfWidth = (y: number) =>
      radius * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y - centerY) / half, 2.6)), 1 / 2.6);
    const body = new Path2D();
    for (let step = 0; step <= 40; step++) {
      const y = centerY - half + (step / 40) * half * 2;
      body.lineTo(-halfWidth(y), y);
    }
    for (let step = 40; step >= 0; step--) {
      const y = centerY - half + (step / 40) * half * 2;
      body.lineTo(halfWidth(y), y);
    }
    body.closePath();
    const across = c.createLinearGradient(-radius, 0, radius, 0);
    across.addColorStop(0, '#4E8F4E');
    across.addColorStop(0.3, '#7DB66A');
    across.addColorStop(0.65, '#3F7D45');
    across.addColorStop(1, '#1F4D2E');
    c.fillStyle = across;
    c.fill(body);

    c.save();
    c.clip(body);
    const down = c.createLinearGradient(0, centerY - half, 0, 0);
    down.addColorStop(0, 'rgba(220,240,170,.22)');
    down.addColorStop(0.5, 'rgba(0,0,0,0)');
    down.addColorStop(1, 'rgba(10,30,15,.4)');
    c.fillStyle = down;
    c.fillRect(-radius, centerY - half, radius * 2, half * 2);
    // Ribs: each groove is a dark crease, each ridge a lit edge, both foreshortened toward the sides.
    const ribs = 14,
      along = (theta: number, y: number) => Math.sin(theta) * halfWidth(y);
    const trace = (theta: number) => {
      c.beginPath();
      for (let step = 0; step <= 30; step++) {
        const y = centerY - half + (step / 30) * half * 2;
        c.lineTo(along(theta, y), y);
      }
    };
    for (let index = 0; index < ribs; index++) {
      const groove = -Math.PI + (index / ribs) * Math.PI * 2,
        ridge = groove + Math.PI / ribs;
      if (Math.cos(groove) > 0) {
        trace(groove);
        c.strokeStyle = `rgba(12,40,20,${0.25 + 0.35 * Math.cos(groove)})`;
        c.lineWidth = 0.5 + 1.4 * Math.cos(groove);
        c.stroke();
      }
      if (Math.cos(ridge) > 0) {
        const lit = Math.sin(ridge) < 0 ? 0.5 : 0.18;
        trace(ridge);
        c.strokeStyle = `rgba(200,235,160,${lit * Math.cos(ridge)})`;
        c.lineWidth = 0.4 + 0.9 * Math.cos(ridge);
        c.stroke();
      }
    }
    c.restore();

    // Areoles with small spine clusters run down each ridge.
    for (let index = 0; index < ribs; index++) {
      const ridge = -Math.PI + ((index + 0.5) / ribs) * Math.PI * 2;
      if (Math.cos(ridge) < 0.2) continue;
      for (let row = 1; row <= 6; row++) {
        const y = centerY - half + (row / 7) * half * 2;
        const x = along(ridge, y);
        c.strokeStyle = 'rgba(245,232,190,.85)';
        c.lineWidth = 0.35;
        for (let spine = 0; spine < 6; spine++) {
          const angle = (spine / 6) * Math.PI * 2 + random() * 0.4,
            length = 1.6 + random() * 1.4;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(angle) * length * Math.cos(ridge), y + Math.sin(angle) * length);
          c.stroke();
        }
        c.fillStyle = 'rgba(250,244,222,.95)';
        c.beginPath();
        c.arc(x, y, 0.65, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Woolly crown where new areoles form.
    const crown = c.createRadialGradient(0, centerY - half + 2, 0, 0, centerY - half + 2, radius * 0.4);
    crown.addColorStop(0, 'rgba(250,244,220,.8)');
    crown.addColorStop(1, 'rgba(250,244,220,0)');
    c.fillStyle = crown;
    c.beginPath();
    c.ellipse(0, centerY - half + 2, radius * 0.4, radius * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    if (stage >= 3) {
      // The bloom opens from an areole anywhere on the upper third, not always the crown.
      const bloomY = centerY - half + 1 + random() * half * 0.6;
      const bloomX = Math.sin((random() - 0.5) * 2.2) * halfWidth(bloomY) * 0.85;
      c.translate(bloomX, bloomY - (centerY - half + 1));
      const top = centerY - half + 1;
      if (stage === 3) {
        glossyBall(c, 0, top - 2, 3, '#F7B4C8', '#DE6C94', '#9E3A62');
        return;
      }
      // One round bloom sitting on top of the body: an outer ring, a lighter inner ring, the centre.
      const petal = { light: '#FFC2D6', mid: '#EC7FA6', dark: '#B2456F' };
      const inner = { light: '#FFE1EA', mid: '#F6A9C3', dark: '#D9709A' };
      for (let index = 0; index < 14; index++) {
        paintLeaf(c, 0, top - 4, (index / 14) * Math.PI * 2 + random() * 0.12, 10, 3.2, petal, 'oval', 0);
      }
      for (let index = 0; index < 9; index++) {
        paintLeaf(c, 0, top - 4, (index / 9) * Math.PI * 2 + 0.3 + random() * 0.12, 6, 2.4, inner, 'oval', 0);
      }
      glossyBall(c, 0, top - 4, 2.6, '#FFF2A8', '#F2C33E', '#C08A1C');
    }
  },

  cachua(c: Ctx, stage: number, random: () => number) {
    const height = [0, 14, 28, 40, 46][stage];
    if (stage >= 2) {
      const cane = c.createLinearGradient(-2, 0, 2, 0);
      cane.addColorStop(0, '#E7CF9F');
      cane.addColorStop(1, '#A98A55');
      c.fillStyle = cane;
      c.fillRect(-1.2, -height - 6, 2.4, height + 6);
    }
    stem(c, 0, 0, 3, -height / 2, 1, -height, 1.8);
    const leaves = [];
    for (let index = 0; index < 16; index++) {
      leaves.push({ level: 0.2 + random() * 0.8, side: index % 2 ? 1 : -1, size: 8 + random() * 5, depth: random() });
    }
    for (const leaf of leaves.slice(0, [0, 3, 7, 12, 16][stage]).sort((a, b) => b.depth - a.depth)) {
      const angle = leaf.side > 0 ? -0.5 - leaf.depth * 0.4 : Math.PI + 0.5 + leaf.depth * 0.4;
      paintLeaf(
        c,
        1,
        -height * leaf.level,
        angle,
        leaf.size * (0.6 + stage * 0.1),
        leaf.size * 0.32,
        TONES.deep,
        'oval',
        leaf.depth * 0.7,
      );
    }
    if (stage === 3)
      for (const [x, y] of [
        [-8, -26],
        [7, -33],
      ]) {
        c.fillStyle = '#F4D04A';
        c.beginPath();
        c.arc(x, y, 2, 0, Math.PI * 2);
        c.fill();
      }
    if (stage === 4) {
      const fruits = [
        [-9, -14, 4.2, 0],
        [-5, -10, 3.8, 0],
        [8, -22, 4.2, 0],
        [11, -17, 3.6, 1],
        [-7, -34, 3.8, 0],
        [4, -38, 3.2, 2],
      ];
      for (const [x, y, radius, ripeness] of fruits) {
        const colors = [
          ['#FF9A7A', '#E2412C', '#93210F'],
          ['#FFC27A', '#F08A2C', '#A9531A'],
          ['#C8E08A', '#86B34C', '#4F7A2C'],
        ][ripeness];
        glossyBall(c, x, y, radius, colors[0], colors[1], colors[2]);
        c.fillStyle = '#3F6E2C';
        c.beginPath();
        c.arc(x, y - radius + 0.6, 1.3, 0, Math.PI * 2);
        c.fill();
      }
    }
  },

  hacam(c: Ctx, stage: number, random: () => number) {
    const leaves = [];
    for (let index = 0; index < 7; index++) {
      const spread = (index / 6 - 0.5) * 1.2 + (random() - 0.5) * 0.2;
      leaves.push({
        spread,
        reach: 20 + random() * 14,
        droop: 0.15 + random() * 0.5,
        depth: random(),
        size: 0.85 + random() * 0.3,
      });
    }
    const visible = leaves.slice(0, [0, 2, 3, 5, 7][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const reach = leaf.reach * (0.5 + stage * 0.13);
      const endX = Math.sin(leaf.spread) * reach * 0.8,
        endY = -Math.cos(leaf.spread) * reach;
      stem(c, 0, 0, endX * 0.2, endY * 0.6, endX, endY, 1.6, leaf.depth > 0.5 ? '#C9802F' : '#E39A3B');
      // The blade continues from the petiole tip: upright in the middle, leaning outward at the sides.
      const angle = -Math.PI / 2 + leaf.spread * (1 + leaf.droop);
      const length = 40 * leaf.size * (0.5 + stage * 0.13);
      arrowLeaf(
        c,
        endX,
        endY,
        angle,
        length,
        length * 0.17,
        leaf.depth > 0.5 ? TONES.deep : TONES.fresh,
        leaf.depth * 0.7,
      );
    }
  },

  cuc(c: Ctx, stage: number, random: () => number) {
    const blades = [];
    for (let index = 0; index < 16; index++)
      blades.push({ angle: -Math.PI / 2 + (random() - 0.5) * 1.6, size: 12 + random() * 8, depth: random() });
    for (const blade of blades.slice(0, [0, 5, 9, 13, 16][stage]).sort((a, b) => b.depth - a.depth)) {
      paintLeaf(c, 0, 0, blade.angle, blade.size * (0.6 + stage * 0.12), 2.6, TONES.sage, 'oval', blade.depth * 0.7);
    }
    if (stage < 3) return;
    const heads = [
      [-9, -36],
      [6, -42],
      [13, -30],
      [-2, -46],
    ];
    for (const [x, y] of heads) {
      stem(c, 0, -6, x * 0.4, y * 0.6, x, y, 1.1);
      if (stage === 3) {
        glossyBall(c, x, y, 2.6, '#E9F0C8', '#B9CC86', '#6E8A48');
        continue;
      }
      for (let index = 0; index < 14; index++) {
        const angle = (index / 14) * Math.PI * 2;
        paintLeaf(c, x, y, angle, 7, 2, { light: '#FFFFFF', mid: '#F1EEE6', dark: '#C9C4BA' }, 'oval', 0);
      }
      glossyBall(c, x, y, 2.6, '#FFE48A', '#F2B526', '#B87A12');
    }
  },
};

// Long arrow blade with two small back lobes and a wavy edge, lit across like every leaf.
function arrowLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  tone: Tone,
  depth: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const edge: [number, number][] = [];
  for (let t = 0.02; t <= 1.0001; t += 0.04) {
    const profile = t < 0.12 ? 0.8 + (t / 0.12) * 0.2 : Math.pow((1 - t) / 0.88, 0.75);
    edge.push([length * t, width * profile * (1 + 0.05 * Math.sin(t * 19))]);
  }
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-length * 0.02, -width * 0.4, -length * 0.08, -width * 0.8);
  for (const [along, half] of edge) c.lineTo(along, -half);
  for (const [along, half] of edge.slice().reverse()) c.lineTo(along, half);
  c.lineTo(-length * 0.08, width * 0.8);
  c.quadraticCurveTo(-length * 0.02, width * 0.4, 0, 0);
  c.closePath();
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  const across = c.createLinearGradient(0, -width, 0, width);
  across.addColorStop(0, upperLit ? tone.light : tone.dark);
  across.addColorStop(0.5, tone.mid);
  across.addColorStop(1, upperLit ? tone.dark : tone.mid);
  c.fillStyle = across;
  c.fill();
  const along = c.createLinearGradient(0, 0, length, 0);
  along.addColorStop(0, 'rgba(12,40,22,.3)');
  along.addColorStop(0.4, 'rgba(12,40,22,0)');
  c.fillStyle = along;
  c.fill();
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill();
  }
  c.strokeStyle = 'rgba(225,245,170,.25)';
  c.lineWidth = 0.6;
  c.stroke();
  c.strokeStyle = 'rgba(236,240,150,.6)';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(length * 0.92, 0);
  c.stroke();
  c.strokeStyle = 'rgba(20,60,30,.18)';
  c.lineWidth = 0.5;
  for (let t = 0.2; t < 0.9; t += 0.12) {
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(length * t, 0);
      c.lineTo(length * (t + 0.08), side * width * 0.7 * (1 - t));
      c.stroke();
    }
  }
  c.restore();
}

function paintPlant(c: Ctx, species: SpeciesKey, stage: number, seed: number) {
  if (stage === 0) {
    plantTag(c);
    return;
  }
  PLANT_PAINTERS[species](c, stage, seeded(seed));
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

// Bee in profile facing +x, standing on y = 0.
function paintBee(c: Ctx, flying: boolean, loaded: boolean) {
  c.translate(0, flying ? -3.5 : -2.6);
  const wing = (angle: number, alpha: number) => {
    c.save();
    c.translate(0.6, -1.6);
    c.rotate(angle);
    c.fillStyle = `rgba(232,240,248,${alpha})`;
    c.strokeStyle = `rgba(150,160,175,${alpha * 0.8})`;
    c.lineWidth = 0.25;
    c.beginPath();
    c.ellipse(-3.2, 0, 3.6, 1.35, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.restore();
  };
  if (flying) {
    // At 230 strokes a second the eye sees the two ends of the stroke as faint fans.
    const flicker = 0.18 + Math.random() * 0.14;
    wing(-0.95, flicker);
    wing(-0.2, flicker * 0.8);
    wing(-0.55, flicker * 0.5);
  }

  c.strokeStyle = '#3A2A1C';
  c.lineWidth = 0.45;
  c.lineCap = 'round';
  const legs = flying
    ? [
        [0.6, 4.6, -0.8],
        [-0.2, 4.4, -1.6],
        [-1.2, 4.8, -2.8],
      ]
    : [
        [1.6, 2.6, 2.4],
        [0.2, 2.6, 0.4],
        [-1.4, 2.6, -2],
      ];
  for (const [startX, reach, endX] of legs) {
    c.beginPath();
    c.moveTo(startX, 1);
    c.quadraticCurveTo(startX + 0.4, reach * 0.6, endX, reach);
    c.stroke();
  }
  if (loaded && flying) glossyBall(c, -2.6, 4.2, 0.9, '#FFE08A', '#F2B233', '#B97A12');

  c.save();
  c.rotate(0.14);
  const abdomen = new Path2D();
  abdomen.ellipse(-3.1, 0.6, 3.6, 2.4, 0, 0, TAU);
  const amber = c.createLinearGradient(0, -2, 0, 3.2);
  amber.addColorStop(0, '#F4C25A');
  amber.addColorStop(0.55, '#D98E2B');
  amber.addColorStop(1, '#7A4A16');
  c.fillStyle = amber;
  c.fill(abdomen);
  c.save();
  c.clip(abdomen);
  c.fillStyle = 'rgba(40,24,12,.88)';
  for (const bandX of [-2.2, -4.0, -5.7]) {
    c.beginPath();
    c.ellipse(bandX, 0.6, 0.55, 3, 0.1, 0, TAU);
    c.fill();
  }
  c.restore();
  c.restore();

  const thorax = c.createRadialGradient(0.2, -1, 0.2, 0.6, 0, 2.3);
  thorax.addColorStop(0, '#E2BF82');
  thorax.addColorStop(0.6, '#9A7442');
  thorax.addColorStop(1, '#4E3720');
  c.fillStyle = thorax;
  c.beginPath();
  c.arc(0.6, -0.1, 2.1, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(240,215,160,.6)';
  c.lineWidth = 0.25;
  for (let hair = 0; hair < 7; hair++) {
    const angle = -2.8 + hair * 0.42;
    c.beginPath();
    c.moveTo(0.6 + Math.cos(angle) * 1.9, -0.1 + Math.sin(angle) * 1.9);
    c.lineTo(0.6 + Math.cos(angle) * 2.5, -0.1 + Math.sin(angle) * 2.5);
    c.stroke();
  }

  c.fillStyle = '#2A1F17';
  c.beginPath();
  c.ellipse(3, 0.5, 1.35, 1.6, 0.2, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.beginPath();
  c.arc(3.2, -0.1, 0.4, 0, TAU);
  c.fill();
  c.strokeStyle = '#2A1F17';
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(3.5, -0.8);
  c.lineTo(4.4, -2.5);
  c.lineTo(5.4, -2.1);
  c.stroke();
  if (!flying) wing(0.08, 0.45);
}

// Ladybird in profile facing +x, feet on y = 0. open: elytra lifted; wings: hind wings unfolded.
function paintLadybird(c: Ctx, { open, wings, buzz, stride, legsDown, time }: LadybirdPose) {
  c.translate(0, -1.4);
  c.strokeStyle = '#151515';
  c.lineWidth = 0.4;
  c.lineCap = 'round';
  for (const [index, legX] of [-1.4, 0, 1.3].entries()) {
    const swing = legsDown ? Math.sin(stride * 2.2 + index * 2.1) * 0.6 : 0;
    c.beginPath();
    c.moveTo(legX, 0.2);
    c.lineTo(legX + swing + (legsDown ? 0.3 : -0.8), legsDown ? 1.4 : 1.7);
    c.stroke();
  }

  if (wings > 0) {
    // Hind wings unfold from under the shell; in the air they blur.
    const pivotX = 0.6,
      pivotY = -2.2,
      length = 2 + 6 * wings;
    const strokes = buzz ? [1.15 + Math.random() * 0.3, 0.3 + Math.random() * 0.2] : [0.5];
    for (const angle of strokes) {
      c.save();
      c.translate(pivotX, pivotY);
      c.rotate(angle);
      c.fillStyle = `rgba(205,180,150,${buzz ? 0.22 : 0.5})`;
      c.strokeStyle = `rgba(110,85,60,${buzz ? 0.25 : 0.5})`;
      c.lineWidth = 0.2;
      c.beginPath();
      c.ellipse(-length / 2, 0, length / 2, 1.1 * wings + 0.3, 0, 0, TAU);
      c.fill();
      c.stroke();
      c.restore();
    }
  }

  const dome = new Path2D();
  dome.ellipse(0, 0, 3.3, 2.7, 0, Math.PI, TAU);
  dome.closePath();
  const shell = (shade: boolean) => {
    const red = c.createRadialGradient(-0.8, -2, 0.2, 0, -0.6, 3.6);
    red.addColorStop(0, shade ? '#E8564A' : '#FF7A62');
    red.addColorStop(0.45, shade ? '#B91F1D' : '#E0302A');
    red.addColorStop(1, '#7A0E10');
    c.fillStyle = red;
    c.fill(dome);
    c.save();
    c.clip(dome);
    c.fillStyle = '#141010';
    for (const [spotX, spotY, radius] of [
      [-1.7, -1.1, 0.7],
      [0.4, -1.9, 0.75],
      [1.6, -0.7, 0.55],
      [-0.6, -0.3, 0.5],
    ]) {
      c.beginPath();
      c.arc(spotX, spotY, radius, 0, TAU);
      c.fill();
    }
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.beginPath();
    c.ellipse(-0.6, -2.1, 0.9, 0.35, -0.25, 0, TAU);
    c.fill();
  };
  const lift = open * 0.62;
  if (open > 0) {
    c.save();
    c.translate(1.4, -2.3);
    c.rotate(lift * 0.8);
    c.translate(-1.4 - 0.5, 2.3 - 0.4);
    shell(true);
    c.restore();
  }
  c.fillStyle = '#1C1414';
  c.beginPath();
  c.ellipse(0, 0.05, 3.1, 0.7, 0, 0, TAU);
  c.fill();
  c.save();
  c.translate(1.4, -2.3);
  c.rotate(lift);
  c.translate(-1.4, 2.3);
  shell(false);
  c.restore();

  c.fillStyle = '#151111';
  c.beginPath();
  c.ellipse(3.1, -0.7, 1.35, 1.25, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#F4EFE6';
  c.beginPath();
  c.ellipse(3.2, -1.2, 0.5, 0.35, 0.3, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(4.1, -0.4, 0.25, 0, TAU);
  c.fill();
  const flick = Math.sin(time * 3) > 0.92 ? -0.5 : 0;
  c.strokeStyle = '#151111';
  c.lineWidth = 0.25;
  c.beginPath();
  c.moveTo(4.1, -0.9);
  c.lineTo(5, -1.4 + flick);
  c.stroke();
}

// Butterfly in true 3D: each wing is a flat plane hinged on the body, projected by a camera looking slightly down.
const CAMERA_TILT = 0.38;
const project = (vector: Vec3) => ({
  x: vector.x,
  y: -(vector.y * Math.cos(CAMERA_TILT) - vector.z * Math.sin(CAMERA_TILT)),
});
const towardCamera = { x: 0, y: Math.sin(CAMERA_TILT), z: Math.cos(CAMERA_TILT) };
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};
const sum = (...parts: [Vec3, number][]): Vec3 =>
  parts.reduce<Vec3>(
    (total, [vector, amount]) => ({
      x: total.x + vector.x * amount,
      y: total.y + vector.y * amount,
      z: total.z + vector.z * amount,
    }),
    { x: 0, y: 0, z: 0 },
  );

const FOREWING = [
  [1.2, 0.3],
  [4.6, 4],
  [5.2, 9.2],
  [3.6, 11.8],
  [2.2, 12.6],
  [-0.6, 11.6],
  [-1.9, 9.6],
  [-2.3, 6],
  [-1.2, 2],
  [-0.6, 0.6],
];
const HINDWING = [
  [-0.3, 0.6],
  [0.6, 4],
  [0.2, 7.6],
  [-1.6, 8.8],
  [-3.6, 9.4],
  [-6.4, 8.4],
  [-7.8, 6],
  [-7.6, 3.6],
  [-4.4, 0.7],
  [-1.2, 0.3],
];
function smoothShape(c: Ctx, points: number[][]) {
  c.beginPath();
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[points.length - 1], points[0]);
  c.moveTo(start[0], start[1]);
  points.forEach((point, index) => {
    const next = mid(point, points[(index + 1) % points.length]);
    c.quadraticCurveTo(point[0], point[1], next[0], next[1]);
  });
  c.closePath();
}

function butterflyFrame(fly: ButterflyPose) {
  let forward: Vec3;
  if (fly.mode === 'perch') forward = unit({ x: Math.cos(fly.yaw), y: 0.12, z: Math.sin(fly.yaw) * 0.9 });
  else {
    forward = unit({ x: fly.vx ?? 0, y: -(fly.vy ?? 0) * 0.5, z: (fly.vz ?? 0) * 30 + 0.001 });
    forward = unit({ x: forward.x, y: clamp(forward.y, -0.45, 0.6), z: forward.z });
  }
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }));
  return { forward, right, up: cross(right, forward) };
}

function paintButterfly(c: Ctx, fly: ButterflyPose) {
  const { forward, right, up } = butterflyFrame(fly);
  const size = fly.scale * (1 + fly.z * 0.12) * 0.95;
  c.save();
  c.translate(fly.x, fly.y + fly.bob - (fly.mode === 'perch' ? 1.5 * size : 0));
  c.scale(size, size);

  const wings = [1, -1]
    .map((side) => {
      const span = sum([right, side * Math.cos(fly.theta)], [up, Math.sin(fly.theta)]);
      const normal = cross(span, forward);
      const upper = side * dot(normal, towardCamera) > 0;
      return { side, span, upper, depth: dot(span, towardCamera) };
    })
    .sort((a, b) => a.depth - b.depth);

  const paintWing = ({ span, upper }: { span: Vec3; upper: boolean }) => {
    const along = project(forward),
      out = project(span);
    c.save();
    c.transform(along.x, along.y, out.x, out.y, 0, 0);
    paintWingSurface(c, HINDWING, upper, true);
    paintWingSurface(c, FOREWING, upper, false);
    c.restore();
  };
  paintWing(wings[0]);
  paintButterflyBody(c, forward, up);
  paintWing(wings[1]);
  c.restore();
}

// Wing pattern after the common tiger, frequent in Vietnamese gardens: orange cells, black veins and border, white spots.
function paintWingSurface(c: Ctx, points: number[][], upper: boolean, hind: boolean) {
  smoothShape(c, points);
  c.save();
  const base = c.createLinearGradient(0, 0, 0, hind ? 9 : 12.5);
  if (upper) {
    base.addColorStop(0, '#C8551A');
    base.addColorStop(0.5, '#EE8A2E');
    base.addColorStop(1, '#F5A443');
  } else {
    base.addColorStop(0, '#C9762E');
    base.addColorStop(0.6, '#E8B26A');
    base.addColorStop(1, '#F0C487');
  }
  c.fillStyle = base;
  c.fill();
  c.clip();
  c.strokeStyle = upper ? 'rgba(25,15,10,.7)' : 'rgba(60,35,20,.5)';
  c.lineWidth = 0.3;
  const veins = hind
    ? [
        [-1, 8.6],
        [-3, 9],
        [-5.4, 8],
        [-7, 5.6],
        [0, 7],
      ]
    : [
        [4.6, 9.5],
        [3.2, 11.8],
        [1, 12.3],
        [-1, 11],
        [-2, 8],
      ];
  for (const [veinX, veinY] of veins) {
    c.beginPath();
    c.moveTo(-0.4, 0.8);
    c.quadraticCurveTo(veinX * 0.4, veinY * 0.55, veinX, veinY);
    c.stroke();
  }
  if (!hind) {
    // Dark apex with a row of white spots, the tiger's signature.
    c.fillStyle = upper ? '#1C130E' : '#3C2A1E';
    c.beginPath();
    c.ellipse(4, 11, 4.2, 3.4, 0.4, 0, TAU);
    c.fill();
    c.fillStyle = '#FBF5EA';
    for (const [spotX, spotY, radius] of [
      [4.4, 9.8, 0.75],
      [3, 10.8, 0.65],
      [1.6, 11.3, 0.55],
      [5, 8.4, 0.5],
      [2.6, 12.2, 0.4],
    ]) {
      c.beginPath();
      c.arc(spotX, spotY, radius, 0, TAU);
      c.fill();
    }
  }
  c.lineWidth = 1.5;
  c.strokeStyle = upper ? '#1C130E' : '#3C2A1E';
  smoothShape(c, points);
  c.stroke();
  c.fillStyle = 'rgba(251,245,234,.9)';
  const dots = hind
    ? [
        [-1.6, 8.3],
        [-3.6, 8.8],
        [-5.6, 7.8],
        [-7, 5.8],
      ]
    : [
        [-0.2, 11.2],
        [-1.4, 9.8],
      ];
  for (const [dotX, dotY] of dots) {
    c.beginPath();
    c.arc(dotX, dotY, 0.32, 0, TAU);
    c.fill();
  }
  c.restore();
}

function paintButterflyBody(c: Ctx, forward: Vec3, up: Vec3) {
  const point = (along: number, lift: number) => project(sum([forward, along], [up, lift]));
  c.lineCap = 'round';
  // Head, thorax, then an abdomen that tapers and droops slightly.
  for (let step = 0; step <= 18; step++) {
    const t = step / 18,
      along = 3.4 - t * 9.6,
      lift = -0.9 * t * t;
    const radius = t < 0.12 ? 1.05 : t < 0.35 ? 1.35 - (t - 0.12) * 0.6 : 1.2 * (1 - (t - 0.35) / 0.65) + 0.35;
    const at = point(along, lift);
    c.fillStyle = t < 0.1 ? '#2A1E18' : '#36271E';
    c.beginPath();
    c.arc(at.x, at.y, radius, 0, TAU);
    c.fill();
  }
  const shine = point(0.8, 0.6);
  c.fillStyle = 'rgba(255,255,255,.28)';
  c.beginPath();
  c.arc(shine.x, shine.y, 0.5, 0, TAU);
  c.fill();
  c.strokeStyle = '#1E1612';
  c.lineWidth = 0.3;
  for (const side of [-0.7, 0.7]) {
    const from = point(3.8, 0.5),
      tip = project(sum([forward, 9], [up, 3.2], [cross(up, forward), side * 2.4]));
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(tip.x, tip.y);
    c.stroke();
    c.fillStyle = '#1E1612';
    c.beginPath();
    c.arc(tip.x, tip.y, 0.5, 0, TAU);
    c.fill();
  }
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

interface Spot {
  dx: number;
  dy: number;
  rim?: boolean;
}
interface Spots {
  tops: Spot[];
  flowers: Spot[];
  inside: Spot[];
}
interface Perch {
  index: number;
  spot: Spot;
}
interface Goal {
  x: number;
  y: number;
  exit?: boolean;
  perch?: Perch;
}
interface Layer {
  canvas: HTMLCanvasElement;
  context: Ctx;
}

// One shape for the bee, butterfly and ladybird: each uses the fields its own state machine needs
interface Actor {
  mode: string;
  timer: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  scale: number;
  visits: number;
  loaded: boolean;
  perch: Perch;
  goal: Goal;
  goalSpot: Spot;
  phase: number;
  theta: number;
  beats: number;
  glide: number;
  bob: number;
  stops: number;
  bask: number;
  yaw: number;
  open: number;
  wings: number;
  stride: number;
  angle: number;
  behind: boolean;
  rounds: number;
  next: string | null;
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

function makeActor(fields: Partial<Actor>): Actor {
  return {
    mode: 'away',
    timer: 1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 1,
    scale: 1,
    visits: 0,
    loaded: false,
    perch: { index: 0, spot: { dx: 0, dy: 0 } },
    goal: { x: 0, y: 0 },
    goalSpot: { dx: 0, dy: 0 },
    phase: 0,
    theta: 1,
    beats: 0,
    glide: 0,
    bob: 0,
    stops: 0,
    bask: 0,
    yaw: 0,
    open: 0,
    wings: 0,
    stride: 0,
    angle: 0,
    behind: false,
    rounds: 0,
    next: null,
    ...fields,
  };
}

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

  const insectActors = {
    ong: makeActor({ timer: 1 }),
    buom: makeActor({ timer: 2.5 }),
    borua: makeActor({ timer: 7 }),
  };
  let lastInsectTime = 0;

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

  function plantBitmap(index: number): HTMLCanvasElement {
    const plant = state.plants[index]!;
    const stage = shownStage(index);
    const key = `${index}-${plant.species}-${stage}-${plant.seed}`;
    const cached = plantBitmaps.get(key);
    if (cached) return cached;
    const ratio = pixelRatio();
    const bitmap = document.createElement('canvas');
    bitmap.width = 200 * ratio;
    bitmap.height = 180 * ratio;
    const c = bitmap.getContext('2d')!;
    c.scale(ratio, ratio);
    c.translate(100, 130);
    paintPlant(c, plant.species, stage, plant.seed);
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
        paintInsects(c, time, index);

        const pulse = pulses.get(index) || 0;
        const grow = 1 + Math.sin(pulse * Math.PI) * 0.12;
        const lift = digLift(index, now);
        c.save();
        c.globalAlpha = lift.alpha;
        c.translate(x + lift.x, shelfY - pot.height * scale + 0.5 - lift.y);
        c.rotate(lift.tilt);
        c.rotate(Math.sin(time * 1.1 + index) * 0.018);
        c.scale(scale * grow, scale * grow);
        c.drawImage(plantBitmap(index), -100, -130, 200, 180);
        c.restore();
        if (pulse > 0) pulses.set(index, Math.max(0, pulse - 0.025));
      }
    }

    paintCan(c, now);
    paintShovel(c, now);
    updateInsects(time);
    paintInsects(c, time);
    if (dark) nightTint(c);
    ctx.drawImage(foreground.canvas, 0, 0, width, height);
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
  const FLOWERING = new Set(['cuc', 'senda', 'xuongrong']);
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
    const blooms = FLOWERING.has(plant.species);
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

  function moveToward(actor: Actor, goal: { x: number; y: number }, speed: number, turn: number, dt: number) {
    const dx = goal.x - actor.x,
      dy = goal.y - actor.y,
      distance = Math.hypot(dx, dy) || 1;
    const want = Math.min(speed, distance * 2.4);
    actor.vx = approach(actor.vx, (dx / distance) * want, turn, dt);
    actor.vy = approach(actor.vy, (dy / distance) * want, turn, dt);
    actor.x += actor.vx * dt;
    actor.y += actor.vy * dt;
    return distance;
  }

  // Bee: strokes near 230 Hz read as a haze; it darts in a zigzag, hovers, lands on a flower, hops on, then leaves for a while.
  function updateBee(bee: Actor, dt: number, time: number) {
    bee.timer -= dt;
    if (bee.mode === 'away') {
      if (bee.timer > 0) return;
      const start = exitPoint();
      Object.assign(bee, { x: start.x, y: start.y, vx: 0, vy: 0, visits: Math.floor(between(3, 7)), loaded: false });
      beeNextFlower(bee, null);
      return;
    }
    if (bee.mode === 'leave') {
      const distance = moveToward(bee, bee.goal, 150, 3, dt);
      bee.x += Math.sin(time * 9) * 18 * dt;
      if (distance < 8) {
        bee.mode = 'away';
        bee.timer = between(6, 14);
      }
      return;
    }

    const goal = spotWorld(bee.perch.index, bee.perch.spot, time);
    bee.scale = approach(bee.scale, goal.scale, 2, dt);
    if (bee.mode === 'fly') {
      const hoverAt = { x: goal.x - bee.facing * 7 * goal.scale, y: goal.y - 7 * goal.scale };
      const distance = moveToward(bee, hoverAt, 130, 4, dt);
      // Sideways zigzag, the way a forager scans for scent.
      const across = Math.sin(time * 8.5 + bee.visits) * 26;
      bee.x += (-bee.vy / (Math.hypot(bee.vx, bee.vy) + 1)) * across * dt;
      bee.y += (bee.vx / (Math.hypot(bee.vx, bee.vy) + 1)) * across * dt;
      if (Math.abs(bee.vx) > 10) bee.facing = Math.sign(bee.vx);
      if (distance < 3) {
        bee.mode = 'hover';
        bee.timer = between(0.4, 1.1);
      }
    } else if (bee.mode === 'hover') {
      bee.facing = Math.sign(goal.x - bee.x) || bee.facing;
      const jitter = {
        x: goal.x - bee.facing * 7 * goal.scale + Math.sin(time * 5.3) * 2.2 + Math.sin(time * 11.7) * 0.8,
        y: goal.y - 7 * goal.scale + Math.sin(time * 6.1) * 1.8,
      };
      moveToward(bee, jitter, 60, 8, dt);
      if (bee.timer <= 0) {
        bee.mode = 'land';
      }
    } else if (bee.mode === 'land') {
      if (moveToward(bee, goal, 30, 10, dt) < 0.8) {
        bee.mode = 'visit';
        bee.timer = between(1.2, 3);
      }
    } else if (bee.mode === 'visit') {
      bee.x = goal.x + Math.sin(time * 1.7) * 1.2 * goal.scale;
      bee.y = goal.y;
      bee.vx = 0;
      bee.vy = 0;
      bee.loaded = true;
      if (bee.timer <= 0) {
        bee.visits -= 1;
        if (bee.visits <= 0) {
          bee.mode = 'leave';
          bee.goal = exitPoint();
          bee.vy = -40;
        } else beeNextFlower(bee, bee.perch.index);
      }
    }
  }

  function beeNextFlower(bee: Actor, current: number | null) {
    const slots = flowerSlots();
    if (!slots.length) {
      // No flowers yet: it checks a leaf briefly and moves on.
      const planted = plantedIndices();
      if (!planted.length) {
        bee.mode = 'away';
        bee.timer = 8;
        return;
      }
      const index = pick(planted),
        tops = plantSpots(index).tops;
      bee.perch = { index, spot: pick(tops.slice(0, Math.max(1, tops.length / 4))) };
      bee.visits = Math.min(bee.visits, 1);
    } else {
      const index = current !== null && slots.includes(current) && Math.random() < 0.55 ? current : pick(slots);
      bee.perch = { index, spot: pick(plantSpots(index).flowers) };
    }
    bee.mode = 'fly';
    bee.vy -= 25;
  }

  // Butterfly: 7 Hz strokes, each downstroke lifts the body and kicks its course, in bursts with short glides.
  function updateButterfly(fly: Actor, dt: number, time: number) {
    fly.timer -= dt;
    if (fly.mode === 'away') {
      if (fly.timer > 0) return;
      const start = exitPoint();
      Object.assign(fly, {
        x: start.x,
        y: start.y,
        z: between(-0.5, 0.5),
        vx: 0,
        vy: 0,
        vz: 0,
        stops: Math.floor(between(1, 4)),
      });
      butterflyNextGoal(fly);
      fly.mode = 'fly';
      return;
    }

    if (fly.mode === 'perch') {
      const spot = spotWorld(fly.perch.index, fly.perch.spot, time);
      fly.x = spot.x;
      fly.y = spot.y;
      fly.bob = 0;
      // Wings rest closed above the back; now and then they open slowly to bask.
      fly.bask -= dt;
      if (fly.bask < 0) fly.bask = between(2.5, 5);
      const open = fly.bask > 1.8 && fly.bask < 3.2;
      fly.theta = approach(fly.theta, open ? 0.25 : 1.5, open ? 2.2 : 3, dt);
      if (fly.timer <= 0) {
        fly.mode = 'fly';
        fly.vy = -55;
        fly.beats = 6;
        fly.glide = 0;
        butterflyNextGoal(fly);
      }
      return;
    }

    const perchAt = fly.goal.perch ? spotWorld(fly.goal.perch.index, fly.goal.perch.spot, time) : null;
    if (perchAt) fly.scale = approach(fly.scale, perchAt.scale, 1.5, dt);
    const target = perchAt ?? fly.goal;
    const distance = Math.hypot(target.x - fly.x, target.y - fly.y);
    const landing = fly.goal.perch && distance < 30;

    if (fly.glide > 0 && !landing) {
      fly.glide -= dt;
      fly.theta = approach(fly.theta, 0.22, 6, dt);
      fly.vy += 22 * dt;
      fly.bob = approach(fly.bob, 0, 4, dt);
    } else {
      const before = Math.floor(fly.phase);
      fly.phase += (landing ? 6.5 : 5) * dt;
      if (Math.floor(fly.phase) !== before) {
        // Every stroke shoves the body a little: the zigzag is the stroke, not noise added on top.
        fly.vx += between(-16, 16);
        fly.vy += between(-18, 10);
        fly.vz = clamp(fly.vz + between(-0.6, 0.6), -0.8, 0.8);
        fly.beats -= 1;
        if (fly.beats <= 0) {
          fly.beats = Math.floor(between(3, 8));
          if (Math.random() < 0.55) fly.glide = between(0.25, 0.6);
        }
      }
      const stroke = Math.cos(fly.phase * TAU);
      fly.theta = 0.52 + 0.96 * stroke;
      fly.bob = 2.4 * stroke;
    }

    const want = landing ? 22 : 48;
    const dx = target.x - fly.x,
      dy = target.y - fly.y,
      length = Math.hypot(dx, dy) || 1;
    fly.vx = approach(fly.vx, (dx / length) * Math.min(want, length * 2), 1.6, dt);
    fly.vy = approach(fly.vy, (dy / length) * Math.min(want, length * 2), 1.6, dt);
    fly.x += fly.vx * dt;
    fly.y += fly.vy * dt;
    fly.z = clamp(fly.z + fly.vz * dt, -1, 1);
    if (Math.abs(fly.z) > 0.95) fly.vz *= -0.5;

    if (fly.goal.perch && distance < 2.2) {
      fly.mode = 'perch';
      fly.perch = fly.goal.perch;
      fly.timer = between(4, 9);
      fly.bask = between(0.5, 2);
      fly.yaw = (Math.random() < 0.5 ? 0 : Math.PI) + between(-0.6, 0.6);
    } else if (!fly.goal.perch && distance < 14) {
      if (fly.goal.exit) {
        fly.mode = 'away';
        fly.timer = between(8, 18);
      } else butterflyNextGoal(fly);
    }
  }

  function butterflyNextGoal(fly: Actor) {
    fly.stops -= 1;
    if (fly.stops < 0) {
      fly.goal = { ...exitPoint(), exit: true };
      return;
    }
    const slots = flowerSlots().length ? flowerSlots() : plantedIndices();
    if (!slots.length || Math.random() < 0.35) {
      fly.goal = airPoint();
      return;
    }
    const index = pick(slots),
      spots = plantSpots(index);
    const choices = spots.flowers.length > 2 ? spots.flowers : spots.tops.slice(0, Math.max(1, spots.tops.length / 3));
    fly.goal = { x: 0, y: 0, perch: { index, spot: pick(choices) } };
  }

  // Ladybird: flies in, folds its wings, walks and pauses, then slips under a leaf or climbs high to take off.
  function updateLadybird(bug: Actor, dt: number, time: number) {
    bug.timer -= dt;
    const walkSpeed = 4.5 * bug.scale;
    const at = () => spotWorld(bug.perch.index, bug.perch.spot, time);

    switch (bug.mode) {
      case 'away': {
        if (bug.timer > 0) return;
        const planted = plantedIndices();
        if (!planted.length) {
          bug.timer = 10;
          return;
        }
        const index = pick(planted),
          tops = plantSpots(index).tops;
        const spot =
          Math.random() < 0.5 || !tops.length ? rimSpot(index) : pick(tops.slice(0, Math.max(1, tops.length / 2)));
        const start = exitPoint();
        Object.assign(bug, {
          mode: 'flyIn',
          x: start.x,
          y: Math.min(start.y, height * 0.3),
          vx: 0,
          vy: 0,
          perch: { index, spot },
          open: 1,
          wings: 1,
          behind: false,
          rounds: Math.floor(between(1, 4)),
        });
        return;
      }
      case 'flyIn': {
        const goal = at();
        bug.scale = approach(bug.scale, goal.scale, 2, dt);
        if (Math.abs(bug.vx) > 5) bug.facing = Math.sign(bug.vx);
        bug.angle = approach(bug.angle, -0.55, 4, dt);
        if (moveToward(bug, goal, 70, 2.2, dt) < 0.8) {
          bug.mode = 'settle';
          bug.timer = 1.1;
          bug.angle = 0;
        }
        return;
      }
      case 'settle': {
        Object.assign(bug, at());
        // Hind wings fold away first, then the elytra close over them.
        bug.wings = clamp((bug.timer - 0.4) / 0.7, 0, 1);
        bug.open = clamp(bug.timer / 0.4, 0, 1);
        if (bug.timer <= 0) ladybirdWalk(bug);
        return;
      }
      case 'walk': {
        const goal = spotWorld(bug.perch.index, bug.goalSpot, time);
        const before = { x: bug.x, y: bug.y };
        const distance = moveToward(bug, goal, walkSpeed, 12, dt);
        bug.stride += Math.hypot(bug.x - before.x, bug.y - before.y);
        if (Math.abs(goal.x - bug.x) > 0.3) bug.facing = Math.sign(goal.x - bug.x);
        // On foliage it climbs along the leaf, so the body turns with the path.
        bug.angle = bug.perch.spot.rim
          ? 0
          : approach(bug.angle, clamp(Math.atan2(goal.y - bug.y, Math.abs(goal.x - bug.x) + 0.01), -1.3, 1.3), 4, dt);
        if (distance < 0.5) {
          bug.perch.spot = bug.goalSpot;
          if (bug.next === 'hidden') {
            bug.mode = 'hidden';
            bug.timer = between(7, 14);
          } else if (bug.next === 'surface') {
            bug.behind = false;
            bug.mode = 'pause';
            bug.timer = between(1, 2);
            bug.next = 'climb';
          } else if (bug.next === 'prepare') {
            bug.mode = 'prepare';
            bug.timer = 1.6;
            bug.angle = 0;
          } else {
            bug.mode = 'pause';
            bug.timer = between(1, 2.6);
          }
        }
        return;
      }
      case 'pause': {
        Object.assign(bug, at());
        if (bug.timer > 0) return;
        if (bug.next === 'climb') {
          ladybirdClimb(bug);
          return;
        }
        bug.rounds -= 1;
        if (bug.rounds > 0) {
          ladybirdWalk(bug);
          return;
        }
        const inside = plantSpots(bug.perch.index).inside;
        if (inside.length && Math.random() < 0.55) {
          bug.behind = true;
          bug.next = 'hidden';
          bug.mode = 'walk';
          bug.goalSpot = nearest(inside, bug.perch.spot);
        } else ladybirdClimb(bug);
        return;
      }
      case 'hidden': {
        Object.assign(bug, at());
        if (bug.timer > 0) return;
        const tops = plantSpots(bug.perch.index).tops;
        bug.mode = 'walk';
        bug.next = 'surface';
        bug.goalSpot = nearest(tops, bug.perch.spot);
        return;
      }
      case 'prepare': {
        Object.assign(bug, at());
        bug.open = clamp((1.6 - bug.timer) / 0.35, 0, 1);
        bug.wings = clamp((1.6 - bug.timer - 0.35) / 0.6, 0, 1);
        if (bug.timer <= 0) {
          bug.mode = 'flyOut';
          bug.goal = exitPoint();
          bug.goal.y = between(0, height * 0.25);
          bug.vy = -30;
        }
        return;
      }
      case 'flyOut': {
        bug.angle = approach(bug.angle, -0.55, 5, dt);
        if (Math.abs(bug.vx) > 5) bug.facing = Math.sign(bug.vx);
        if (moveToward(bug, bug.goal, 75, 1.8, dt) < 10) {
          bug.mode = 'away';
          bug.timer = between(30, 60);
          bug.open = 0;
          bug.wings = 0;
        }
      }
    }
  }

  function nearest(spots: Spot[], from: Spot) {
    return spots.reduce(
      (best, spot) =>
        Math.hypot(spot.dx - from.dx, spot.dy - from.dy) < Math.hypot(best.dx - from.dx, best.dy - from.dy)
          ? spot
          : best,
      spots[0],
    );
  }
  function ladybirdWalk(bug: Actor) {
    const from = bug.perch.spot;
    let goalSpot: Spot;
    if (from.rim) {
      const reach = POTS[POT_TYPES[bug.perch.index]].width * 0.34;
      goalSpot = { dx: clamp(from.dx + between(-14, 14), -reach, reach), dy: from.dy, rim: true };
    } else {
      const near = plantSpots(bug.perch.index).tops.filter(
        (spot) => Math.hypot(spot.dx - from.dx, spot.dy - from.dy) < 10,
      );
      goalSpot = near.length ? pick(near) : from;
    }
    bug.mode = 'walk';
    bug.next = null;
    bug.goalSpot = goalSpot;
  }
  // Before take-off a ladybird walks up to the highest point it can reach.
  function ladybirdClimb(bug: Actor) {
    const tops = plantSpots(bug.perch.index).tops;
    const highest = tops.length
      ? tops
          .slice(0, Math.max(1, Math.floor(tops.length / 10)))
          .reduce((best, spot) =>
            Math.abs(spot.dx - bug.perch.spot.dx) < Math.abs(best.dx - bug.perch.spot.dx) ? spot : best,
          )
      : bug.perch.spot;
    if (bug.perch.spot.rim) bug.perch.spot = { ...bug.perch.spot, rim: false };
    bug.mode = 'walk';
    bug.next = 'prepare';
    bug.goalSpot = highest;
  }

  function updateInsects(time: number) {
    const dt = Math.min(0.05, time - lastInsectTime || 0.016);
    lastInsectTime = time;
    if (dark) return;
    updateBee(insectActors.ong, dt, time);
    updateButterfly(insectActors.buom, dt, time);
    updateLadybird(insectActors.borua, dt, time);
  }

  function paintInsects(c: Ctx, time: number, behindIndex: number | null = null) {
    if (dark) return;
    const bug = insectActors.borua;
    if (behindIndex !== null) {
      if (bug.behind && bug.perch?.index === behindIndex && bug.mode !== 'away') paintLadybirdAt(c, bug, time);
      return;
    }
    if (!bug.behind && bug.mode !== 'away') paintLadybirdAt(c, bug, time);
    const bee = insectActors.ong;
    if (bee.mode !== 'away') {
      c.save();
      c.translate(bee.x, bee.y);
      c.scale(bee.scale * bee.facing, bee.scale);
      const flying = bee.mode !== 'visit';
      c.rotate(flying ? (bee.mode === 'hover' ? -0.42 : -0.18) : -0.08);
      paintBee(c, flying, bee.loaded);
      c.restore();
    }
    const fly = insectActors.buom;
    if (fly.mode !== 'away') paintButterfly(c, fly);
  }

  function paintLadybirdAt(c: Ctx, bug: Actor, time: number) {
    c.save();
    c.translate(bug.x, bug.y);
    c.scale(bug.scale * bug.facing, bug.scale);
    c.rotate(bug.angle);
    const flying = bug.mode === 'flyIn' || bug.mode === 'flyOut';
    paintLadybird(c, {
      open: bug.open,
      wings: bug.wings,
      buzz: flying || (bug.mode === 'prepare' && bug.wings >= 1),
      stride: bug.stride,
      legsDown: !flying,
      time,
    });
    c.restore();
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
