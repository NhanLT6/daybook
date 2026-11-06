// A clump of Japanese snowbell (Styrax japonicus), the small multi-stem tree of Japanese courtyards: a few slim
// trunks rising close together from one spot, each wavering on its way up and leaning out, with layered branches of
// soft oval leaves. Drawn in room units, (0, 0) on the ground where the trunks meet it.
//
// The clump is cut into pieces (each trunk, each branch with its leaves) so the scene can paint them back to front
// and stir the branches in the wind. Branches of different trunks interleave; those further back are darker.
import type { Ctx } from '../creatures/kit';
import type { Curve, Point } from '../plants/wood';

import { paintLeaf } from '../plants/kit';
import { bezier, paintLimb, seeded } from '../plants/wood';

const BARK = { dark: '#4E4A45', mid: '#6E6962', light: '#9A958C', crack: '#3A3632', rough: 0.3 };
// Softer than the shelf plants' greens: fresh, not glossy
const LEAF = { light: '#B5D58C', mid: '#7BA95A', dark: '#4C7A3E' };

export interface GrovePiece {
  // Where the piece is pinned (a branch: its joint on the trunk), relative to the clump's foot
  x: number;
  y: number;
  // Back -1 .. front 1; the scene paints pieces in this order
  depth: number;
  // Room around the pin the piece paints into: left, right, up, down
  box: [number, number, number, number];
  // How much it moves in the wind (0 for trunks)
  sway: number;
  // Paints with (0, 0) at the pin
  paint: (c: Ctx) => void;
}

// A trunk from its foot: a few bends of random size so it wavers instead of standing straight
function trunkCurve(random: () => number, foot: number, lean: number, tall: number): Curve {
  const wobble = () => (random() - 0.5) * tall * 0.2;
  return [
    { x: foot, y: 0 },
    { x: foot + lean * tall * 0.15 + wobble(), y: -tall * 0.35 },
    { x: foot + lean * tall * 0.5 + wobble(), y: -tall * 0.68 },
    { x: foot + lean * tall * 0.75, y: -tall },
  ];
}

// One branch with its twigs and leaves, (0, 0) at its joint. `shade` darkens it the further back it sits.
function paintBranch(c: Ctx, seed: number, angle: number, length: number, shade: number) {
  const random = seeded(seed);
  const end = { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
  // Arches up a little before running out
  const curve: Curve = [
    { x: 0, y: 0 },
    { x: end.x * 0.3, y: end.y * 0.3 - length * 0.14 },
    { x: end.x * 0.7, y: end.y * 0.7 - length * 0.1 },
    end,
  ];
  const bark = shade > 0.3 ? { ...BARK, mid: BARK.dark, light: BARK.mid } : BARK;
  paintLimb(c, curve, 4.2, 1.2, bark, random(), 0.05, 0.3);

  // Side twigs, each ending in a spray; plus the branch's own tip
  const sprays: { from: Point; angle: number; length: number }[] = [{ from: end, angle, length: length * 0.3 }];
  for (let t = 0.25; t < 0.95; t += 0.12 + random() * 0.08) {
    const from = bezier(curve, t);
    const side = random() < 0.5 ? -1 : 1;
    const twigAngle = angle + side * (0.5 + random() * 0.5);
    const twigLength = length * (0.22 + random() * 0.12);
    const to = { x: from.x + Math.cos(twigAngle) * twigLength, y: from.y + Math.sin(twigAngle) * twigLength };
    c.strokeStyle = bark.mid;
    c.lineWidth = 1.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.quadraticCurveTo((from.x + to.x) / 2, (from.y + to.y) / 2 - 4, to.x, to.y);
    c.stroke();
    sprays.push({ from, angle: twigAngle, length: twigLength });
  }

  // Leaves along each twig, alternate and drooping a little, the ones on the far side of the twig darker
  const leaves: { x: number; y: number; angle: number; size: number; far: boolean }[] = [];
  for (const spray of sprays) {
    for (let t = 0.15; t <= 1.05; t += 0.1) {
      const x = spray.from.x + Math.cos(spray.angle) * spray.length * t,
        y = spray.from.y + Math.sin(spray.angle) * spray.length * t;
      for (const side of [-1, 1]) {
        if (random() < 0.15) continue;
        const droop = Math.cos(spray.angle) > 0 ? 0.25 : -0.25;
        leaves.push({
          x,
          y,
          angle: spray.angle + side * (0.6 + random() * 0.5) + droop,
          size: 11 + random() * 5,
          far: random() < 0.45,
        });
      }
    }
  }
  leaves.sort((a, b) => Number(b.far) - Number(a.far));
  for (const leaf of leaves) {
    paintLeaf(c, leaf.x, leaf.y, leaf.angle, leaf.size, leaf.size * 0.42, LEAF, 'oval', shade + (leaf.far ? 0.22 : 0));
  }
}

// The clump `tall` high, its crown reaching about `reach` to the left (into the open courtyard) and less to the right
export function snowbellGrove(tall: number, reach: number): GrovePiece[] {
  const random = seeded(0.73);
  const trunks = [
    { foot: -22, lean: -0.42, tall: 0.92, width: 15 },
    { foot: -6, lean: -0.1, tall: 1, width: 17 },
    { foot: 10, lean: 0.12, tall: 0.86, width: 13 },
    { foot: 24, lean: -0.25, tall: 0.74, width: 12 },
  ];
  const pieces: GrovePiece[] = [];

  trunks.forEach((trunk, index) => {
    const height = tall * trunk.tall;
    const curve = trunkCurve(random, trunk.foot, trunk.lean * 1.6 * (reach / tall), height);
    const xs = curve.map((point) => point.x);
    const seed = random();
    pieces.push({
      x: 0,
      y: 0,
      depth: index % 2 ? 0.1 : -0.1,
      box: [-Math.min(...xs) + 40, Math.max(...xs) + 40, height + 20, 20],
      sway: 0,
      paint: (c) => paintLimb(c, curve, trunk.width, trunk.width * 0.3, BARK, seed, 0.12, 0.9),
    });

    // Branches up the top half of the trunk, leaving it to either side and at different depths; the lower ones
    // longer, the crown's top short. Most lean toward the open courtyard on the left.
    for (let t = 0.42; t < 0.97; t += 0.07 + random() * 0.05) {
      const pin = bezier(curve, t);
      const left = random() < 0.68;
      const angle = left ? Math.PI + 0.15 + random() * 0.5 : -0.2 - random() * 0.6;
      const length = tall * (0.36 - t * 0.18) * (left ? 1.15 : 0.7) * (0.8 + random() * 0.4);
      const depth = random() * 2 - 1;
      const shade = Math.max(0, (1 - depth) / 2) * 0.5;
      const branchSeed = random();
      const span = length + 40;
      pieces.push({
        x: pin.x,
        y: pin.y,
        depth,
        box: [left ? span : 40, left ? 40 : span, span * 0.8, span * 0.5],
        sway: 0.6 + t * 0.6,
        paint: (c) => paintBranch(c, branchSeed, angle, length, shade),
      });
    }
  });
  return pieces.sort((a, b) => a.depth - b.depth);
}
