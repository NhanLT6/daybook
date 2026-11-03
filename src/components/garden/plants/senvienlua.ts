import type { Plant } from './kit';

import { glossyBall, stem } from './kit';
import { paintRosette } from './rosette';

// Red-edged echeveria (sen đá viền lửa, Echeveria pulidonis): a tight rose of pale green leaves, each with a
// bright red margin and tip; yellow bells on an arching stalk when grown
export const senvienlua: Plant = {
  name: 'Red-edged echeveria',
  done: 'is in flower',
  flowering: true,
  paint(c, stage, random) {
    // Stalk first, so the rosette covers where it comes out
    if (stage === 4) {
      stem(c, -2, -6, -16, -34, -12, -46, 1.4, '#C25A3A');
      for (let index = 0; index < 5; index++)
        glossyBall(c, -12 + (index - 2) * 3.4, -46 + Math.abs(index - 2) * 2.6, 2.3, '#FFF1A6', '#F4C82E', '#B58A12');
    }
    paintRosette(c, random, [0, 8, 14, 20, 26][stage], 12 + stage * 2.1, {
      tone: { light: '#CFE5C2', mid: '#8FBC8A', dark: '#4A7A4F' },
      edge: stage >= 2 ? '#D8332A' : 'rgba(216,51,42,.55)',
      bloom: 'rgba(245,250,235,.3)',
    });
  },
};
