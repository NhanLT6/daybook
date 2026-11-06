import type { PlantKey } from './index';
import type { Ctx } from './kit';

import { PLANTS } from './index';

// Paints a plant at a growth stage, origin at the soil centre. Stage 0 is a bare seed tag.

export function newSeed() {
  return 1 + Math.floor(Math.random() * 2147483646);
}

// Same seed, same random sequence: keeps a plant's shape stable while it grows
function seeded(seed: number): () => number {
  let value = seed % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

function plantTag(c: Ctx) {
  c.fillStyle = '#C9A77A';
  c.fillRect(6, -16, 2, 16);
  c.fillStyle = '#F1E6D2';
  c.beginPath();
  c.roundRect(3, -24, 9, 9, 1.5);
  c.fill();
  c.fillStyle = 'rgba(90,70,50,.5)';
  c.fillRect(5, -21, 5, 1);
  c.fillRect(5, -19, 4, 1);
}

// room: plant pixels free below the soil line, for vines that hang over the pot
export function paintPlant(c: Ctx, species: PlantKey, stage: number, seed: number, room = 40) {
  if (stage === 0) {
    plantTag(c);
    return;
  }
  const plant = PLANTS[species];
  const size = plant.size ?? 1;
  c.save();
  c.scale(size, size);
  plant.paint(c, stage, seeded(seed), room / size);
  c.restore();
  if (stage === 1) plantTag(c);
}
