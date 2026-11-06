import type { Plant } from './kit';

import { facing, makeStrands, paintLeaf, paintStrand, stem, strandAt, TONES } from './kit';

// How full a grown plant is: leaves standing up out of the pot, short ones draping over its rim, long vines
// (only where there is room below, as in a hanging pot), and size next to other plants
export const POTHOS = { upright: 11, drapes: 6, vines: 6, size: 1.3 };

// Pothos: heart leaves on short stems from the pot, a few draping over the rim; with room below (hanging pot)
// long vines trail down with leaves along them
export const trauba: Plant = {
  name: 'Pothos',
  trails: true,
  size: POTHOS.size,
  done: 'trails long vines',
  paint(c, stage, random, room) {
    const leaves = [];
    for (let index = 0; index < POTHOS.upright + POTHOS.drapes; index++) {
      const drape = index >= POTHOS.upright;
      const angle = drape
        ? (index % 2 ? 0.25 : Math.PI - 0.25) + (random() - 0.5) * 0.3
        : -Math.PI / 2 + (random() - 0.5) * 2.3;
      const reach = (drape ? 20 + random() * 10 : 16 + random() * 22) * (0.55 + stage * 0.1);
      leaves.push({ angle, reach, drape, depth: random(), size: 9 + random() * 5, twist: (random() - 0.5) * 0.7 });
    }
    const strands = makeStrands(random, POTHOS.vines);
    const leavesOn = strands.map(() => Array.from({ length: 12 }, () => random()));

    // Long vines first, behind the leaves in the pot; they only grow once the plant is established
    const hang = [0, 0, 0.3, 0.65, 1][stage];
    if (room > 60 && hang > 0) {
      strands.forEach((strand, index) => {
        const reach = Math.min(room, 230) * strand.length * hang;
        paintStrand(c, strand, reach, '#5E8F3F');
        const count = Math.round(3 + strand.length * 9);
        leavesOn[index].slice(0, count).forEach((size, at) => {
          const t = (at + 1) / count;
          const p = strandAt(strand, reach, t);
          const side = at % 2 ? 1 : -1;
          const length = (8 + size * 5) * (0.6 + stage * 0.1);
          paintLeaf(
            c,
            p.x,
            p.y,
            Math.PI / 2 + side * 0.9,
            length * 1.5,
            length * 0.6,
            size > 0.5 ? TONES.fresh : TONES.deep,
            'heart',
            strand.depth * 0.3,
          );
        });
      });
    }

    const shown = (share: number, count: number) => Math.round(count * share);
    const share = [0, 0.2, 0.4, 0.65, 1][stage];
    const visible = [
      ...leaves.filter((leaf) => !leaf.drape).slice(0, shown(share, POTHOS.upright)),
      ...leaves.filter((leaf) => leaf.drape).slice(0, shown(stage >= 3 ? share : 0, POTHOS.drapes)),
    ].sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const endX = Math.cos(leaf.angle) * leaf.reach;
      const endY = leaf.drape ? leaf.reach * 0.4 : Math.sin(leaf.angle) * leaf.reach;
      stem(c, 0, 0, endX * 0.5, Math.min(endY, 0) - (leaf.drape ? 14 : 8), endX, endY, 1.3);
      const size = leaf.size * (0.6 + stage * 0.12);
      const pointing = leaf.drape ? Math.PI / 2 + (endX > 0 ? -0.5 : 0.5) : leaf.angle + leaf.twist;
      const look = facing(leaf.depth, pointing);
      paintLeaf(
        c,
        endX,
        endY,
        look.angle,
        size * 1.6 * look.squash,
        size * 0.62,
        leaf.depth > 0.6 ? TONES.deep : TONES.fresh,
        'heart',
        look.shade + leaf.depth * 0.2,
      );
    }
    if (stage === 4) {
      stem(c, 0, 0, 3, -18, 2, -34, 1.3);
      paintLeaf(c, 2, -34, -Math.PI / 2 - 0.2, 12, 4, TONES.fresh, 'heart', 0);
    }
  },
};
