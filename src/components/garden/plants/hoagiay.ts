import type { Ctx, Plant } from './kit';
import type { Point } from './wood';

import { radial } from '../creatures/paint';
import { paintLeaf, TAU } from './kit';
import { paintLimb } from './wood';

const LEAF = { light: '#8FC06A', mid: '#4D8A3B', dark: '#2B5A29' };

const BARK = { dark: '#4A3828', mid: '#7A5F48', light: '#A88D72', crack: '#2E2118', rough: 0.9 };

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
      );
    }
    // Trunk: an S-bend, thick at the soil; branches split off toward each pad
    const trunkTop = at({ x: lean * 2, y: -34 });
    paintLimb(
      c,
      [{ x: 0, y: 1 }, at({ x: lean * 12, y: -10 }), at({ x: lean * -10, y: -22 }), trunkTop],
      8 * grow,
      3.8 * grow,
      BARK,
      0.42,
    );
    const shown = pads.slice(0, [0, 1, 2, 3, 3][stage]);
    shown.forEach((pad, index) => {
      const end = at(pad);
      paintLimb(
        c,
        [trunkTop, { x: (trunkTop.x + end.x) / 2, y: trunkTop.y - 3 }, { x: end.x * 0.9, y: end.y + 5 }, end],
        3.4 * grow,
        1.2 * grow,
        BARK,
        0.13 + index * 0.27,
        0.08,
      );
    });

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
