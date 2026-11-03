import type { Plant } from './kit';

import { glossyBall, stem } from './kit';
import { paintRosette } from './rosette';

// Blue-green echeveria with pink-flushed tips and a powdery bloom; flowers on an arching stalk when grown
export const senda: Plant = {
  name: 'Succulent',
  done: 'is in flower',
  flowering: true,
  paint(c, stage, random) {
    // Stalk first, so the rosette covers where it comes out
    if (stage === 4) {
      stem(c, 3, -6, 16, -36, 9, -48, 1.6, '#9C8C5E');
      for (let index = 0; index < 4; index++)
        glossyBall(c, 9 + (index - 1.5) * 4, -48 + Math.abs(index - 1.5) * 3, 2.6, '#FFC59A', '#F08A4E', '#B5552C');
    }
    paintRosette(c, random, [0, 7, 12, 17, 21][stage], 13 + stage * 2.2, {
      tone: { light: '#C4E2D2', mid: '#7FB3A0', dark: '#3F7563' },
      blush: stage >= 3 ? 'rgba(222,120,150,.7)' : 'rgba(222,120,150,.3)',
      bloom: 'rgba(235,245,250,.35)',
    });
  },
};
