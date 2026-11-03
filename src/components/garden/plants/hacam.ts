import type { Plant } from './kit';

import { arrowLeaf, stem, TONES } from './kit';

export const hacam: Plant = {
  name: 'Bird of paradise',
  done: 'stands tall',
  paint(c, stage, random) {
    const leaves = [];
    for (let index = 0; index < 7; index++) {
      const spread = (index / 6 - 0.5) * 1.2 + (random() - 0.5) * 0.2;
      leaves.push({
        spread,
        reach: 20 + random() * 14,
        droop: 0.15 + random() * 0.5,
        depth: random(),
        size: 0.85 + random() * 0.3,
      });
    }
    const visible = leaves.slice(0, [0, 2, 3, 5, 7][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const reach = leaf.reach * (0.5 + stage * 0.13);
      const endX = Math.sin(leaf.spread) * reach * 0.8,
        endY = -Math.cos(leaf.spread) * reach;
      stem(c, 0, 0, endX * 0.2, endY * 0.6, endX, endY, 1.6, leaf.depth > 0.5 ? '#C9802F' : '#E39A3B');
      // The blade continues from the petiole tip: upright in the middle, leaning outward at the sides.
      const angle = -Math.PI / 2 + leaf.spread * (1 + leaf.droop);
      const length = 40 * leaf.size * (0.5 + stage * 0.13);
      arrowLeaf(
        c,
        endX,
        endY,
        angle,
        length,
        length * 0.17,
        leaf.depth > 0.5 ? TONES.deep : TONES.fresh,
        leaf.depth * 0.7,
      );
    }
  },
};
