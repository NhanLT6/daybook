import type { Plant } from './kit';

import { paintRosette } from './rosette';

// Red-edged echeveria (sen đá viền lửa, Echeveria pulidonis): long, slender pale green leaves packed into a
// rose, the red on each leaf strongest at the tip and fading out toward the middle
export const senvienlua: Plant = {
  name: 'Red-edged echeveria',
  done: 'is fully grown',
  paint(c, stage, random) {
    paintRosette(c, random, [0, 8, 14, 20, 26][stage], 13 + stage * 2.5, {
      tone: { light: '#CFE5C2', mid: '#8FBC8A', dark: '#4A7A4F' },
      edge: '#D8332A',
      bloom: 'rgba(245,250,235,.3)',
      leafWidth: 0.27,
      widest: 0.5,
    });
  },
};
