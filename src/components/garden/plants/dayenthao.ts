import type { Ctx, Plant } from './kit';

import { radial } from '../creatures/paint';
import { makeStrands, paintLeaf, paintStrand, strandAt, TAU } from './kit';

const LEAF = { light: '#A9D27E', mid: '#62A04A', dark: '#36672F' };

// Petunia bloom facing us: a wide five-lobed trumpet, violet with darker veins and a pale yellow throat
function paintBloom(c: Ctx, x: number, y: number, size: number, turn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  c.fillStyle = radial(c, 0, 0, 0, size, [
    [0, '#FFF3B8'],
    [0.18, '#7A2E8E'],
    [0.6, '#A452BC'],
    [1, '#C98AD9'],
  ]);
  c.beginPath();
  for (let index = 0; index < 5; index++) {
    const angle = (index / 5) * TAU - Math.PI / 2;
    const next = ((index + 1) / 5) * TAU - Math.PI / 2;
    const mid = (angle + next) / 2;
    // Each lobe bulges out between two shallow notches
    const notch = { x: Math.cos(next) * size * 0.82, y: Math.sin(next) * size * 0.82 };
    if (index === 0) c.moveTo(Math.cos(angle) * size * 0.82, Math.sin(angle) * size * 0.82);
    c.quadraticCurveTo(Math.cos(mid) * size * 1.18, Math.sin(mid) * size * 1.18, notch.x, notch.y);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(70,20,90,.5)';
  c.lineWidth = 0.22;
  for (let index = 0; index < 5; index++) {
    const angle = (index / 5) * TAU - Math.PI / 2 + TAU / 10;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(angle) * size * 0.85, Math.sin(angle) * size * 0.85);
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,.25)';
  c.lineWidth = 0.3;
  c.beginPath();
  c.arc(-size * 0.15, -size * 0.15, size * 0.65, Math.PI * 1.05, Math.PI * 1.55);
  c.stroke();
  c.restore();
}

// Trailing petunia: a mound of soft leaves and violet trumpets that spills over the pot and hangs down
export const dayenthao: Plant = {
  name: 'Trailing petunia',
  done: 'spills over in bloom',
  flowering: true,
  paint(c, stage, random, room) {
    const mound = Array.from({ length: 16 }, () => ({
      angle: -Math.PI / 2 + (random() - 0.5) * 2.6,
      reach: 6 + random() * 10,
      depth: random(),
    }));
    const strands = makeStrands(random, 12);
    const leavesOn = strands.map(() =>
      Array.from({ length: 16 }, (_, at) => ({ side: at % 2 ? 1 : -1, size: random() })),
    );
    const bloomsOn = strands.map(() =>
      Array.from({ length: 3 }, () => ({ t: 0.3 + random() * 0.7, turn: random() * TAU })),
    );
    const topBlooms = Array.from({ length: 4 }, () => ({
      x: (random() - 0.5) * 22,
      y: -6 - random() * 10,
      turn: random() * TAU,
    }));
    const grow = 0.55 + stage * 0.11;
    const hang = [0, 0, 0.3, 0.65, 1][stage];

    // Hanging strands first, so the mound sits on top of where they leave the pot
    if (hang > 0) {
      strands.forEach((strand, index) => {
        const reach = Math.min(room, 105) * strand.length * hang;
        paintStrand(c, strand, reach, '#5F8D3E');
        // Short strands carry fewer leaves, so leaves sit about as far apart on every strand
        const leaves = leavesOn[index].slice(0, Math.round(5 + strand.length * 11));
        leaves.forEach((leaf, at) => {
          const t = (at + 1) / leaves.length;
          const p = strandAt(strand, reach, t),
            q = strandAt(strand, reach, t + 0.02);
          const along = Math.atan2(q.y - p.y, q.x - p.x);
          paintLeaf(
            c,
            p.x,
            p.y,
            along + leaf.side * 1.1,
            (4.5 + leaf.size * 2) * grow,
            2 * grow,
            LEAF,
            'oval',
            strand.depth * 0.5,
          );
        });
        if (stage === 4) {
          for (const bloom of bloomsOn[index].slice(0, strand.length > 0.45 ? 3 : 1)) {
            const p = strandAt(strand, reach, bloom.t);
            paintBloom(c, p.x, p.y, 5, bloom.turn);
          }
        }
      });
    }

    for (const leaf of mound.slice(0, [0, 6, 10, 13, 16][stage]).sort((a, b) => b.depth - a.depth)) {
      paintLeaf(c, 0, -1, leaf.angle, leaf.reach * grow + 4, 3 * grow, LEAF, 'oval', leaf.depth * 0.5);
    }
    for (const bloom of topBlooms.slice(0, [0, 0, 1, 3, 8][stage]))
      paintBloom(c, bloom.x * grow, bloom.y * grow, 5.2, bloom.turn);
  },
};
