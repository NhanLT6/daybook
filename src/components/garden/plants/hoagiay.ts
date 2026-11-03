import type { Ctx, Plant } from './kit';
import type { Curve, Point } from './wood';

import { linear } from '../creatures/paint';
import { paintLeaf, TAU } from './kit';
import { bezier, paintLimb } from './wood';

const LEAF = { light: '#8FC06A', mid: '#4D8A3B', dark: '#2B5A29' };

const BARK = { dark: '#4A3828', mid: '#7A5F48', light: '#A88D72', crack: '#2E2118', rough: 0.9 };

// One bougainvillea "flower" seen from the side: three papery bracts cupped around a tiny cream flower,
// one behind and two in front, darker at the base and inside the cup, so it reads as a little lantern
function paintBloom(c: Ctx, x: number, y: number, size: number, turn: number, shade: number) {
  const bract = (angle: number, dx: number, colors: [string, string, string]) => {
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
      [0, colors[0]],
      [0.55, colors[1]],
      [1, colors[2]],
    ]);
    c.fill(path);
    // Papery vein net: a midrib and a few side veins
    c.strokeStyle = 'rgba(255,190,225,.4)';
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
    c.strokeStyle = 'rgba(110,10,60,.35)';
    c.lineWidth = 0.2;
    c.stroke(path);
    c.restore();
  };
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  // Back bract is the inside of the cup: deeper and darker
  bract(0, 0, ['#9A1462', '#C0237E', '#DB4597']);
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
  bract(-0.5, -size * 0.12, ['#A1175F', '#DD2E8C', '#F57FBE']);
  bract(0.5, size * 0.12, ['#A1175F', '#E0348F', '#F98AC4']);
  if (shade > 0) {
    // Blooms deeper in the cluster sit in shadow
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = `rgba(40,10,40,${shade})`;
    c.fillRect(-size, -size * 1.3, size * 2, size * 1.6);
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}

// Bougainvillea bonsai: a gnarled trunk full of small side twigs, leafy pads and rounded clusters of bracts
export const hoagiay: Plant = {
  name: 'Bougainvillea',
  done: 'is covered in blooms',
  flowering: true,
  paint(c, stage, random) {
    const lean = random() > 0.5 ? 1 : -1;
    const pads = [
      { x: lean * -15, y: -40, r: 11 },
      { x: lean * 13, y: -52, r: 12 },
      { x: lean * 2, y: -67, r: 10 },
    ].map((pad) => ({
      ...pad,
      leaves: Array.from({ length: 20 }, () => ({
        dx: (random() - 0.5) * 2,
        dy: (random() - 0.5) * 1.2,
        angle: random() * TAU,
        depth: random(),
      })),
      // Rounded clusters of blooms sitting on the pad; each bloom has its own spot in the dome
      clusters: Array.from({ length: 3 }, () => ({
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
        for (const leafAngle of leaves) paintLeaf(c, end.x, end.y, leafAngle, 6 * grow, 2.5 * grow, LEAF, 'oval', 0.2);
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
    // Trunk: a gnarled S-bend, thick at the soil; branches split off toward each pad
    const trunk: Curve = [
      { x: 0, y: 1 },
      at({ x: lean * 12, y: -10 }),
      at({ x: lean * -10, y: -22 }),
      at({ x: lean * 2, y: -34 }),
    ];
    const trunkTop = trunk[3];
    const shown = pads.slice(0, [0, 1, 2, 3, 3][stage]);
    if (stage >= 2)
      trunkTwigs.forEach((side, index) =>
        twig(bezier(trunk, side.t), side.angle, side.length, side.leaves, 0.5 + index * 0.1),
      );
    paintLimb(c, trunk, 8 * grow, 3.8 * grow, BARK, 0.42, 0.12, 1);
    shown.forEach((pad, index) => {
      const end = at(pad);
      const branch: Curve = [
        trunkTop,
        { x: (trunkTop.x + end.x) / 2, y: trunkTop.y - 3 },
        { x: end.x * 0.9, y: end.y + 5 },
        end,
      ];
      if (stage >= 3)
        pad.twigs.forEach((side, at) =>
          twig(bezier(branch, side.t), side.angle, side.length, side.leaves, 0.2 + index * 0.2 + at * 0.05),
        );
      paintLimb(c, branch, 3.4 * grow, 1.2 * grow, BARK, 0.13 + index * 0.27, 0.08, 0.8);
    });

    // Leaf pads: small oval leaves, back ones shaded, front ones lit; bloom clusters on top
    for (const pad of shown) {
      const centre = at(pad),
        radius = pad.r * grow;
      for (const leaf of pad.leaves.slice().sort((a, b) => b.depth - a.depth)) {
        paintLeaf(
          c,
          centre.x + leaf.dx * radius,
          centre.y + leaf.dy * radius,
          leaf.angle,
          7 * grow,
          2.8 * grow,
          LEAF,
          'oval',
          leaf.depth * 0.6,
        );
      }
      if (stage >= 3) {
        for (const cluster of pad.clusters.slice(0, stage === 4 ? 3 : 1)) {
          const cx = centre.x + cluster.dx * radius,
            cy = centre.y + cluster.dy * radius;
          const blooms = cluster.blooms.slice(0, stage === 4 ? 4 : 2).sort((a, b) => b.depth - a.depth);
          for (const bloom of blooms) {
            paintBloom(c, cx + bloom.dx * 4.6, cy + bloom.dy * 3.4, 5.4, bloom.turn, bloom.depth * 0.2);
          }
        }
      }
    }
  },
};
