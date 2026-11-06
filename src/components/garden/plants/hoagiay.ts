import type { Ctx, Plant } from './kit';
import type { Curve, Point } from './wood';

import { linear } from '../creatures/paint';
import { leafVariety, paintFoliageLeaf } from './foliage';
import { TAU } from './kit';
import { bezier, paintLimb } from './wood';

const LEAF = { light: '#8FC06A', mid: '#4D8A3B', dark: '#2B5A29' };

const BARK = { dark: '#4A3828', mid: '#7A5F48', light: '#A88D72', crack: '#2E2118', rough: 0.9 };

// Bract colours: back (inside of the cup) and front, each base → middle → tip, plus vein and rim lines.
// A plant carries both: grafted bougainvillea often shows two colours on one bush.
interface BractColors {
  back: [string, string, string];
  front: [string, string, string];
  vein: string;
  rim: string;
}
const MAGENTA: BractColors = {
  back: ['#9A1462', '#C0237E', '#DB4597'],
  front: ['#A1175F', '#DD2E8C', '#F57FBE'],
  vein: 'rgba(255,190,225,.4)',
  rim: 'rgba(110,10,60,.35)',
};
// White bracts keep a faint green-cream at the base, as the real ones do
const WHITE: BractColors = {
  back: ['#C9D1B2', '#E4E3D8', '#F1EFE8'],
  front: ['#D2D9BC', '#F3F2EC', '#FFFFFF'],
  vein: 'rgba(190,195,165,.5)',
  rim: 'rgba(110,115,90,.35)',
};

// One bougainvillea "flower" seen from the side: three papery bracts cupped around a tiny cream flower,
// one behind and two in front, darker at the base and inside the cup, so it reads as a little lantern
function paintBloom(c: Ctx, x: number, y: number, size: number, turn: number, shade: number, colors: BractColors) {
  const bract = (angle: number, dx: number, stops: [string, string, string]) => {
    c.save();
    c.translate(dx, size * 0.15);
    c.rotate(angle);
    const width = size * 0.42,
      height = size;
    const path = new Path2D();
    path.moveTo(0, 0);
    path.bezierCurveTo(-width, -height * 0.2, -width * 0.95, -height * 0.85, 0, -height);
    path.bezierCurveTo(width * 0.95, -height * 0.85, width, -height * 0.2, 0, 0);
    c.fillStyle = linear(c, 0, 0, 0, -height, [
      [0, stops[0]],
      [0.55, stops[1]],
      [1, stops[2]],
    ]);
    c.fill(path);
    // Papery vein net: a midrib and a few side veins
    c.strokeStyle = colors.vein;
    c.lineWidth = 0.18;
    c.beginPath();
    c.moveTo(0, -height * 0.05);
    c.lineTo(0, -height * 0.9);
    for (const at of [0.3, 0.5, 0.7]) {
      c.moveTo(0, -height * at);
      c.lineTo(-width * 0.6, -height * (at + 0.12));
      c.moveTo(0, -height * at);
      c.lineTo(width * 0.6, -height * (at + 0.12));
    }
    c.stroke();
    c.strokeStyle = colors.rim;
    c.lineWidth = 0.2;
    c.stroke(path);
    c.restore();
  };
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  // Back bract is the inside of the cup: deeper and darker
  bract(0, 0, colors.back);
  // The flower tube peeking out of the cup, with its little white star
  c.strokeStyle = '#F2E6C8';
  c.lineWidth = size * 0.12;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -size * 0.05);
  c.lineTo(0, -size * 0.55);
  c.stroke();
  c.fillStyle = '#FFFDF5';
  c.beginPath();
  c.arc(0, -size * 0.6, size * 0.1, 0, TAU);
  c.fill();
  // Two front bracts lean out to the sides and overlap in the middle
  bract(-0.5, -size * 0.12, colors.front);
  bract(0.5, size * 0.12, colors.front);
  if (shade > 0) {
    // Blooms deeper in the cluster sit in shadow
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = `rgba(40,10,40,${shade})`;
    c.fillRect(-size, -size * 1.3, size * 2, size * 1.6);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// Bougainvillea bonsai: a gnarled trunk that rises in tiers, like a trained bonsai. Each tier sends branches out
// to leafy pads with rounded clusters of bracts, some magenta and some white on the same bush.
// How full a grown bush is: leaves per pad and bloom clusters per pad
export const BOUGAINVILLEA = { padLeaves: 20, clusters: 3 };

// The trunk in three pieces, thinner as it rises: the old S-bend at the bottom, a second tier, then the apex.
// x is flipped by the plant's lean.
const TRUNK: { curve: Curve; width: [number, number] }[] = [
  {
    curve: [
      { x: 0, y: 1 },
      { x: 12, y: -10 },
      { x: -10, y: -22 },
      { x: 2, y: -34 },
    ],
    width: [8, 3.8],
  },
  {
    curve: [
      { x: 2, y: -34 },
      { x: 9, y: -44 },
      { x: -7, y: -54 },
      { x: -1, y: -63 },
    ],
    width: [3.8, 2.4],
  },
  {
    curve: [
      { x: -1, y: -63 },
      { x: -4, y: -71 },
      { x: 4, y: -74 },
      { x: 1, y: -79 },
    ],
    width: [2.4, 1.4],
  },
];

// Leaf pads, lowest tier first so a young plant fills from the bottom up: which trunk piece the branch leaves
// from and where along it, then the pad's centre and radius
const PADS = [
  { tier: 0, t: 1, x: -17, y: -38, r: 11 },
  { tier: 0, t: 0.9, x: 16, y: -45, r: 10 },
  { tier: 1, t: 0.85, x: -15, y: -66, r: 10 },
  { tier: 1, t: 0.95, x: 15, y: -72, r: 9 },
  { tier: 2, t: 1, x: 1, y: -84, r: 9 },
];

export const hoagiay: Plant = {
  name: 'Bougainvillea',
  done: 'is covered in blooms',
  flowering: true,
  paint(c, stage, random) {
    const lean = random() > 0.5 ? 1 : -1;
    const pads = PADS.map((pad) => ({
      ...pad,
      x: pad.x * lean,
      leaves: Array.from({ length: BOUGAINVILLEA.padLeaves }, () => ({
        dx: (random() - 0.5) * 2,
        dy: (random() - 0.5) * 1.2,
        angle: random() * TAU,
        depth: random(),
      })),
      // Rounded clusters of blooms sitting on the pad; each bloom has its own spot in the dome
      clusters: Array.from({ length: BOUGAINVILLEA.clusters }, () => ({
        dx: (random() - 0.5) * 1.5,
        dy: -0.2 - random() * 0.6,
        blooms: Array.from({ length: 4 }, () => ({
          dx: (random() - 0.5) * 2,
          dy: (random() - 0.6) * 1.4,
          turn: (random() - 0.5) * 1.2,
          depth: random(),
        })),
      })),
      // Small side twigs off the branch, each with a few leaves
      twigs: Array.from({ length: 3 }, () => ({
        t: 0.3 + random() * 0.55,
        angle: (random() - 0.5) * 2.2,
        length: 5 + random() * 7,
        leaves: Array.from({ length: 3 }, () => random() * TAU),
      })),
    }));
    const trunkTwigs = Array.from({ length: 3 }, () => ({
      t: 0.35 + random() * 0.5,
      angle: (random() - 0.5) * 2.4,
      length: 4 + random() * 6,
      leaves: Array.from({ length: 3 }, () => random() * TAU),
    }));
    const grow = 0.5 + stage * 0.125;
    const at = (point: Point) => ({ x: point.x * grow, y: point.y * grow });

    // A thin twig from a point on a limb, sticking out at an angle from straight up, tipped with leaves
    const twig = (from: Point, angle: number, length: number, leaves: number[], seed: number) => {
      const reach = length * grow;
      const end = { x: from.x + Math.sin(angle) * reach, y: from.y - Math.cos(angle) * reach };
      paintLimb(
        c,
        [from, { x: from.x + (end.x - from.x) * 0.3, y: from.y + (end.y - from.y) * 0.45 }, end, end],
        1.2 * grow,
        0.5 * grow,
        BARK,
        seed,
        0,
        0.4,
      );
      if (stage >= 2) {
        for (const leafAngle of leaves)
          paintFoliageLeaf(c, end.x, end.y, leafAngle, 6.5 * grow, 2.4 * grow, LEAF, {
            ...leafVariety(leafAngle),
            shade: 0.2,
          });
      }
    };

    // Surface roots gripping the soil, as on an old bonsai
    for (const side of [-1, 1]) {
      paintLimb(
        c,
        [at({ x: side * 1, y: -3 }), at({ x: side * 4, y: -2 }), at({ x: side * 8, y: 0 }), at({ x: side * 12, y: 1 })],
        3.4 * grow,
        0.8 * grow,
        BARK,
        side > 0 ? 0.31 : 0.67,
        0,
        0.6,
      );
    }
    // Trunk in tiers: a piece grows once a pad on it (or above it) shows
    const shown = pads.slice(0, [0, 1, 2, 4, 5][stage]);
    const tiers = Math.max(...shown.map((pad) => pad.tier)) + 1;
    const trunk = TRUNK.slice(0, tiers).map(
      (piece) => piece.curve.map((point) => at({ ...point, x: point.x * lean })) as Curve,
    );
    trunk[0][0] = { x: 0, y: 1 };
    if (stage >= 2)
      trunkTwigs.forEach((side, index) =>
        twig(bezier(trunk[0], side.t), side.angle, side.length, side.leaves, 0.5 + index * 0.1),
      );
    trunk.forEach((curve, index) => {
      const [base, tip] = TRUNK[index].width;
      paintLimb(c, curve, base * grow, tip * grow, BARK, 0.42 + index * 0.17, 0.12, 1);
    });
    shown.forEach((pad, index) => {
      const from = bezier(trunk[pad.tier], pad.t),
        end = at(pad);
      const branch: Curve = [from, { x: (from.x + end.x) / 2, y: from.y - 3 }, { x: end.x * 0.9, y: end.y + 5 }, end];
      if (stage >= 3)
        pad.twigs.forEach((side, at) =>
          twig(bezier(branch, side.t), side.angle, side.length, side.leaves, 0.2 + index * 0.2 + at * 0.05),
        );
      paintLimb(c, branch, (pad.tier ? 2.6 : 3.4) * grow, 1.2 * grow, BARK, 0.13 + index * 0.27, 0.08, 0.8);
    });

    // Leaf pads: small oval leaves, back ones shaded, front ones lit; bloom clusters on top
    for (const pad of shown) {
      const centre = at(pad),
        radius = pad.r * grow;
      for (const leaf of pad.leaves.slice().sort((a, b) => b.depth - a.depth)) {
        paintFoliageLeaf(c, centre.x + leaf.dx * radius, centre.y + leaf.dy * radius, leaf.angle, 7.5 * grow, 2.7 * grow, LEAF, {
          ...leafVariety(leaf.depth),
          shade: leaf.depth * 0.6,
        });
      }
      if (stage >= 3) {
        for (const cluster of pad.clusters.slice(0, stage === 4 ? BOUGAINVILLEA.clusters : 1)) {
          const cx = centre.x + cluster.dx * radius,
            cy = centre.y + cluster.dy * radius;
          // Each cluster is one colour, picked from a value the plant already drew, so existing plants keep
          // their shape and a cluster never changes colour as it grows
          const colors = (cluster.blooms[0].depth * 1000) % 1 < 0.5 ? WHITE : MAGENTA;
          const blooms = cluster.blooms.slice(0, stage === 4 ? 4 : 2).sort((a, b) => b.depth - a.depth);
          for (const bloom of blooms) {
            paintBloom(c, cx + bloom.dx * 4.6, cy + bloom.dy * 3.4, 5.4, bloom.turn, bloom.depth * 0.2, colors);
          }
        }
      }
    }
  },
};
