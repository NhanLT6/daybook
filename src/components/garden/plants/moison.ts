import type { Ctx, Plant } from './kit';

import { linear } from '../creatures/paint';
import { facing, makeStrands, paintLeaf, paintStrand, strandAt } from './kit';

const LEAF = { light: '#6FA35C', mid: '#2F6A37', dark: '#1B4224' };

// Lipstick flower: a dark maroon calyx tube with a curved scarlet flower pushing out of it, like a lipstick
function paintLipstick(c: Ctx, x: number, y: number, angle: number, size: number, open: boolean) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  if (open) {
    c.strokeStyle = linear(c, 0, 0, size * 2.2, 0, [
      [0, '#E8322E'],
      [1, '#FF6A3D'],
    ]);
    c.lineWidth = size * 0.55;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(size * 0.6, 0);
    c.quadraticCurveTo(size * 1.5, -size * 0.15, size * 2.3, size * 0.25);
    c.stroke();
    // Two tiny pale stamens poking from the mouth
    c.strokeStyle = '#FFE7A8';
    c.lineWidth = 0.25;
    c.beginPath();
    c.moveTo(size * 2.3, size * 0.25);
    c.lineTo(size * 2.8, size * 0.15);
    c.stroke();
  }
  c.fillStyle = linear(c, 0, -size * 0.4, 0, size * 0.4, [
    [0, '#7C2A2A'],
    [1, '#3E1013'],
  ]);
  c.beginPath();
  c.roundRect(-size * 0.1, -size * 0.38, size * 1.0, size * 0.76, size * 0.3);
  c.fill();
  c.restore();
}

// Lipstick plant: trailing stems with pairs of glossy dark leaves, scarlet tube flowers bunched at the tips
export const moison: Plant = {
  name: 'Lipstick plant',
  done: 'trails scarlet flowers',
  flowering: true,
  paint(c, stage, random, room) {
    const strands = makeStrands(random, 12);
    const tufts = strands.map(() =>
      Array.from({ length: 4 }, () => ({ angle: (random() - 0.5) * 1.8, size: random() })),
    );
    const crown = Array.from({ length: 8 }, () => ({
      angle: -Math.PI / 2 + (random() - 0.5) * 2.4,
      size: random(),
      depth: random(),
    }));
    const grow = 0.55 + stage * 0.11;
    const hang = [0, 0, 0.35, 0.7, 1][stage];

    if (hang > 0) {
      strands.forEach((strand, index) => {
        const reach = Math.min(room, 105) * strand.length * hang;
        paintStrand(c, strand, reach, '#4A6B34');
        // Leaves come in opposite pairs along the stem
        // Short strands carry fewer pairs, so pairs sit about as far apart on every strand
        const step = 0.9 / Math.round(4 + strand.length * 9);
        for (let t = 0.1; t < 0.99; t += step) {
          const p = strandAt(strand, reach, t),
            q = strandAt(strand, reach, t + 0.02);
          const along = Math.atan2(q.y - p.y, q.x - p.x);
          for (const side of [-1, 1]) {
            paintLeaf(c, p.x, p.y, along + side * 0.7, 8 * grow, 2.5 * grow, LEAF, 'oval', strand.depth * 0.5);
          }
        }
        // A bunch of lipsticks at the tip, opening only when grown
        if (stage >= 3) {
          const tip = strandAt(strand, reach, 1);
          for (const tuft of tufts[index].slice(0, strand.length > 0.45 ? 4 : 2)) {
            paintLipstick(c, tip.x, tip.y, Math.PI / 2 + tuft.angle, 3.2 + tuft.size * 1.2, stage === 4);
          }
        }
      });
    }

    for (const leaf of crown.slice(0, [0, 4, 6, 8, 8][stage]).sort((a, b) => b.depth - a.depth)) {
      const look = facing(leaf.depth, leaf.angle);
      const length = (8 + leaf.size * 3) * grow * look.squash;
      paintLeaf(c, 0, -1, look.angle, length, 2.5 * grow, LEAF, 'oval', look.shade);
    }
  },
};
