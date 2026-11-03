import type { Ctx, Plant, Tone } from './kit';

import { linear } from '../creatures/paint';
import { facing, glossyBall, stem, TAU } from './kit';

const LEAF: Tone = { light: '#A9CF6A', mid: '#6E9F3F', dark: '#3F6B27' };

// Dandelion leaf: long and narrow with deep teeth that point back toward the root ("lion's teeth")
function toothedLeaf(c: Ctx, angle: number, length: number, width: number, depth: number) {
  c.save();
  c.rotate(angle);
  const teeth = 5;
  const leaf = new Path2D();
  leaf.moveTo(0, 0);
  for (const side of [-1, 1]) {
    if (side === 1) leaf.moveTo(0, 0);
    for (let index = 0; index < teeth; index++) {
      const t0 = 0.12 + (index / teeth) * 0.78,
        t1 = t0 + 0.78 / teeth;
      const half = width * (1 - t0 * 0.55);
      // Notch in toward the midrib, then the tooth tip pointing back toward the root
      leaf.lineTo(length * t0, side * half * 0.35);
      leaf.lineTo(length * (t0 - 0.02), side * half);
      leaf.quadraticCurveTo(length * (t1 - 0.04), side * half * 0.9, length * t1, side * half * 0.4);
    }
    leaf.lineTo(length, 0);
  }
  leaf.closePath();
  const upperLit = -0.6 * Math.sin(angle) + 0.8 * Math.cos(angle) > 0;
  c.fillStyle = linear(c, 0, -width, 0, width, [
    [0, upperLit ? LEAF.light : LEAF.dark],
    [0.5, LEAF.mid],
    [1, upperLit ? LEAF.dark : LEAF.mid],
  ]);
  c.fill(leaf, 'nonzero');
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.4 * depth})`;
    c.fill(leaf);
  }
  // Pale midrib, pinkish near the root like the real thing
  c.strokeStyle = linear(c, 0, 0, length, 0, [
    [0, 'rgba(210,140,140,.7)'],
    [0.4, 'rgba(230,245,200,.55)'],
    [1, 'rgba(230,245,200,0)'],
  ]);
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(length * 0.95, 0);
  c.stroke();
  c.restore();
}

// Hollow flower stalk, pale green with a pink blush at the foot
function stalk(c: Ctx, x: number, y: number) {
  c.strokeStyle = linear(c, 0, 0, x, y, [
    [0, '#B58A86'],
    [0.25, '#9DBB72'],
    [1, '#8CB060'],
  ]);
  c.lineWidth = 1.5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -1);
  c.quadraticCurveTo(x * 0.2, y * 0.55, x, y);
  c.stroke();
}

// Open yellow head: rings of thin strap florets, shorter and deeper gold toward the centre
function flower(c: Ctx, x: number, y: number, radius: number) {
  // Green bracts curled back under the head
  c.strokeStyle = '#5E8A36';
  c.lineWidth = 0.9;
  for (let index = 0; index < 7; index++) {
    const angle = Math.PI * 0.15 + (index / 6) * Math.PI * 0.7;
    c.beginPath();
    c.moveTo(x, y + radius * 0.2);
    c.quadraticCurveTo(
      x + Math.cos(angle) * radius * 0.6,
      y + radius * 0.3,
      x + Math.cos(angle) * radius * 0.8,
      y + Math.sin(angle) * radius * 0.7,
    );
    c.stroke();
  }
  const rings: [number, number, string][] = [
    [1, 26, '#FFD93B'],
    [0.75, 20, '#FFC81F'],
    [0.5, 14, '#F5B414'],
  ];
  for (const [reach, count, color] of rings) {
    c.strokeStyle = color;
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * TAU + reach * 3;
      // Seen a little from above: the head is an ellipse, petals near the viewer look shorter
      const px = x + Math.cos(angle) * radius * reach,
        py = y + Math.sin(angle) * radius * reach * 0.62;
      c.beginPath();
      c.moveTo(x + (px - x) * 0.25, y + (py - y) * 0.25);
      c.lineTo(px, py);
      c.stroke();
    }
  }
  // Light from the upper left on the dome
  c.fillStyle = linear(c, x - radius, y - radius, x + radius, y + radius, [
    [0, 'rgba(255,250,210,.35)'],
    [0.5, 'rgba(255,250,210,0)'],
    [1, 'rgba(150,90,0,.18)'],
  ]);
  c.beginPath();
  c.ellipse(x, y, radius, radius * 0.62, 0, 0, TAU);
  c.fill();
}

// Closed bud: green bracts wrapped tight, a hint of yellow at the tip
function bud(c: Ctx, x: number, y: number) {
  c.fillStyle = linear(c, x - 2.5, 0, x + 2.5, 0, [
    [0, '#8DB65A'],
    [1, '#456F2A'],
  ]);
  c.beginPath();
  c.ellipse(x, y, 2.4, 4.2, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#F7C624';
  c.beginPath();
  c.ellipse(x, y - 3.6, 1, 1.1, 0, 0, TAU);
  c.fill();
}

// Seed head: a sphere of parachutes. A few gaps where the wind already took some, but never so many that it
// looks bare. Back seeds paint first and dimmer, so the ball has depth.
function seedHead(c: Ctx, x: number, y: number, radius: number, random: () => number) {
  const gaps = [0, 1].map(() => ({ theta: random() * TAU, phi: Math.acos(1 - 2 * random()) }));
  const count = 90;
  const seeds: { px: number; py: number; z: number }[] = [];
  for (let index = 0; index < count; index++) {
    // Fibonacci sphere: even spacing without clumps
    const phi = Math.acos(1 - (2 * (index + 0.5)) / count),
      theta = index * 2.39996;
    const gone = gaps.some((gap) => {
      const cosine =
        Math.sin(phi) * Math.sin(gap.phi) * Math.cos(theta - gap.theta) + Math.cos(phi) * Math.cos(gap.phi);
      return cosine > 0.93;
    });
    if (gone) continue;
    seeds.push({
      px: Math.sin(phi) * Math.cos(theta),
      py: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
    });
  }
  seeds.sort((a, b) => a.z - b.z);

  // Faint silky glow so the ball reads as one shape
  c.fillStyle = 'rgba(255,255,255,.18)';
  c.beginPath();
  c.arc(x, y, radius * 1.05, 0, TAU);
  c.fill();
  for (const seed of seeds) {
    const near = (seed.z + 1) / 2;
    const tipX = x + seed.px * radius,
      tipY = y - seed.py * radius;
    // Beak from the centre out to the parachute
    c.strokeStyle = `rgba(230,228,215,${0.25 + near * 0.4})`;
    c.lineWidth = 0.35;
    c.beginPath();
    c.moveTo(x + seed.px * radius * 0.2, y - seed.py * radius * 0.2);
    c.lineTo(tipX, tipY);
    c.stroke();
    // Parachute: a tiny star of hairs at the tip
    c.strokeStyle = `rgba(255,255,255,${0.45 + near * 0.55})`;
    c.lineWidth = 0.4;
    c.beginPath();
    for (let hair = 0; hair < 6; hair++) {
      const angle = (hair / 6) * TAU + seed.z;
      c.moveTo(tipX, tipY);
      c.lineTo(tipX + Math.cos(angle) * 2.3, tipY + Math.sin(angle) * 2.3);
    }
    c.stroke();
  }
  // Seed cushion in the middle, brown, with the seeds' dark ends
  glossyBall(c, x, y, radius * 0.18, '#C9B38A', '#8E7350', '#5A4530');
  // Bracts hanging down under the ball
  c.strokeStyle = '#6E8F45';
  c.lineWidth = 0.8;
  for (let index = 0; index < 5; index++) {
    const lean = (index / 4 - 0.5) * 1.4;
    c.beginPath();
    c.moveTo(x, y + radius * 0.2);
    c.quadraticCurveTo(x + lean * 3, y + radius * 0.35, x + lean * 4, y + radius * 0.6);
    c.stroke();
  }
}

// Dandelion: a flat rosette of toothed leaves, yellow flowers, then white seed heads that send a seed off
// on the breeze now and then (the drifting seeds are the `seed` creature)
export const bocongan: Plant = {
  name: 'Dandelion',
  done: 'has gone to seed',
  flowering: true,
  drifts: true,
  paint(c, stage, random) {
    const leaves = Array.from({ length: 12 }, (_, index) => ({
      // Spread wide and low, alternating sides, a few standing up more
      angle: -Math.PI / 2 + (index % 2 ? 1 : -1) * (0.55 + random() * 0.85),
      length: 20 + random() * 12,
      depth: random(),
    }));
    const heads = {
      seedA: { x: -6 + random() * 4, y: -58 - random() * 10 },
      seedB: { x: 9 + random() * 5, y: -46 - random() * 8 },
      flower: { x: -14 - random() * 4, y: -34 - random() * 6 },
      bud: { x: 5 + random() * 4, y: -27 - random() * 4 },
    };

    const grow = 0.45 + stage * 0.14;
    for (const leaf of leaves.slice(0, [0, 4, 7, 10, 12][stage]).sort((a, b) => b.depth - a.depth)) {
      const look = facing(leaf.depth, leaf.angle);
      toothedLeaf(c, look.angle, leaf.length * grow * look.squash, 4.2 * grow, look.shade + leaf.depth * 0.15);
    }
    if (stage < 2) return;
    if (stage === 2) {
      stem(c, 0, -1, 1, -8, heads.bud.x * 0.4, heads.bud.y * 0.6, 1.2, '#8CB060');
      bud(c, heads.bud.x * 0.4, heads.bud.y * 0.6);
      return;
    }
    stalk(c, heads.bud.x, heads.bud.y);
    bud(c, heads.bud.x, heads.bud.y);
    stalk(c, heads.flower.x, heads.flower.y);
    flower(c, heads.flower.x, heads.flower.y, 7);
    if (stage === 3) {
      stalk(c, heads.seedA.x * 0.8, heads.seedA.y * 0.75);
      flower(c, heads.seedA.x * 0.8, heads.seedA.y * 0.75, 6.5);
      return;
    }
    stalk(c, heads.seedB.x, heads.seedB.y);
    seedHead(c, heads.seedB.x, heads.seedB.y, 10, random);
    stalk(c, heads.seedA.x, heads.seedA.y);
    seedHead(c, heads.seedA.x, heads.seedA.y, 12, random);
  },
};
