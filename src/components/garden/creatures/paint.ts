import type { Ctx } from './kit';

import { TAU } from './kit';

// Small drawing helpers shared by the night creatures

type Stops = [number, string][];

export function linear(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops) {
  const gradient = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  return gradient;
}

// Radial gradient whose bright centre is nudged by (offsetX, offsetY), toward the light
export function radial(c: Ctx, x: number, y: number, r0: number, r1: number, stops: Stops, offsetX = 0, offsetY = 0) {
  const gradient = c.createRadialGradient(x + offsetX, y + offsetY, r0, x, y, r1);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  return gradient;
}

// Soft fur: short tufts that stay inside the outline, plus a faint fuzzy rim
export function fur(c: Ctx, x: number, y: number, rx: number, ry: number, color: string, count = 40, length = 0.6) {
  c.strokeStyle = color;
  c.lineWidth = 0.16;
  c.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU * 3.1;
    const reach = 0.3 + ((i * 37) % 10) / 16;
    const px = x + Math.cos(angle) * rx * reach,
      py = y + Math.sin(angle) * ry * reach;
    const tuft = Math.min(length * 0.6, (1 - reach) * Math.min(rx, ry));
    c.beginPath();
    c.moveTo(px, py);
    c.lineTo(px + Math.cos(angle + 0.5) * tuft, py + Math.sin(angle + 0.5) * tuft);
    c.stroke();
  }
  c.save();
  c.globalAlpha = 0.35;
  c.lineWidth = 0.35;
  c.setLineDash([0.25, 0.3]);
  c.beginPath();
  c.ellipse(x, y, rx * 1.02, ry * 1.02, 0, 0, TAU);
  c.stroke();
  c.restore();
}

// Feathered antenna along a quadratic curve; side branches shorten toward the tip
export function featherAntenna(
  c: Ctx,
  [x0, y0]: number[],
  [cx, cy]: number[],
  [x1, y1]: number[],
  color: string,
  branch = 1,
) {
  const at = (t: number) => [
    (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
    (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1,
  ];
  c.strokeStyle = color;
  c.lineCap = 'round';
  c.lineWidth = 0.32;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo(cx, cy, x1, y1);
  c.stroke();
  c.lineWidth = 0.14;
  for (let t = 0.08; t < 0.98; t += 0.055) {
    const [x, y] = at(t),
      [nx, ny] = at(t + 0.01);
    const along = Math.atan2(ny - y, nx - x),
      length = branch * (1.1 - t * 0.8);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(along + side * 1.05) * length, y + Math.sin(along + side * 1.05) * length);
      c.stroke();
    }
  }
}

// Eyespot: dark rim, warm ring, pale window
export function eyespot(c: Ctx, x: number, y: number, r: number, rim: string, ring: string, pane: string) {
  const oval = (scale: number, ox = 0, oy = 0) => {
    c.beginPath();
    c.ellipse(x + ox, y + oy, r * scale, r * scale * 0.85, 0.3, 0, TAU);
    c.fill();
  };
  c.fillStyle = rim;
  oval(1);
  c.fillStyle = ring;
  oval(0.72);
  c.fillStyle = pane;
  oval(0.32, -r * 0.1, -r * 0.05);
}

// Stroke a polyline: legs and stalks
export function polyline(c: Ctx, points: number[][], width: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) c.lineTo(x, y);
  c.stroke();
}
