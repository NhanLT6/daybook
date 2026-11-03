import type { Plant } from './kit';

import { facing, paintLeaf, TONES } from './kit';

export const duongxi: Plant = {
  name: 'Fern',
  done: 'is lush and full',
  paint(c, stage, random) {
    const fronds = [];
    for (let index = 0; index < 20; index++) {
      fronds.push({ angle: -Math.PI / 2 + (random() - 0.5) * 1.5, length: 50 + random() * 24, depth: random() });
    }
    const visible = fronds.slice(0, [0, 4, 8, 13, 20][stage]).sort((a, b) => b.depth - a.depth);
    for (const frond of visible) {
      // Fronds leaning toward or away from us look shorter
      const length = frond.length * (0.5 + stage * 0.13) * facing(frond.depth, frond.angle).squash;
      const point = (t: number) => ({
        x: Math.cos(frond.angle) * length * t,
        y: Math.sin(frond.angle) * length * t + t * t * length * 0.18,
      });
      const tone = frond.depth > 0.55 ? TONES.deep : TONES.fresh;
      c.strokeStyle = '#4D7434';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 0);
      for (let t = 0.1; t <= 1.001; t += 0.1) {
        const p = point(t);
        c.lineTo(p.x, p.y);
      }
      c.stroke();
      // A frond is widest about a quarter of the way up, then narrows evenly to a point.
      for (let t = 0.08; t < 0.985; t += 0.045) {
        const p = point(t),
          next = point(t + 0.02);
        const tangent = Math.atan2(next.y - p.y, next.x - p.x);
        const profile = t < 0.25 ? 0.65 + 0.35 * (t / 0.25) : (1 - t) / 0.75;
        const size = Math.max(1.2, 10 * profile) * (0.75 + stage * 0.07);
        paintLeaf(c, p.x, p.y, tangent - 1.0, size, size * 0.34, tone, 'oval', frond.depth * 0.7);
        paintLeaf(c, p.x, p.y, tangent + 1.0, size, size * 0.34, tone, 'oval', frond.depth * 0.7);
      }
      const tip = point(0.985),
        end = point(1);
      paintLeaf(c, tip.x, tip.y, Math.atan2(end.y - tip.y, end.x - tip.x), 2.2, 0.7, tone, 'oval', frond.depth * 0.7);
    }
  },
};
