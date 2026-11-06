// The bed of loose pebbles under the courtyard's trees (./grove.ts). Drawn in room units, lit from the upper right
// like the courtyard itself.
import type { Ctx } from '../creatures/kit';

import { TAU } from '../creatures/kit';
import { seeded } from '../plants/wood';

// A bed of loose pebbles under the trees: rounded, bean-sized stones of mixed size and tone lying every which way,
// thinning out at the bed's ragged edge. Each has a soft shadow on its lower left and a highlight on its upper right.
const TONES = ['#8C8780', '#9F9A92', '#B3AEA6', '#7A756F', '#A8A093', '#C2BDB4'];

// A low heap of pebbles over the trees' feet, so the trunks sink into the stones instead of ending on a line:
// pebbles fill an oval round (0, 0), thinning toward its rim, nearer (lower) ones painted last
export function paintPebbleHeap(c: Ctx, width: number, height: number, seed: number) {
  const random = seeded(seed);
  const tones = TONES;
  const stones: { x: number; y: number; r: number; turn: number; tone: string }[] = [];
  for (let i = 0; i < (width * height) / 9; i++) {
    const angle = random() * Math.PI * 2,
      reach = Math.sqrt(random());
    if (random() < reach * reach * 0.6) continue;
    stones.push({
      x: Math.cos(angle) * width * 0.5 * reach,
      y: Math.sin(angle) * height * 0.5 * reach - (1 - reach) * height * 0.25,
      r: 4 + random() * 5,
      turn: random() * Math.PI,
      tone: tones[Math.floor(random() * tones.length)],
    });
  }
  stones.sort((a, b) => a.y - b.y);
  for (const stone of stones) pebble(c, stone);
}

function pebble(c: Ctx, stone: { x: number; y: number; r: number; turn: number; tone: string }) {
  const squash = 0.62;
  c.fillStyle = 'rgba(50,46,42,.3)';
  c.beginPath();
  c.ellipse(stone.x - 1.2, stone.y + 1.4, stone.r, stone.r * squash, stone.turn, 0, TAU);
  c.fill();
  const lit = c.createRadialGradient(stone.x + stone.r * 0.35, stone.y - stone.r * 0.3, 0.5, stone.x, stone.y, stone.r * 1.1);
  lit.addColorStop(0, 'rgba(255,255,252,.55)');
  lit.addColorStop(0.45, stone.tone);
  lit.addColorStop(1, stone.tone);
  c.fillStyle = lit;
  c.beginPath();
  c.ellipse(stone.x, stone.y, stone.r, stone.r * squash, stone.turn, 0, TAU);
  c.fill();
}

export function paintPebbles(c: Ctx, width: number, depth: number, seed: number) {
  const random = seeded(seed);
  const tones = TONES;
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

  for (const stone of stones) pebble(c, stone);
}
