import type { Plant } from './kit';

import { glossyBall, paintLeaf, stem, TONES } from './kit';

export const cuc: Plant = {
  name: 'Daisy',
  done: 'is in bloom',
  flowering: true,
  paint(c, stage, random) {
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
