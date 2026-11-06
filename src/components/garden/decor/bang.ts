// Japanese bàng (Terminalia mantaly): a slim straight trunk with branches in flat whorls, tier above tier like a
// pagoda, each tier a wide plate of small rounded leaves held in rosettes. Drawn in room units, (0, 0) on the
// ground under the trunk. The trunk is still; each tier is painted on its own so the scene can stir it in the wind.
import type { Ctx } from '../creatures/kit';
import type { Curve } from '../plants/wood';

import { TAU } from '../creatures/kit';
import { paintLeaf } from '../plants/kit';
import { paintLimb, seeded } from '../plants/wood';

const BARK = { dark: '#5A5650', mid: '#7E7A73', light: '#A8A49C', crack: '#4A4640', rough: 0.25 };
// Softer than the shelf plants' greens: fresh, not glossy
const LEAF = { light: '#B5D58C', mid: '#7BA95A', dark: '#4C7A3E' };

export interface BangTier {
  // Height on the trunk where the tier leaves it
  y: number;
  // How far it reaches to the left and to the right
  left: number;
  right: number;
  seed: number;
  // 0 out in the light .. 1 deep in the shade of the tiers above
  shade: number;
}

// Tiers from the bottom up. `reach` is how far left the widest tier may go; upper tiers reach further here because
// the tree leans its crown into the open middle of the courtyard.
export function bangTiers(height: number, reach: number): BangTier[] {
  const levels = [0.42, 0.55, 0.67, 0.78, 0.88, 0.96];
  return levels.map((level, index) => {
    const t = index / (levels.length - 1);
    // The crown's top is a small young tier
    const top = index === levels.length - 1 ? 0.35 : 1;
    return {
      y: -height * level,
      left: reach * (0.42 + t * 0.58) * top,
      right: reach * (0.3 + t * 0.15) * top,
      seed: 0.11 + index * 0.137,
      shade: 0.3 * (1 - t),
    };
  });
}

export function paintBangTrunk(c: Ctx, height: number) {
  const curve: Curve = [
    { x: 0, y: 0 },
    { x: 3, y: -height * 0.35 },
    { x: -4, y: -height * 0.7 },
    { x: -2, y: -height * 0.97 },
  ];
  paintLimb(c, curve, 26, 7, BARK, 0.42, 0.04, 0.05);
}

// A rosette of leaves seen almost edge-on: they fan out flat around a twig tip, so the ring is squashed. Far
// leaves first and darker, near leaves last and lit.
function rosette(c: Ctx, x: number, y: number, size: number, random: () => number, shade: number) {
  const leaves = Array.from({ length: 7 }, (_, index) => {
    const around = (index / 7) * TAU + random() * 0.6;
    return { around, depth: Math.sin(around) };
  }).sort((a, b) => a.depth - b.depth);
  for (const leaf of leaves) {
    const dx = Math.cos(leaf.around),
      dy = Math.sin(leaf.around) * 0.32;
    const angle = Math.atan2(dy, dx) + (random() - 0.5) * 0.3;
    const far = (1 - leaf.depth) / 2;
    paintLeaf(c, x, y, angle, size * (0.85 + random() * 0.3), size * 0.42, LEAF, 'plump', Math.min(1, shade + far * 0.45));
  }
}

// One tier: a few branches leave the trunk level, bow up a little and droop at the tips, with rosettes along them
// and a dense plate at the ends. (0, 0) is where the tier leaves the trunk.
export function paintBangTier(c: Ctx, tier: BangTier) {
  const random = seeded(tier.seed);
  const branches = [
    { to: -tier.left, lift: -8 },
    { to: -tier.left * 0.62, lift: -2 },
    { to: tier.right, lift: -6 },
    { to: tier.right * 0.55, lift: 2 },
  ];
  const rosettes: { x: number; y: number; size: number }[] = [];
  for (const branch of branches) {
    const end = { x: branch.to, y: Math.abs(branch.to) * 0.1 + branch.lift };
    const curve: Curve = [
      { x: 0, y: 0 },
      { x: end.x * 0.35, y: -6 + branch.lift * 0.5 },
      { x: end.x * 0.75, y: end.y - 4 },
      end,
    ];
    paintLimb(c, curve, 3.2, 1.1, BARK, random(), 0.03, 0.05);
    // Rosettes from about a fifth of the way out: the plate is thickest in the middle and thins to its tip
    for (let t = 0.2; t <= 1.02; t += 0.06 + random() * 0.03) {
      const x = end.x * t,
        y = end.y * t - 4 * Math.sin(t * Math.PI);
      const thick = 10 + 26 * Math.sin(Math.min(1, t) * Math.PI * 0.9);
      for (let i = 0; i < 3; i++) {
        rosettes.push({ x: x + (random() - 0.5) * 26, y: y + (random() - 0.6) * thick, size: 11 + random() * 4 });
      }
    }
  }
  // Back rosettes first: higher on screen means further away in the flat plate
  rosettes.sort((a, b) => a.y - b.y);
  for (const spot of rosettes) rosette(c, spot.x, spot.y, spot.size, random, tier.shade);
}
