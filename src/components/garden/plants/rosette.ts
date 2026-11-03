// Echeveria-style rosette shared by the succulents: fleshy leaves in a spiral (the golden angle, like the real
// plant), outer leaves long and nearly flat, inner ones short and standing up, seen a little from above.
// Every leaf is built in 3D and projected, so leaves overlap in the right order; each has a keel (one half lit,
// one in shade), a dark rim and a small shadow on what is under it, so neighbouring leaves stay apart.
import type { Ctx, Tone } from './kit';

import { linear } from '../creatures/paint';
import { TAU } from './kit';

export interface RosetteLook {
  tone: Tone;
  // Colour along the leaf margin (red-edged echeveria), drawn heavier toward the tip
  edge?: string;
  // Flush on the leaf tips
  blush?: string;
  // Powdery bloom over the leaf, lighter toward the tip
  bloom?: string;
}

type Point = [number, number];

// Seen from about 43° above: up goes up the screen, toward-us goes down it
const VIEW = { up: Math.cos(0.75), toward: Math.sin(0.75) };
const project = (x: number, y: number, z: number): Point => [x, -y * VIEW.up + z * VIEW.toward];

interface RosetteLeaf {
  around: number;
  length: number;
  width: number;
  rise: number;
  baseY: number;
  cup: number;
}

// Half-width of the leaf from base (0) to tip (1): narrow at the base, widest past the middle, short point
function halfWidth(u: number) {
  if (u < 0.72) return 0.32 + 0.68 * Math.sin((u / 0.72) * (Math.PI / 2));
  return Math.pow((1 - u) / 0.28, 0.75);
}

function leafPoint(leaf: RosetteLeaf, u: number, v: number): Point {
  const cosA = Math.cos(leaf.around),
    sinA = Math.sin(leaf.around);
  const reach = u * leaf.length;
  // Along the leaf: outward and up by its rise; across: sideways, the edges curling up into a cup
  const out = reach * Math.cos(leaf.rise),
    upward = reach * Math.sin(leaf.rise) + v * v * leaf.cup * leaf.width;
  const side = v * leaf.width * halfWidth(u);
  return project(cosA * out - sinA * side, leaf.baseY + upward, sinA * out + cosA * side);
}

function paintRosetteLeaf(c: Ctx, leaf: RosetteLeaf, look: RosetteLook) {
  const steps = 10;
  const half = (side: number) => {
    const points: Point[] = [];
    for (let index = 0; index <= steps; index++) points.push(leafPoint(leaf, index / steps, side));
    return points;
  };
  const left = half(-1),
    right = half(1);
  const midline: Point[] = [];
  for (let index = 0; index <= steps; index++) midline.push(leafPoint(leaf, index / steps, 0));
  const outline = new Path2D();
  [...left, ...right.slice().reverse()].forEach(([x, y], index) =>
    index ? outline.lineTo(x, y) : outline.moveTo(x, y),
  );
  outline.closePath();

  // Shadow on whatever sits under the leaf, down and to the right, away from the light
  c.save();
  c.translate(0.5, 0.9);
  c.fillStyle = 'rgba(20,40,30,.28)';
  c.fill(outline);
  c.restore();

  const [baseX, baseY] = midline[0],
    [tipX, tipY] = midline[steps];
  // Two halves either side of the keel; the one further left faces the light
  for (const side of [-1, 1]) {
    const edge = side < 0 ? left : right;
    const halfPath = new Path2D();
    [...midline, ...edge.slice().reverse()].forEach(([x, y], index) =>
      index ? halfPath.lineTo(x, y) : halfPath.moveTo(x, y),
    );
    halfPath.closePath();
    const lit = edge[Math.round(steps * 0.6)][0] < midline[Math.round(steps * 0.6)][0];
    c.fillStyle = linear(c, baseX, baseY, tipX, tipY, [
      [0, look.tone.dark],
      [0.4, look.tone.mid],
      [1, lit ? look.tone.light : look.tone.mid],
    ]);
    c.fill(halfPath);
    if (!lit) {
      c.fillStyle = 'rgba(20,45,40,.2)';
      c.fill(halfPath);
    }
  }
  if (look.bloom) {
    c.fillStyle = linear(c, baseX, baseY, tipX, tipY, [
      [0.3, 'rgba(255,255,255,0)'],
      [1, look.bloom],
    ]);
    c.fill(outline);
  }
  if (look.blush) {
    const tip = c.createRadialGradient(tipX, tipY, 0, tipX, tipY, leaf.length * 0.45);
    tip.addColorStop(0, look.blush);
    tip.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = tip;
    c.fill(outline);
  }

  // Keel: a soft light line down the middle of the upper half
  c.strokeStyle = 'rgba(255,255,255,.22)';
  c.lineWidth = 0.4;
  c.beginPath();
  midline.slice(2, steps).forEach(([x, y], index) => (index ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();

  // Rim: dark outline to part it from its neighbours, then the coloured margin on top
  c.strokeStyle = 'rgba(25,55,40,.5)';
  c.lineWidth = 0.45;
  c.stroke(outline);
  if (look.edge) {
    c.strokeStyle = linear(c, baseX, baseY, tipX, tipY, [
      [0, 'rgba(0,0,0,0)'],
      [0.35, look.edge],
      [1, look.edge],
    ]);
    c.lineWidth = 0.42;
    c.lineJoin = 'round';
    c.beginPath();
    [...left.slice(2), ...right.slice(2).reverse()].forEach(([x, y], index) =>
      index ? c.lineTo(x, y) : c.moveTo(x, y),
    );
    c.stroke();
  }
}

// count leaves from the outside in; size is the outer leaf length in plant pixels
export function paintRosette(c: Ctx, random: () => number, count: number, size: number, look: RosetteLook) {
  const turn = random() * TAU;
  const leaves: RosetteLeaf[] = [];
  for (let index = 0; index < count; index++) {
    const inward = count > 1 ? index / (count - 1) : 1;
    const length = size * (1 - 0.6 * inward) * (0.92 + random() * 0.16);
    leaves.push({
      around: turn + index * 2.39996,
      length,
      width: length * 0.4,
      rise: 0.22 + inward * 1.1,
      baseY: 1 + inward * 5,
      cup: 0.25 + inward * 0.35,
    });
  }
  // Painter's order: far leaves outer-first, near leaves inner-first, so near outer leaves end up on top
  leaves.sort(
    (a, b) => Math.sin(a.around) * a.length * Math.cos(a.rise) - Math.sin(b.around) * b.length * Math.cos(b.rise),
  );
  for (const leaf of leaves) paintRosetteLeaf(c, leaf, look);
}
