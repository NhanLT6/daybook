import type { Plant } from './kit';

import { glossyBall, paintLeaf, stem, TONES } from './kit';

export const cachua: Plant = {
  name: 'Cherry tomato',
  done: 'bears fruit',
  paint(c, stage, random) {
    const height = [0, 14, 28, 40, 46][stage];
    if (stage >= 2) {
      const cane = c.createLinearGradient(-2, 0, 2, 0);
      cane.addColorStop(0, '#E7CF9F');
      cane.addColorStop(1, '#A98A55');
      c.fillStyle = cane;
      c.fillRect(-1.2, -height - 6, 2.4, height + 6);
    }
    stem(c, 0, 0, 3, -height / 2, 1, -height, 1.8);
    const leaves = [];
    for (let index = 0; index < 16; index++) {
      leaves.push({ level: 0.2 + random() * 0.8, side: index % 2 ? 1 : -1, size: 8 + random() * 5, depth: random() });
    }
    for (const leaf of leaves.slice(0, [0, 3, 7, 12, 16][stage]).sort((a, b) => b.depth - a.depth)) {
      const angle = leaf.side > 0 ? -0.5 - leaf.depth * 0.4 : Math.PI + 0.5 + leaf.depth * 0.4;
      paintLeaf(
        c,
        1,
        -height * leaf.level,
        angle,
        leaf.size * (0.6 + stage * 0.1),
        leaf.size * 0.32,
        TONES.deep,
        'oval',
        leaf.depth * 0.7,
      );
    }
    if (stage === 3)
      for (const [x, y] of [
        [-8, -26],
        [7, -33],
      ]) {
        c.fillStyle = '#F4D04A';
        c.beginPath();
        c.arc(x, y, 2, 0, Math.PI * 2);
        c.fill();
      }
    if (stage === 4) {
      const fruits = [
        [-9, -14, 4.2, 0],
        [-5, -10, 3.8, 0],
        [8, -22, 4.2, 0],
        [11, -17, 3.6, 1],
        [-7, -34, 3.8, 0],
        [4, -38, 3.2, 2],
      ];
      for (const [x, y, radius, ripeness] of fruits) {
        const colors = [
          ['#FF9A7A', '#E2412C', '#93210F'],
          ['#FFC27A', '#F08A2C', '#A9531A'],
          ['#C8E08A', '#86B34C', '#4F7A2C'],
        ][ripeness];
        glossyBall(c, x, y, radius, colors[0], colors[1], colors[2]);
        c.fillStyle = '#3F6E2C';
        c.beginPath();
        c.arc(x, y - radius + 0.6, 1.3, 0, Math.PI * 2);
        c.fill();
      }
    }
  },
};
