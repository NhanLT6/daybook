// What lies in the open courtyard besides the trees (./grove.ts): a bed of loose pebbles under it and a low
// wooden bench for potted plants. Drawn in room units with (0, 0) on the gravel under
// each piece's centre, lit from the upper right like the courtyard itself.
import type { Ctx } from '../creatures/kit';

import { TAU } from '../creatures/kit';
import { seeded } from '../plants/wood';
import { SHELF_WOOD, woodGrain } from './materials';

// A bed of loose pebbles under the trees: rounded, bean-sized stones of mixed size and tone lying every which way,
// thinning out at the bed's ragged edge. Each has a soft shadow on its lower left and a highlight on its upper right.
export function paintPebbles(c: Ctx, width: number, depth: number, seed: number) {
  const random = seeded(seed);
  const tones = ['#8C8780', '#9F9A92', '#B3AEA6', '#7A756F', '#A8A093', '#C2BDB4'];
  const stones: { x: number; y: number; r: number; turn: number; tone: string }[] = [];
  const count = Math.round((width * depth) / 55);
  for (let i = 0; i < count; i++) {
    const x = random() * width,
      y = random() * depth;
    // Ragged edge: fewer stones toward the bed's front and left
    const edge = Math.min(x / (width * 0.18), (depth - y) / (depth * 0.45), 1);
    if (random() > edge) continue;
    stones.push({ x, y, r: 4 + random() * 5, turn: random() * Math.PI, tone: tones[Math.floor(random() * 6)] });
  }
  stones.sort((a, b) => a.y - b.y);

  for (const stone of stones) {
    const squash = 0.62;
    c.fillStyle = 'rgba(50,46,42,.3)';
    c.beginPath();
    c.ellipse(stone.x - 1.2, stone.y + 1.4, stone.r, stone.r * squash, stone.turn, 0, TAU);
    c.fill();
    const lit = c.createRadialGradient(
      stone.x + stone.r * 0.35,
      stone.y - stone.r * 0.3,
      0.5,
      stone.x,
      stone.y,
      stone.r * 1.1,
    );
    lit.addColorStop(0, 'rgba(255,255,252,.55)');
    lit.addColorStop(0.45, stone.tone);
    lit.addColorStop(1, stone.tone);
    c.fillStyle = lit;
    c.beginPath();
    c.ellipse(stone.x, stone.y, stone.r, stone.r * squash, stone.turn, 0, TAU);
    c.fill();
  }
}

export const BENCH = { width: 300, height: 60 };

// A low wooden bench on two block legs, the kind bonsai stand on outdoors, in the furniture's wood
export function paintBench(c: Ctx) {
  const { width, height } = BENCH;
  const slab = 14;
  c.fillStyle = SHELF_WOOD.leg[2];
  for (const x of [-width * 0.36, width * 0.36]) c.fillRect(x - 14, -height + slab, 28, height - slab);
  const top = c.createLinearGradient(0, -height, 0, -height + slab);
  top.addColorStop(0, SHELF_WOOD.top[0]);
  top.addColorStop(1, SHELF_WOOD.face[2]);
  c.fillStyle = top;
  c.fillRect(-width / 2, -height, width, slab);
  woodGrain(c, -width / 2, -height, width, slab, 0.44, { density: 3, knots: false });
}
