import type { Plant } from './kit';

import { paintLeaf, stem, TONES } from './kit';

export const trauba: Plant = {
  name: 'Pothos',
  done: 'trails long vines',
  paint(c, stage, random) {
    const leaves = [];
    for (let index = 0; index < 11; index++) {
      const drape = index >= 7;
      const angle = drape
        ? (index % 2 ? 0.25 : Math.PI - 0.25) + (random() - 0.5) * 0.3
        : -Math.PI / 2 + (random() - 0.5) * 2.3;
      const reach = (drape ? 20 + random() * 10 : 16 + random() * 22) * (0.55 + stage * 0.1);
      leaves.push({ angle, reach, drape, depth: random(), size: 9 + random() * 5, twist: (random() - 0.5) * 0.7 });
    }
    const visible = leaves.slice(0, [0, 2, 4, 7, 11][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const endX = Math.cos(leaf.angle) * leaf.reach;
      const endY = leaf.drape ? leaf.reach * 0.4 : Math.sin(leaf.angle) * leaf.reach;
      stem(c, 0, 0, endX * 0.5, Math.min(endY, 0) - (leaf.drape ? 14 : 8), endX, endY, 1.3);
      const size = leaf.size * (0.6 + stage * 0.12);
      const pointing = leaf.drape ? Math.PI / 2 + (endX > 0 ? -0.5 : 0.5) : leaf.angle + leaf.twist;
      paintLeaf(
        c,
        endX,
        endY,
        pointing,
        size * 1.6,
        size * 0.62,
        leaf.depth > 0.6 ? TONES.deep : TONES.fresh,
        'heart',
        leaf.depth * 0.8,
      );
    }
    if (stage === 4) {
      stem(c, 0, 0, 3, -18, 2, -34, 1.3);
      paintLeaf(c, 2, -34, -Math.PI / 2 - 0.2, 12, 4, TONES.fresh, 'heart', 0);
    }
  },
};
