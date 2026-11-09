import type { Ctx, Plant } from './kit';

import { linear } from '../creatures/paint';

// One sword leaf from the soil: dark green with pale grey-green wavy bands and a yellow margin.
// `twist` turns it a little so one edge shows, the way the leaves spiral.
function paintBlade(c: Ctx, x: number, lean: number, height: number, width: number, twist: number, depth: number) {
  c.save();
  c.translate(x, 0);
  c.rotate(lean);
  // The two sides from base to tip, left open at the base: the margin runs up the sides only, never across the
  // base where the leaf comes out of the soil
  const sides = new Path2D();
  sides.moveTo(-width * 0.5, 0);
  sides.bezierCurveTo(-width * 0.75, -height * 0.45, -width * (0.55 - twist), -height * 0.8, twist * width, -height);
  sides.bezierCurveTo(width * (0.55 + twist), -height * 0.8, width * 0.75, -height * 0.45, width * 0.5, 0);
  const blade = new Path2D(sides);
  blade.closePath();
  c.fillStyle = linear(c, -width, 0, width, 0, [
    [0, '#5E8F52'],
    [0.45 + twist * 0.3, '#2E5A31'],
    [1, '#1D3D22'],
  ]);
  c.fill(blade);
  c.save();
  c.clip(blade);
  // Cross bands, wavy like a snake's skin
  c.strokeStyle = 'rgba(170,200,150,.4)';
  c.lineWidth = 0.9;
  for (let y = -3; y > -height; y -= 3.4) {
    c.beginPath();
    c.moveTo(-width, y);
    for (let u = -width; u <= width; u += width / 3) c.lineTo(u, y + Math.sin(u * 1.3 + y) * 0.9);
    c.stroke();
  }
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.4 * depth})`;
    c.fill(blade);
  }
  c.restore();
  // Golden edge
  c.strokeStyle = '#D9C657';
  c.lineWidth = 1.1;
  c.lineCap = 'butt';
  c.stroke(sides);
  c.strokeStyle = 'rgba(255,250,200,.35)';
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(-width * 0.45, -2);
  c.bezierCurveTo(-width * 0.68, -height * 0.45, -width * (0.5 - twist), -height * 0.78, twist * width, -height + 1);
  c.stroke();
  c.restore();
}

// Snake plant: stiff upright sword leaves with yellow edges, a few leaning outward
export const luoiho: Plant = {
  name: 'Snake plant',
  done: 'stands tall',
  paint(c, stage, random) {
    const blades = [];
    for (let index = 0; index < 8; index++) {
      blades.push({
        x: (random() - 0.5) * 16,
        lean: (random() - 0.5) * 0.4,
        height: 40 + random() * 30,
        width: 7 + random() * 3,
        twist: (random() - 0.5) * 0.5,
        depth: random(),
      });
    }
    const grow = 0.45 + stage * 0.14;
    const visible = blades.slice(0, [0, 2, 4, 6, 8][stage]).sort((a, b) => b.depth - a.depth);
    for (const blade of visible) {
      paintBlade(
        c,
        blade.x,
        blade.lean + blade.x * 0.012,
        blade.height * grow,
        blade.width * (0.7 + grow * 0.3),
        blade.twist,
        blade.depth * 0.6,
      );
    }
  },
};
