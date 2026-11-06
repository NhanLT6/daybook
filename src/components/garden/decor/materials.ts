// Surface textures for the garden's room: wood grain and plaster. Painted once into the backdrop,
// so they can afford many small strokes. Every texture is seeded, so the room looks the same on every visit.
import type { Ctx } from '../creatures/kit';

import { TAU } from '../creatures/kit';
import { seeded } from '../plants/wood';

interface GrainOptions {
  // Grain runs along x (planks, table tops) or y (legs, door stiles)
  along?: 'x' | 'y';
  dark?: string;
  light?: string;
  // Lines per 10 units across the grain
  density?: number;
  knots?: boolean;
}

// Long, gently wavy grain lines over a box that is already filled, with a few lighter streaks and knots
export function woodGrain(c: Ctx, x: number, y: number, w: number, h: number, seed: number, options: GrainOptions = {}) {
  const { along = 'x', dark = 'rgba(92,52,22,.17)', light = 'rgba(255,238,210,.2)', density = 2.2, knots = true } = options;
  const random = seeded(seed);
  const length = along === 'x' ? w : h,
    across = along === 'x' ? h : w;
  const lines = Math.max(2, Math.round((across / 10) * density));

  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  // Grain is drawn along +x in a local frame, then turned for vertical pieces
  c.translate(x, y);
  if (along === 'y') c.transform(0, 1, 1, 0, 0, 0);

  for (let i = 0; i < lines; i++) {
    const base = random() * across;
    const wave = 0.4 + random() * 1.4,
      period = 40 + random() * 90,
      phase = random() * TAU;
    c.strokeStyle = random() < 0.3 ? light : dark;
    c.lineWidth = 0.4 + random() * 0.8;
    c.beginPath();
    for (let t = 0; t <= length; t += 6) {
      const offset = base + Math.sin(t / period + phase) * wave;
      if (t === 0) c.moveTo(t, offset);
      else c.lineTo(t, offset);
    }
    c.stroke();
  }

  // Knots: small rings the nearby grain seems to flow around
  const knotCount = knots ? Math.floor((length / 160) * random()) : 0;
  for (let k = 0; k < knotCount; k++) {
    const kx = random() * length,
      ky = across * (0.2 + random() * 0.6);
    for (let ring = 0; ring < 3; ring++) {
      c.strokeStyle = dark;
      c.lineWidth = 0.6;
      c.beginPath();
      c.ellipse(kx, ky, 5 + ring * 3.5, 1.4 + ring * 1.1, 0, 0, TAU);
      c.stroke();
    }
  }
  c.restore();
}

// Plaster: fine speckle plus a few large, faint blotches so a flat wall doesn't read as a fill colour
export function plaster(c: Ctx, x: number, y: number, w: number, h: number, seed: number, dark = false) {
  const random = seeded(seed);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();

  for (let i = 0; i < 14; i++) {
    const bx = x + random() * w,
      by = y + random() * h,
      radius = 80 + random() * 220;
    const blotch = c.createRadialGradient(bx, by, 0, bx, by, radius);
    const tone = random() < 0.5 ? (dark ? '255,255,255' : '255,255,250') : dark ? '0,0,10' : '120,100,70';
    blotch.addColorStop(0, `rgba(${tone},.05)`);
    blotch.addColorStop(1, `rgba(${tone},0)`);
    c.fillStyle = blotch;
    c.fillRect(bx - radius, by - radius, radius * 2, radius * 2);
  }

  const specks = Math.round((w * h) / 90);
  for (let i = 0; i < specks; i++) {
    const shade = random() < 0.5;
    c.fillStyle = shade ? 'rgba(90,70,50,.07)' : 'rgba(255,255,255,.16)';
    c.fillRect(x + random() * w, y + random() * h, 1, 1);
  }
  c.restore();
}

// Light oak of the plant shelf and the tall hanging stand: plank tops, plank faces, legs (light → dark)
export const SHELF_WOOD = {
  top: ['#E9C08F', '#D6A774'],
  face: ['#DDAE79', '#C08A55', '#A8733F'],
  leg: ['#D9A872', '#B27C48', '#8E5E33'],
};

// Satin chrome across a box, lit from the left: espresso trim, monitor stand
export function chrome(c: Ctx, x: number, w: number) {
  const metal = c.createLinearGradient(x, 0, x + w, 0);
  metal.addColorStop(0, '#9aa1a8');
  metal.addColorStop(0.18, '#f4f6f7');
  metal.addColorStop(0.45, '#c3c9ce');
  metal.addColorStop(0.75, '#e2e6e9');
  metal.addColorStop(1, '#7d858d');
  return metal;
}
