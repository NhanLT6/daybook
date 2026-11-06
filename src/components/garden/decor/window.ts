// Big window behind the cabinet: sky, distant trees and rooftops, a painted frame with a sill, linen curtains.
// Drawn in room units with (0, 0) at the top-left corner of the frame; the room picks the size to fit the scene.
import type { Ctx } from '../creatures/kit';
import type { Daylight } from '../layouts/daylight';

import { TAU } from '../creatures/kit';
import { seeded } from '../plants/wood';

export interface WindowSize {
  width: number;
  height: number;
}

const FRAME = 14,
  MULLION = 7,
  SILL = 12;
// How far the curtains and the rod reach past the frame, on each side and above it
export const WINDOW_REACH = { side: 48, top: 28 };

// The glass area, in window units; the room keeps it out of the night darkening
export const glassOf = ({ width, height }: WindowSize) => ({
  x: FRAME,
  y: FRAME,
  w: width - FRAME * 2,
  h: height - FRAME * 2,
});

function view(c: Ctx, size: WindowSize, dark: boolean, light?: Daylight | null) {
  const { x, y, w, h } = glassOf(size);
  const random = seeded(dark ? 0.83 : 0.29);
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();

  const sky = c.createLinearGradient(0, y, 0, y + h);
  const day = light?.sky ?? ['#CFE2EC', '#E6F0F0', '#F3F2E8'];
  sky.addColorStop(0, dark ? '#16203A' : day[0]);
  sky.addColorStop(0.75, dark ? '#2B3B5A' : day[1]);
  sky.addColorStop(1, dark ? '#34466A' : day[2]);
  c.fillStyle = sky;
  c.fillRect(x, y, w, h);

  if (dark) {
    // Moon with a halo, and a few stars
    const moon = c.createRadialGradient(x + w * 0.7, y + h * 0.22, 0, x + w * 0.7, y + h * 0.22, 46);
    moon.addColorStop(0, 'rgba(255,248,220,.45)');
    moon.addColorStop(1, 'rgba(255,248,220,0)');
    c.fillStyle = moon;
    c.fillRect(x, y, w, h);
    c.fillStyle = '#FFF6DA';
    c.beginPath();
    c.arc(x + w * 0.7, y + h * 0.22, 13, 0, TAU);
    c.fill();
    for (let i = 0; i < 22; i++) {
      c.fillStyle = `rgba(255,255,255,${0.35 + random() * 0.5})`;
      c.fillRect(x + random() * w, y + random() * h * 0.55, 1.4, 1.4);
    }
  } else {
    // Soft clouds
    for (let i = 0; i < 6; i++) {
      const cx = x + random() * w,
        cy = y + h * (0.12 + random() * 0.3);
      for (let puff = 0; puff < 4; puff++) {
        c.fillStyle = light?.far.clouds ?? 'rgba(255,255,255,.55)';
        c.beginPath();
        c.ellipse(cx + puff * 12 - 18, cy + Math.sin(puff * 2) * 3, 16 - Math.abs(puff - 1.5) * 3, 7, 0, 0, TAU);
        c.fill();
      }
    }
  }

  // Rooftops far away, with lit windows at night
  const roofs = [
    [0.02, 0.62, 0.22],
    [0.26, 0.55, 0.18],
    [0.46, 0.66, 0.24],
    [0.72, 0.58, 0.26],
  ];
  for (const [left, top, width] of roofs) {
    c.fillStyle = dark ? '#243049' : (light?.far.roofs ?? '#D6DEDE');
    c.fillRect(x + w * left, y + h * top, w * width, h);
    if (!dark) continue;
    for (let i = 0; i < 4; i++) {
      if (random() < 0.45) continue;
      c.fillStyle = 'rgba(255,205,130,.75)';
      c.fillRect(x + w * (left + 0.03 + random() * (width - 0.08)), y + h * (top + 0.05 + random() * 0.12), 5, 6);
    }
  }

  // Tree canopies in front of the rooftops
  const leaves = dark ? ['#1A2A2C', '#22363A'] : (light?.far.trees ?? ['#AFC8B1', '#C2D6C1']);
  for (let i = 0; i < 44; i++) {
    const tx = x + random() * w,
      ty = y + h * (0.72 + random() * 0.2);
    c.fillStyle = leaves[i % 2];
    c.beginPath();
    c.arc(tx, ty, 16 + random() * 22, 0, TAU);
    c.fill();
  }

  // One soft reflection across the glass
  c.fillStyle = dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.22)';
  c.beginPath();
  c.moveTo(x + w * 0.12, y);
  c.lineTo(x + w * 0.32, y);
  c.lineTo(x + w * 0.08, y + h);
  c.lineTo(x - w * 0.12, y + h);
  c.closePath();
  c.fill();
  c.restore();
}

function frame(c: Ctx, { width, height }: WindowSize) {
  const glass = glassOf({ width, height });
  const paint = '#F7F3EB',
    shade = 'rgba(80,70,55,.18)';
  c.fillStyle = paint;
  // Outer frame as four bars, so the glass between stays untouched
  c.fillRect(0, 0, width, FRAME);
  c.fillRect(0, height - FRAME, width, FRAME);
  c.fillRect(0, 0, FRAME, height);
  c.fillRect(width - FRAME, 0, FRAME, height);
  // Mullions: three tall panes, with a transom near the top
  for (const share of [1 / 3, 2 / 3]) c.fillRect(FRAME + glass.w * share - MULLION / 2, FRAME, MULLION, glass.h);
  c.fillRect(FRAME, FRAME + glass.h * 0.22, glass.w, MULLION);

  // Inner shade where the frame meets the glass
  c.fillStyle = shade;
  c.fillRect(FRAME, FRAME, glass.w, 3);
  c.fillRect(FRAME, FRAME, 3, glass.h);

  // Sill: a deeper ledge with a lit top and its shadow on the wall
  const sillY = height - 4;
  const under = c.createLinearGradient(0, sillY + SILL, 0, sillY + SILL + 14);
  under.addColorStop(0, 'rgba(60,50,40,.22)');
  under.addColorStop(1, 'rgba(60,50,40,0)');
  c.fillStyle = under;
  c.fillRect(-14, sillY + SILL, width + 28, 14);
  c.fillStyle = '#EFEAE0';
  c.fillRect(-16, sillY, width + 32, SILL);
  c.fillStyle = '#FFFFFF';
  c.fillRect(-16, sillY, width + 32, 2);
}

// Linen panel gathered at the rod, falling in soft folds to just below the sill
function curtain(c: Ctx, x: number, w: number, top: number, bottom: number) {
  const folds = 5;
  const linen = c.createLinearGradient(x, 0, x + w, 0);
  for (let fold = 0; fold <= folds * 2; fold++) {
    linen.addColorStop(fold / (folds * 2), fold % 2 ? 'rgba(236,228,212,.96)' : 'rgba(250,246,236,.96)');
  }
  c.fillStyle = linen;
  c.beginPath();
  c.moveTo(x, top);
  c.lineTo(x + w, top);
  c.lineTo(x + w + 4, bottom);
  for (let fold = folds; fold >= 0; fold--) {
    c.quadraticCurveTo(x + (w * (fold + 0.5)) / folds, bottom + 5, x + (w * fold) / folds - 2, bottom);
  }
  c.closePath();
  c.fill();
}

export function paintWindowFrame(c: Ctx, size: WindowSize) {
  const { width, height } = size;
  frame(c, size);
  // Rod above the frame, brass with round finials
  const rodY = -WINDOW_REACH.top + 6;
  c.fillStyle = '#B8964E';
  c.fillRect(-WINDOW_REACH.side + 2, rodY, width + (WINDOW_REACH.side - 2) * 2, 3.5);
  for (const x of [-WINDOW_REACH.side, width + WINDOW_REACH.side]) {
    c.beginPath();
    c.arc(x, rodY + 1.7, 5, 0, TAU);
    c.fill();
  }
  curtain(c, -48, 78, rodY + 2, height + 26);
  curtain(c, width - 30, 78, rodY + 2, height + 26);
}

export function paintWindowView(c: Ctx, size: WindowSize, dark: boolean, light?: Daylight | null) {
  view(c, size, dark, light);
}
