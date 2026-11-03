import type { Plant } from './kit';

import { glossyBall, paintLeaf, stem, TONES } from './kit';

export const senda: Plant = {
  name: 'Succulent',
  done: 'is in flower',
  flowering: true,
  paint(c, stage, random) {
    const rings = [0, 2, 3, 4, 4][stage];
    const leaves = [];
    for (let ring = rings; ring >= 1; ring--) {
      const count = 6 + ring;
      for (let index = 0; index < count; index++) {
        const around = (index / count) * Math.PI * 2 + ring * 0.6 + random() * 0.2;
        leaves.push({ around, ring, length: (5 + ring * 3.4) * (0.75 + stage * 0.07) });
      }
    }
    leaves.sort((a, b) => Math.sin(a.around) - Math.sin(b.around));
    for (const leaf of leaves) {
      const tilt = 0.55 + 0.45 * Math.abs(Math.cos(leaf.around));
      const lift = (rings + 1 - leaf.ring) * 2.6;
      const angle = Math.atan2(Math.sin(leaf.around) * 0.42 - lift * 0.05, Math.cos(leaf.around));
      const back = Math.sin(leaf.around) < 0;
      paintLeaf(
        c,
        0,
        -lift - 2,
        angle,
        leaf.length * tilt,
        leaf.length * 0.36,
        TONES.waxy,
        'plump',
        back ? 0.45 : 0,
        stage >= 3 && leaf.ring >= rings - 1 ? 'rgba(214,120,150,.75)' : 'rgba(214,120,150,.25)',
      );
    }
    if (stage === 4) {
      stem(c, 3, -12, 14, -40, 8, -52, 1.6, '#9C8C5E');
      for (let index = 0; index < 4; index++)
        glossyBall(c, 8 + (index - 1.5) * 4, -52 + Math.abs(index - 1.5) * 3, 2.6, '#FFC59A', '#F08A4E', '#B5552C');
    }
  },
};
