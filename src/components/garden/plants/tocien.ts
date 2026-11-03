import type { Ctx, Plant } from './kit';

import { linear } from '../creatures/paint';
import { TAU } from './kit';

// One grass-like leaf from a bulb: narrow, glossy dark green, arching out and a little down at the tip
function blade(c: Ctx, x: number, lean: number, length: number, depth: number) {
  const tipX = x + Math.sin(lean) * length,
    tipY = -Math.cos(lean) * length * 0.82;
  // The arch: rises steeply then bends gently outward
  const bendX = x + Math.sin(lean) * length * 0.3,
    bendY = -length * 0.68;
  const width = 1.9;
  c.beginPath();
  c.moveTo(x - width, 0);
  c.quadraticCurveTo(bendX - width * 0.6, bendY, tipX, tipY);
  c.quadraticCurveTo(bendX + width * 0.6, bendY + width, x + width, 0);
  c.closePath();
  const lit = lean < 0;
  c.fillStyle = linear(c, x - 3, 0, x + 3, 0, [
    [0, lit ? '#6FA34E' : '#2E5A2A'],
    [0.5, '#3F7535'],
    [1, lit ? '#2E5A2A' : '#24482A'],
  ]);
  c.fill();
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill();
  }
  // Glossy streak down the leaf
  c.strokeStyle = 'rgba(220,245,190,.3)';
  c.lineWidth = 0.4;
  c.beginPath();
  c.moveTo(x, -2);
  c.quadraticCurveTo(bendX - width * 0.2, bendY + 2, tipX, tipY);
  c.stroke();
}

// Rain lily flower: six pointed pink petals around a pale throat, seen a little from the side, so the far
// petals are short and the near ones long; yellow anthers on top
function flower(c: Ctx, x: number, y: number, size: number, turn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  const petals = Array.from({ length: 6 }, (_, index) => (index / 6) * TAU + 0.26).sort(
    (a, b) => Math.sin(a) - Math.sin(b),
  );
  for (const angle of petals) {
    const near = (Math.sin(angle) + 1) / 2;
    const length = size * (0.7 + near * 0.35),
      width = size * 0.3;
    c.save();
    c.scale(1, 0.62);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(length * 0.45, -width, length, 0);
    c.quadraticCurveTo(length * 0.45, width, 0, 0);
    c.fillStyle = linear(c, 0, 0, length, 0, [
      [0, '#FDF1F4'],
      [0.25, '#F7A9C4'],
      [0.8, '#EC6F9E'],
      [1, '#DE5288'],
    ]);
    c.fill();
    c.strokeStyle = 'rgba(160,40,90,.25)';
    c.lineWidth = 0.4;
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.45)';
    c.lineWidth = 0.35;
    c.beginPath();
    c.moveTo(length * 0.15, 0);
    c.lineTo(length * 0.8, 0);
    c.stroke();
    c.restore();
  }
  // Greenish-white throat, then the stamens standing up out of it
  c.fillStyle = '#E8F2CF';
  c.beginPath();
  c.ellipse(0, 0, size * 0.18, size * 0.12, 0, 0, TAU);
  c.fill();
  c.strokeStyle = '#F2E7B8';
  c.lineWidth = 0.4;
  for (let index = 0; index < 6; index++) {
    const lean = (index / 5 - 0.5) * 1.2;
    const tipX = Math.sin(lean) * size * 0.32,
      tipY = -Math.cos(lean) * size * 0.32;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(tipX, tipY);
    c.stroke();
    c.fillStyle = '#F2C230';
    c.beginPath();
    c.ellipse(tipX, tipY, 0.9, 0.5, lean, 0, TAU);
    c.fill();
  }
  c.restore();
}

// Closed bud: a slim pink spindle with a green sheath at its base
function bud(c: Ctx, x: number, y: number, size: number, lean: number) {
  c.save();
  c.translate(x, y);
  c.rotate(lean);
  c.fillStyle = linear(c, -2, 0, 2, 0, [
    [0, '#F9B9CF'],
    [1, '#D14D80'],
  ]);
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(size * 0.32, -size * 0.5, 0, -size);
  c.quadraticCurveTo(-size * 0.32, -size * 0.5, 0, 0);
  c.fill();
  c.fillStyle = '#7C9A4E';
  c.beginPath();
  c.ellipse(0, -size * 0.05, size * 0.12, size * 0.2, 0, 0, TAU);
  c.fill();
  c.restore();
}

function flowerStalk(c: Ctx, x: number, toX: number, toY: number) {
  c.strokeStyle = '#8DB36A';
  c.lineWidth = 0.8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, 0);
  c.quadraticCurveTo(x, toY * 0.6, toX, toY);
  c.stroke();
}

// Rain lily (tóc tiên / hẹ hồng): a pot full of small clumps, each a bulb sending up a tuft of grass-like
// leaves, with pink star flowers on bare stalks just above the foliage
export const tocien: Plant = {
  name: 'Rain lily',
  done: 'is blooming',
  flowering: true,
  paint(c, stage, random) {
    // Clumps across the whole pot, not one centre
    const clumps = [-11, -4, 3, 10].map((x) => ({
      x: x + (random() - 0.5) * 3,
      blades: Array.from({ length: 10 }, () => ({
        // Mostly upright, a few arching out over the rim
        lean: (random() - 0.5) * (random() < 0.3 ? 1.7 : 0.9),
        length: 30 + random() * 20,
        depth: random(),
      })),
    }));
    const flowers = Array.from({ length: 6 }, (_, index) => {
      const x = (index / 5 - 0.5) * 22 + (random() - 0.5) * 4;
      return {
        x,
        toX: x * 1.5 + (random() - 0.5) * 6,
        // Some just clear the leaves, some stand well above
        toY: -34 - random() * 22,
        size: 6.5 + random() * 1.5,
        turn: (random() - 0.5) * 0.5,
      };
    });

    const grow = 0.4 + stage * 0.15;
    const perClump = [0, 3, 5, 8, 10][stage];
    const shown = [0, 2, 3, 4, 4][stage];
    const blades = clumps
      .slice(0, shown)
      .flatMap((clump) => clump.blades.slice(0, perClump).map((leaf) => ({ ...leaf, x: clump.x })))
      .sort((a, b) => b.depth - a.depth);
    for (const leaf of blades) blade(c, leaf.x, leaf.lean, leaf.length * grow, leaf.depth * 0.7);

    if (stage < 3) return;
    const open = stage === 4 ? flowers : flowers.slice(1, 3);
    for (const bloom of open) {
      flowerStalk(c, bloom.x * 0.5, bloom.toX, bloom.toY);
      if (stage === 3) bud(c, bloom.toX, bloom.toY + 2, 9, bloom.turn);
      else flower(c, bloom.toX, bloom.toY, bloom.size, bloom.turn);
    }
  },
};
