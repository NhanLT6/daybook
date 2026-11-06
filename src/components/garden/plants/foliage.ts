// Leaves of woody plants (trees, shrubs, the bougainvillea): one painter for all of them, built from what makes a
// small leaf read as real rather than as a flat lozenge:
// - a short stalk, so the leaf hangs from its twig
// - the blade folded along its midrib: the half turned to the light is lighter than the other
// - foreshortening: a leaf turned away from the viewer shows narrower
// - a soft contact shadow on whatever lies behind it, so overlapping leaves separate
// - a slightly different hue per leaf (some yellower, some bluer), as no two leaves are the same green
// - no bright outline, only a faint darker edge on the shaded half
import type { Ctx } from '../creatures/kit';
import type { Tone } from './kit';

import { LIGHT } from './kit';

export interface LeafLook {
  // 0 seen edge-on .. 1 seen flat
  turn?: number;
  // 0 in the light .. 1 deep in shade (further back, under other leaves)
  shade?: number;
  // -1 bluer .. 1 yellower
  hue?: number;
  // Contact shadow behind the leaf
  shadow?: boolean;
}

// A leaf's own turn and hue from any number it already has (a depth, a seed), so painting it this way draws no
// extra random numbers and leaves the plant's shape as it was
export function leafVariety(n: number): { turn: number; hue: number } {
  const a = (Math.abs(n) * 9301 + 0.4927) % 1,
    b = (Math.abs(n) * 49297 + 0.233) % 1;
  return { turn: 0.45 + a * 0.55, hue: b * 1.6 - 0.8 };
}

// Half of a pointed oval blade from base to tip on one side (side -1 above the midrib, 1 below)
function half(c: Ctx, from: number, length: number, width: number, side: number) {
  c.beginPath();
  c.moveTo(from, 0);
  c.bezierCurveTo(from + length * 0.2, side * width * 1.05, from + length * 0.7, side * width * 0.95, from + length, 0);
  c.closePath();
}

export function paintFoliageLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  tone: Tone,
  look: LeafLook = {},
) {
  const { turn = 1, shade = 0, hue = 0, shadow = true } = look;
  const stalk = length * 0.14,
    blade = length - stalk;
  const w = width * (0.35 + 0.65 * turn);
  c.save();
  c.translate(x, y);
  c.rotate(angle);

  if (shadow) {
    c.save();
    c.translate(0.9, 1.4);
    c.fillStyle = 'rgba(20,34,24,.16)';
    half(c, stalk, blade, w * 1.05, -1);
    c.fill();
    half(c, stalk, blade, w * 1.05, 1);
    c.fill();
    c.restore();
  }

  // Stalk
  c.strokeStyle = tone.dark;
  c.lineWidth = Math.max(0.4, width * 0.16);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(stalk + 0.5, 0);
  c.stroke();

  // Which half faces the light: the one whose outward normal points toward the upper left (before mirroring)
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  for (const side of [-1, 1]) {
    const lit = (side === -1) === upperLit;
    const g = c.createLinearGradient(stalk, 0, stalk + blade, 0);
    g.addColorStop(0, lit ? tone.mid : tone.dark);
    g.addColorStop(0.55, lit ? tone.light : tone.mid);
    g.addColorStop(1, lit ? tone.mid : tone.dark);
    half(c, stalk, blade, w, side);
    c.fillStyle = g;
    c.fill();
    if (!lit) {
      c.strokeStyle = 'rgba(20,40,24,.22)';
      c.lineWidth = 0.4;
      c.stroke();
    }
  }

  // Whole-blade tint: its own hue, then how deep in shade it sits
  c.beginPath();
  c.moveTo(stalk, 0);
  c.bezierCurveTo(stalk + blade * 0.2, -w * 1.05, stalk + blade * 0.7, -w * 0.95, stalk + blade, 0);
  c.bezierCurveTo(stalk + blade * 0.7, w * 0.95, stalk + blade * 0.2, w * 1.05, stalk, 0);
  if (hue !== 0) {
    c.fillStyle = hue > 0 ? `rgba(230,220,90,${0.14 * hue})` : `rgba(40,90,110,${-0.14 * hue})`;
    c.fill();
  }
  if (shade > 0) {
    c.fillStyle = `rgba(22,38,40,${0.5 * Math.min(1, shade)})`;
    c.fill();
  }

  // Midrib, a fine pale line that fades toward the tip
  const rib = c.createLinearGradient(stalk, 0, stalk + blade, 0);
  rib.addColorStop(0, 'rgba(230,240,200,.45)');
  rib.addColorStop(1, 'rgba(230,240,200,0)');
  c.strokeStyle = rib;
  c.lineWidth = Math.max(0.35, width * 0.1);
  c.beginPath();
  c.moveTo(stalk, 0);
  c.lineTo(stalk + blade * 0.9, 0);
  c.stroke();
  c.restore();
}
