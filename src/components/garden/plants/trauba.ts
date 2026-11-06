import type { Plant } from './kit';

import { facing, makeStrands, paintLeaf, paintStrand, stem, strandAt, TONES } from './kit';

// How full a grown plant is: leaves standing up out of the pot, short ones draping over its rim, and long vines
// (only where there is room below, as in a hanging pot)
export const POTHOS = { upright: 7, drapes: 4, vines: 6 };

// Pothos: heart leaves on short stems from the pot, a few draping over the rim; with room below (hanging pot)
// long vines trail down with leaves along them
export const trauba: Plant = {
  name: 'Pothos',
  trails: true,
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
    // Each leaf on a vine has its own size, side, spread and depth, so the vines read as loose and random
    const leavesOn = strands.map(() =>
      Array.from({ length: 12 }, (_, at) => ({
        size: random(),
        side: (at % 2 ? 1 : -1) * (random() < 0.2 ? -1 : 1),
        spread: 0.7 + random() * 0.8,
        depth: random(),
      })),
    );

    // Long vines first, behind the leaves in the pot; they only grow once the plant is established
    const hang = [0, 0, 0.3, 0.65, 1][stage];
    if (room > 60 && hang > 0) {
      strands.forEach((strand, index) => {
        const reach = Math.min(room, 230) * strand.length * hang;
        paintStrand(c, strand, reach, '#5E8F3F');
        const count = Math.round(3 + strand.length * 9);
        leavesOn[index].slice(0, count).forEach((leaf, at) => {
          const t = (at + 1) / count;
          const p = strandAt(strand, reach, t),
            q = strandAt(strand, reach, Math.min(1, t + 0.02));
          // Leaves stand off the vine at their own angle, along its direction, not all pointing the same way
          const along = Math.atan2(q.y - p.y, q.x - p.x);
          const look = facing(leaf.depth, along + leaf.side * leaf.spread);
          const length = (7 + leaf.size * 4) * (0.6 + stage * 0.1);
          paintLeaf(
            c,
            p.x,
            p.y,
            look.angle,
            length * 1.4 * look.squash,
            length * 0.55,
            leaf.size > 0.5 ? TONES.fresh : TONES.deep,
            'heart',
            look.shade + strand.depth * 0.2,
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
