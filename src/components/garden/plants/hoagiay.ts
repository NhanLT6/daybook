import type { Ctx, Plant } from './kit';

import { radial } from '../creatures/paint';
import { paintLeaf, TAU } from './kit';

const LEAF = { light: '#8FC06A', mid: '#4D8A3B', dark: '#2B5A29' };

type Point = { x: number; y: number };
const bezier = (a: Point, b: Point, c: Point, d: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

// Woody limb along a cubic curve, tapering from `from` to `to` thickness: a dark body, a lit left flank and
// a few bark ridges, drawn as short overlapping segments so the width can change along it
function paintLimb(c: Ctx, points: [Point, Point, Point, Point], from: number, to: number) {
  const steps = 18;
  c.lineCap = 'round';
  const layers: [string, number, number][] = [
    ['#5B4331', 1, 0],
    ['#8A6A4F', 0.62, -0.18],
    ['#B4977A', 0.22, -0.32],
  ];
  for (const [color, share, shift] of layers) {
    c.strokeStyle = color;
    for (let index = 0; index < steps; index++) {
      const t0 = index / steps,
        t1 = (index + 1) / steps;
      const width = from + (to - from) * t0;
      const p0 = bezier(...points, t0),
        p1 = bezier(...points, t1);
      c.lineWidth = width * share;
      c.beginPath();
      c.moveTo(p0.x + shift * width, p0.y);
      c.lineTo(p1.x + shift * width, p1.y);
      c.stroke();
    }
  }
  // Bark ridges: short dark streaks along the limb
  c.strokeStyle = 'rgba(60,40,28,.45)';
  c.lineWidth = 0.3;
  for (let t = 0.1; t < 0.9; t += 0.16) {
    const p = bezier(...points, t),
      q = bezier(...points, t + 0.06);
    const width = from + (to - from) * t;
    c.beginPath();
    c.moveTo(p.x + width * 0.15, p.y);
    c.lineTo(q.x + width * 0.12, q.y);
    c.stroke();
  }
}

// Three papery magenta bracts around a tiny white flower: what reads as the bougainvillea "bloom"
function paintBracts(c: Ctx, x: number, y: number, size: number, turn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  for (let index = 0; index < 3; index++) {
    c.save();
    c.rotate((index / 3) * TAU);
    c.fillStyle = radial(
      c,
      0,
      -size * 0.55,
      0,
      size * 0.8,
      [
        [0, '#F77BC0'],
        [0.6, '#D9268A'],
        [1, '#A3136A'],
      ],
      -size * 0.15,
      -size * 0.2,
    );
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-size * 0.6, -size * 0.2, -size * 0.55, -size, 0, -size * 1.05);
    c.bezierCurveTo(size * 0.55, -size, size * 0.6, -size * 0.2, 0, 0);
    c.fill();
    // Fine papery veins
    c.strokeStyle = 'rgba(255,200,230,.45)';
    c.lineWidth = 0.18;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -size * 0.9);
    c.stroke();
    c.restore();
  }
  c.fillStyle = '#FFF8E8';
  c.beginPath();
  c.arc(0, 0, size * 0.16, 0, TAU);
  c.fill();
  c.restore();
}

// Bougainvillea bonsai: a twisted woody trunk, branches ending in leafy pads covered in magenta bracts
export const hoagiay: Plant = {
  name: 'Bougainvillea',
  done: 'is covered in blooms',
  flowering: true,
  paint(c, stage, random) {
    const lean = random() > 0.5 ? 1 : -1;
    const pads = [
      { x: lean * -14, y: -40, r: 11 },
      { x: lean * 12, y: -52, r: 12 },
      { x: lean * 2, y: -66, r: 10 },
    ].map((pad) => ({
      ...pad,
      leaves: Array.from({ length: 22 }, () => ({
        dx: (random() - 0.5) * 2,
        dy: (random() - 0.5) * 1.2,
        angle: random() * TAU,
        depth: random(),
      })),
      bracts: Array.from({ length: 9 }, () => ({
        dx: (random() - 0.5) * 1.8,
        dy: (random() - 0.6) * 1.1,
        turn: random() * TAU,
      })),
    }));
    const grow = 0.5 + stage * 0.125;
    const at = (point: Point) => ({ x: point.x * grow, y: point.y * grow });

    // Trunk: an S-bend, thick at the soil; branches split off toward each pad
    const trunkTop = at({ x: lean * 2, y: -34 });
    paintLimb(
      c,
      [{ x: 0, y: 0 }, at({ x: lean * 12, y: -10 }), at({ x: lean * -10, y: -22 }), trunkTop],
      7 * grow,
      3.6 * grow,
    );
    const shown = pads.slice(0, [0, 1, 2, 3, 3][stage]);
    for (const pad of shown) {
      const end = at(pad);
      paintLimb(
        c,
        [trunkTop, { x: (trunkTop.x + end.x) / 2, y: trunkTop.y - 3 }, { x: end.x * 0.9, y: end.y + 5 }, end],
        3 * grow,
        1.2 * grow,
      );
    }

    // Leaf pads: small oval leaves, back ones shaded, front ones lit
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
        const count = stage === 4 ? pad.bracts.length : 2;
        for (const bract of pad.bracts.slice(0, count)) {
          paintBracts(c, centre.x + bract.dx * radius, centre.y + bract.dy * radius, 3.4, bract.turn);
        }
      }
    }
  },
};
