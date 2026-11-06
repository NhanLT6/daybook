// What stands in the open courtyard: a grove of Japanese maples growing close together, a bed of loose pebbles
// under them, moss, and a low wooden bench for potted plants. Drawn in room units with (0, 0) on the gravel under
// each piece's centre, lit from the upper right like the courtyard itself.
import type { Ctx } from '../creatures/kit';
import type { Curve } from '../plants/wood';

import { TAU } from '../creatures/kit';
import { paintLimb, seeded } from '../plants/wood';
import { SHELF_WOOD, woodGrain } from './materials';

const BARK = { dark: '#3A332E', mid: '#5A4F47', light: '#857A70', crack: '#28221E', rough: 0.4 };

// Back to front: deep shade inside the canopy, mid red, sunlit orange-red, and the few leaves the sun shines through
const AUTUMN = [
  ['#5E1F1A', '#8A2C20', '#B4402A', '#E07A48'],
  ['#6A2318', '#9C3522', '#C7502C', '#EC9254'],
  ['#58201E', '#842A26', '#AA3A30', '#D86A4A'],
];

interface Spray {
  x: number;
  y: number;
  // How big the leaf fan at this tip is, and how far out from the tree's centre it sits (0 inside .. 1 outer)
  size: number;
  out: number;
}

// One palmate maple leaf: seven pointed lobes, the cuts between them deep
function mapleLeaf(c: Ctx, x: number, y: number, size: number, turn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  c.beginPath();
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * TAU - Math.PI / 2;
    const radius = i % 2 ? size * 0.38 : size * (i === 7 ? 0.5 : 1);
    c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  c.closePath();
  c.fill();
  c.restore();
}

// Branches fork again and again, spreading outward and levelling off as they go, the way a Japanese maple builds
// its layered, wide crown. Thick wood gets the textured bark, thin twigs a plain stroke. Leaf sprays hang at each
// tip and along the last forks.
function branch(
  c: Ctx,
  random: () => number,
  from: { x: number; y: number },
  angle: number,
  length: number,
  width: number,
  depth: number,
  sprays: Spray[],
  centre: number,
  reach: number,
) {
  const bend = (random() - 0.5) * 0.5;
  const to = { x: from.x + Math.cos(angle) * length, y: from.y + Math.sin(angle) * length };
  const end = width * 0.68;
  if (width > 2.4) {
    const curve: Curve = [
      from,
      { x: from.x + Math.cos(angle + bend) * length * 0.35, y: from.y + Math.sin(angle + bend) * length * 0.35 },
      { x: to.x - Math.cos(angle - bend) * length * 0.35, y: to.y - Math.sin(angle - bend) * length * 0.35 },
      to,
    ];
    paintLimb(c, curve, width, end, BARK, random(), 0.06, 0.15);
  } else {
    c.strokeStyle = BARK.mid;
    c.lineWidth = width;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.quadraticCurveTo(
      (from.x + to.x) / 2 + Math.sin(angle) * bend * length * 0.3,
      (from.y + to.y) / 2,
      to.x,
      to.y,
    );
    c.stroke();
  }

  const out = Math.min(1, Math.abs(to.x - centre) / reach);
  if (depth === 0) {
    sprays.push({ x: to.x, y: to.y, size: 1, out });
    return;
  }
  if (depth === 1) sprays.push({ x: to.x, y: to.y, size: 0.6, out });

  const forks = random() < 0.35 ? 3 : 2;
  for (let i = 0; i < forks; i++) {
    const spread = (i - (forks - 1) / 2) * (0.75 + random() * 0.3);
    let next = angle + spread + (random() - 0.5) * 0.3;
    // Level off toward the sides as the branch grows outward
    const side = Math.cos(next) >= 0 ? 0 : Math.PI;
    next += (lerpAngle(next, side) - next) * 0.18;
    branch(c, random, to, next, length * (0.7 + random() * 0.1), end, depth - 1, sprays, centre, reach);
  }
}

// The angle between `from` and `to` going the short way round, for nudging a branch toward the horizontal
function lerpAngle(from: number, to: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta;
}

// A fan of leaves at a branch tip, flat and wide like the tiers of a real maple's crown. Painted in passes: the
// shaded underside first, then the body, then the lit top toward the upper right where the light comes from.
function paintSprays(c: Ctx, random: () => number, sprays: Spray[], tones: string[]) {
  const passes = [
    { tone: 0, dy: 4, spread: 1.1, share: 0.55 },
    { tone: 1, dy: 0, spread: 1, share: 0.55 },
    { tone: 2, dy: -3, spread: 0.8, share: 0.35 },
  ];
  for (const pass of passes) {
    c.fillStyle = tones[pass.tone];
    for (const spray of sprays) {
      const w = 30 * spray.size * pass.spread,
        h = 8 * spray.size * pass.spread;
      const count = Math.round(18 * spray.size * pass.share * (0.6 + spray.out * 0.6));
      for (let i = 0; i < count; i++) {
        const angle = random() * TAU,
          reach = Math.sqrt(random());
        let x = Math.cos(angle) * w * reach,
          y = Math.sin(angle) * h * reach + pass.dy;
        // The lit pass keeps to the upper right of each fan
        if (pass.tone === 2) {
          x = Math.abs(x) * 0.8 - w * 0.15;
          y = -Math.abs(y) * 0.8 + pass.dy;
        }
        mapleLeaf(c, spray.x + x, spray.y + y, 4.2 + random() * 2.2, random() * TAU);
      }
    }
  }
  // A few leaves glowing where the sun shines through them, on the outer edge of the crown
  c.fillStyle = tones[3];
  for (const spray of sprays) {
    if (spray.out < 0.55 || random() < 0.4) continue;
    for (let i = 0; i < 4; i++) {
      mapleLeaf(c, spray.x + (random() - 0.2) * 22, spray.y - 4 - random() * 8, 4 + random() * 2, random() * TAU);
    }
  }
}

// One Japanese maple about `height` tall: a slim, leaning trunk that soon forks into a wide, layered crown.
// `seed` makes each tree its own shape, `tones` picks one of the autumn palettes.
export function paintMaple(c: Ctx, height: number, seed: number, tones = 0) {
  const random = seeded(seed);
  const lean = (random() - 0.5) * 0.35;
  const trunk = height * 0.3;
  const top = { x: Math.sin(lean) * trunk, y: -trunk };
  const curve: Curve = [
    { x: 0, y: 0 },
    { x: (random() - 0.5) * 14, y: -trunk * 0.35 },
    { x: top.x + (random() - 0.5) * 18, y: -trunk * 0.7 },
    top,
  ];
  paintLimb(c, curve, height * 0.026, height * 0.018, BARK, random(), 0.08, 0.2);

  const sprays: Spray[] = [];
  const limbs = 3;
  for (let i = 0; i < limbs; i++) {
    const angle = -Math.PI / 2 + lean + (i - (limbs - 1) / 2) * 0.7 + (random() - 0.5) * 0.25;
    branch(c, random, top, angle, height * 0.2, height * 0.017, 5, sprays, top.x, height * 0.4);
  }
  paintSprays(c, random, sprays, AUTUMN[tones % AUTUMN.length]);
}

// Small trees growing close together, crowns overlapping, from the right edge in. `width` is the room left for them.
// Trees further back stand a little higher.
export function paintMapleGrove(c: Ctx, width: number, height: number) {
  const trees = [
    { x: 0.95, back: 0.03, size: 0.78, seed: 0.37, tones: 0 },
    { x: 0.66, back: 0.04, size: 0.66, seed: 0.58, tones: 2 },
    { x: 0.82, back: 0, size: 0.56, seed: 0.81, tones: 1 },
    { x: 0.46, back: 0, size: 0.46, seed: 0.23, tones: 1 },
    { x: 1.08, back: -0.02, size: 0.6, seed: 0.66, tones: 2 },
  ];
  for (const tree of trees) {
    c.save();
    c.translate(tree.x * width, -tree.back * height);
    paintMaple(c, height * tree.size, tree.seed, tree.tones);
    c.restore();
  }
}

// A bed of loose pebbles under the trees: rounded, bean-sized stones of mixed size and tone lying every which way,
// thinning out at the bed's ragged edge. Each has a soft shadow on its lower left and a highlight on its upper right.
export function paintPebbles(c: Ctx, width: number, depth: number, seed: number) {
  const random = seeded(seed);
  const tones = ['#8C8780', '#9F9A92', '#B3AEA6', '#7A756F', '#A8A093', '#C2BDB4'];
  const stones: { x: number; y: number; r: number; turn: number; tone: string }[] = [];
  const count = Math.round((width * depth) / 55);
  for (let i = 0; i < count; i++) {
    const x = random() * width,
      y = random() * depth;
    // Ragged edge: fewer stones toward the bed's front and left
    const edge = Math.min(x / (width * 0.18), (depth - y) / (depth * 0.45), 1);
    if (random() > edge) continue;
    stones.push({ x, y, r: 4 + random() * 5, turn: random() * Math.PI, tone: tones[Math.floor(random() * 6)] });
  }
  stones.sort((a, b) => a.y - b.y);

  for (const stone of stones) {
    const squash = 0.62;
    c.fillStyle = 'rgba(50,46,42,.3)';
    c.beginPath();
    c.ellipse(stone.x - 1.2, stone.y + 1.4, stone.r, stone.r * squash, stone.turn, 0, TAU);
    c.fill();
    const lit = c.createRadialGradient(
      stone.x + stone.r * 0.35,
      stone.y - stone.r * 0.3,
      0.5,
      stone.x,
      stone.y,
      stone.r * 1.1,
    );
    lit.addColorStop(0, 'rgba(255,255,252,.55)');
    lit.addColorStop(0.45, stone.tone);
    lit.addColorStop(1, stone.tone);
    c.fillStyle = lit;
    c.beginPath();
    c.ellipse(stone.x, stone.y, stone.r, stone.r * squash, stone.turn, 0, TAU);
    c.fill();
  }
}

// A soft patch of moss on the gravel
export function paintMoss(c: Ctx, w: number, h: number, seed: number) {
  const random = seeded(seed);
  for (let i = 0; i < 70; i++) {
    const angle = random() * TAU,
      reach = Math.sqrt(random());
    c.fillStyle = ['#5E7A48', '#728F52', '#879F62'][Math.floor(random() * 3)];
    c.globalAlpha = 0.75;
    c.beginPath();
    c.ellipse(Math.cos(angle) * w * reach, Math.sin(angle) * h * reach, 6, 3, 0, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

export const BENCH = { width: 300, height: 60 };

// A low wooden bench on two block legs, the kind bonsai stand on outdoors, in the furniture's wood
export function paintBench(c: Ctx) {
  const { width, height } = BENCH;
  const slab = 14;
  c.fillStyle = SHELF_WOOD.leg[2];
  for (const x of [-width * 0.36, width * 0.36]) c.fillRect(x - 14, -height + slab, 28, height - slab);
  const top = c.createLinearGradient(0, -height, 0, -height + slab);
  top.addColorStop(0, SHELF_WOOD.top[0]);
  top.addColorStop(1, SHELF_WOOD.face[2]);
  c.fillStyle = top;
  c.fillRect(-width / 2, -height, width, slab);
  woodGrain(c, -width / 2, -height, width, slab, 0.44, { density: 3, knots: false });
}
