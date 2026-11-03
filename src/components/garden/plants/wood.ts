import type { Ctx } from './kit';

import { LIGHT, TAU } from './kit';

export type Point = { x: number; y: number };
export type Curve = [Point, Point, Point, Point];

export interface Bark {
  dark: string;
  mid: string;
  light: string;
  // Colour of cracks and knots
  crack: string;
  // 0 smooth skin (desert rose) .. 1 deeply fissured bark (old bougainvillea)
  rough: number;
}

export function bezier([a, b, c, d]: Curve, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

// Own little seeded random, so a limb's bark pattern never depends on how many limbs came before it
export function seeded(seed: number) {
  let value = Math.floor(seed * 2147483646) % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}

const STEPS = 28;

// Woody limb along a cubic curve, tapering from `from` to `to` thickness. Built as a real outline (not
// strokes), shaded across its width toward the light, then textured with fissures, knots and a few
// lenticels. `seed` (0-1) fixes the bark pattern; `bulge` swells it a little here and there; `gnarl` bends it
// off its curve in small kinks and roughens its edges, for old twisted wood.
export function paintLimb(
  c: Ctx,
  curve: Curve,
  from: number,
  to: number,
  bark: Bark,
  seed: number,
  bulge = 0.12,
  gnarl = 0,
) {
  const random = seeded(seed);
  const phase = random() * TAU;
  const samples = Array.from({ length: STEPS + 1 }, (_, index) => {
    const t = index / STEPS;
    const p = bezier(curve, t),
      q = bezier(curve, Math.min(1, t + 0.01)),
      r = bezier(curve, Math.max(0, t - 0.01));
    const length = Math.hypot(q.x - r.x, q.y - r.y) || 1;
    const normal = { x: -(q.y - r.y) / length, y: (q.x - r.x) / length };
    // Taper with a slight swell near the base and soft lumps along the way, like a grown branch
    const width = (from + (to - from) * Math.pow(t, 0.8)) * (1 + bulge * Math.sin(t * 9 + phase) * (1 - t * 0.5));
    // Kinks: the centre line wanders sideways, pinned at both ends; the outline gets small lumps
    const wander =
      gnarl *
      from *
      0.35 *
      Math.sin(Math.PI * t) *
      (Math.sin(t * 13 + phase) * 0.6 + Math.sin(t * 29 + phase * 2) * 0.4);
    const lumpy = 1 + gnarl * 0.18 * Math.sin(t * 41 + phase * 3);
    const centre = { x: p.x + normal.x * wander, y: p.y + normal.y * wander };
    return { t, p: centre, normal, half: (width / 2) * lumpy };
  });
  // Which way the normals face the light, so the lit flank lands on the upper-left side
  const middle = samples[STEPS >> 1].normal;
  const lit = middle.x * LIGHT.x + middle.y * LIGHT.y < 0 ? 1 : -1;
  // Path of the band between two offsets across the limb (-1 one edge .. 1 the other, lit side positive)
  const band = (low: number, high: number) => {
    const path = new Path2D();
    samples.forEach(({ p, normal, half }, index) => {
      const x = p.x - normal.x * half * low * lit,
        y = p.y - normal.y * half * low * lit;
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    for (let index = STEPS; index >= 0; index--) {
      const { p, normal, half } = samples[index];
      path.lineTo(p.x - normal.x * half * high * lit, p.y - normal.y * half * high * lit);
    }
    path.closePath();
    return path;
  };

  const body = band(-1, 1);
  c.fillStyle = bark.dark;
  c.fill(body);
  c.fillStyle = bark.mid;
  c.fill(band(-0.35, 0.92));
  c.fillStyle = bark.light;
  c.fill(band(0.35, 0.78));

  c.save();
  c.clip(body);
  c.lineCap = 'round';
  // Fissures: long wavy cracks running along the limb, broken into pieces
  const lines = Math.round(2 + bark.rough * 4);
  for (let line = 0; line < lines; line++) {
    const offset = -0.8 + (1.6 * (line + 0.5)) / lines + (random() - 0.5) * 0.15;
    const wave = random() * TAU;
    let drawing = false;
    c.strokeStyle = bark.crack;
    c.globalAlpha = 0.35 + bark.rough * 0.35;
    c.lineWidth = 0.25 + bark.rough * 0.25;
    c.beginPath();
    for (const { t, p, normal, half } of samples) {
      if (random() < 0.18) drawing = !drawing;
      const o = (offset + Math.sin(t * 14 + wave) * 0.08) * half;
      if (drawing) c.lineTo(p.x + normal.x * o, p.y + normal.y * o);
      else c.moveTo(p.x + normal.x * o, p.y + normal.y * o);
    }
    c.stroke();
  }
  // Thin pale ridges between the cracks catch the light
  c.strokeStyle = bark.light;
  c.globalAlpha = 0.25 + bark.rough * 0.25;
  c.lineWidth = 0.25;
  for (let line = 0; line < lines - 1; line++) {
    const offset = (-0.8 + (1.6 * (line + 1)) / lines) * lit;
    c.beginPath();
    for (const { t, p, normal, half } of samples) {
      if (t < 0.05 || t > 0.95) continue;
      const o = offset * half;
      c.lineTo(p.x + normal.x * o, p.y + normal.y * o);
    }
    c.stroke();
  }
  // Ring creases across the limb, more on smooth skins (the folds of a desert rose)
  c.strokeStyle = bark.crack;
  c.globalAlpha = 0.3;
  c.lineWidth = 0.3;
  const rings = Math.round(3 + (1 - bark.rough) * 4);
  for (let ring = 0; ring < rings; ring++) {
    const { p, normal, half } = samples[Math.floor((0.08 + random() * 0.84) * STEPS)];
    const along = { x: normal.y, y: -normal.x };
    const span = 0.3 + random() * 0.5;
    c.beginPath();
    c.moveTo(p.x - normal.x * half * span, p.y - normal.y * half * span);
    c.quadraticCurveTo(
      p.x + along.x * half * 0.25,
      p.y + along.y * half * 0.25,
      p.x + normal.x * half * span,
      p.y + normal.y * half * span,
    );
    c.stroke();
  }
  // Lenticels: tiny pale dots in the skin
  c.fillStyle = bark.light;
  c.globalAlpha = 0.5;
  for (let dot = 0; dot < 8; dot++) {
    const { p, normal, half } = samples[Math.floor(random() * STEPS)];
    const o = (random() - 0.5) * 1.6 * half;
    c.beginPath();
    c.ellipse(p.x + normal.x * o, p.y + normal.y * o, 0.35, 0.18, Math.atan2(normal.y, normal.x), 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
  // Knots where old side shoots were cut: a dark eye with a raised lip
  const knots = Math.round(bark.rough * 2.4);
  for (let knot = 0; knot < knots; knot++) {
    const { p, normal, half } = samples[Math.floor((0.2 + random() * 0.6) * STEPS)];
    const o = (random() - 0.5) * half;
    const x = p.x + normal.x * o,
      y = p.y + normal.y * o;
    const angle = Math.atan2(normal.x, -normal.y);
    c.fillStyle = bark.light;
    c.beginPath();
    c.ellipse(x - 0.2, y - 0.2, half * 0.42, half * 0.28, angle, 0, TAU);
    c.fill();
    c.fillStyle = bark.crack;
    c.beginPath();
    c.ellipse(x, y, half * 0.3, half * 0.18, angle, 0, TAU);
    c.fill();
  }
  c.restore();

  // Shaded edge on the dark side keeps the limb round
  c.strokeStyle = 'rgba(30,20,12,.35)';
  c.lineWidth = 0.35;
  c.stroke(band(-1, -0.98));
}
