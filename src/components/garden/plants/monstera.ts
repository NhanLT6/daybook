import type { Ctx, Plant, Tone } from './kit';

import { LIGHT, stem } from './kit';

const LEAF = { light: '#7DB86A', mid: '#3D7F45', dark: '#22502C' };
const YOUNG = { light: '#B7DB86', mid: '#6FAA52', dark: '#3E7535' };

type Point = [number, number];

// One cubic Bézier, sampled
function cubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const points: Point[] = [];
  for (let index = 1; index <= steps; index++) {
    const t = index / steps,
      u = 1 - t;
    points.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return points;
}

// One half of the leaf's margin (positive y side), from the sinus by the stalk, back round the basal lobe,
// out to the widest part and on to the tip. Evenly spaced points, so cuts can be placed by share of the edge.
function marginHalf(L: number, W: number): Point[] {
  const raw: Point[] = [
    [0.02 * L, 0.1 * W],
    ...cubic([0.02 * L, 0.1 * W], [-0.1 * L, 0.2 * W], [-0.2 * L, 0.7 * W], [0.08 * L, 0.95 * W], 16),
    ...cubic([0.08 * L, 0.95 * W], [0.35 * L, 1.12 * W], [0.82 * L, 0.7 * W], [L, 0], 24),
  ];
  // Resample by arc length
  const lengths = [0];
  for (let index = 1; index < raw.length; index++)
    lengths.push(lengths[index - 1] + Math.hypot(raw[index][0] - raw[index - 1][0], raw[index][1] - raw[index - 1][1]));
  const total = lengths[lengths.length - 1];
  const points: Point[] = [];
  let cursor = 0;
  for (let index = 0; index <= 80; index++) {
    const want = (index / 80) * total;
    while (cursor < lengths.length - 2 && lengths[cursor + 1] < want) cursor++;
    const span = lengths[cursor + 1] - lengths[cursor] || 1;
    const f = (want - lengths[cursor]) / span;
    points.push([
      raw[cursor][0] + (raw[cursor + 1][0] - raw[cursor][0]) * f,
      raw[cursor][1] + (raw[cursor + 1][1] - raw[cursor][1]) * f,
    ]);
  }
  return points;
}

const at = (edge: Point[], t: number): Point => edge[Math.round(Math.min(1, Math.max(0, t)) * (edge.length - 1))];

// Monstera leaf along +x from the joint. The value of the plant is the leaf's form, so it is built the way the
// real leaf is: a heart cut from the edge almost to the midrib into broad curved fingers, each finger its own
// shape with its own light and vein, and (when mature) a row of oval windows near the midrib. The leaf folds
// a little along the midrib (the far half is foreshortened and darker) and the midrib arches, so it reads as a
// curved surface rather than a flat cut-out. Young leaves are whole hearts, the way they are on the plant.
function paintMonsteraLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  tone: Tone,
  cuts: number,
  windows: boolean,
  depth: number,
  squash = 1,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(squash, 1);
  const L = length,
    W = length * 0.5;
  const edge = marginHalf(L, W);
  // Which half faces the light, and which way is "down" on screen in the leaf's own frame
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  const down = Math.cos(angle) >= 0 ? 1 : -1;
  // Fold along the midrib plus an arch down toward the tip
  const shape =
    (side: number) =>
    (point: Point): Point => {
      const near = side < 0 === upperLit;
      const fold = near ? 1 : 0.78;
      const u = point[0] / L;
      return [point[0], side * point[1] * fold + down * 0.16 * L * u * u];
    };
  const strip = 0.11 * W;

  // Far half first, so the near half overlaps it along the midrib
  const halves = upperLit ? [1, -1] : [-1, 1];
  for (const side of halves) {
    const place = shape(side);
    const lit = side < 0 === upperLit;
    // Cut positions along the edge: the basal lobe stays whole, the last cut stops short of the tip
    const marks = Array.from({ length: cuts }, (_, index) => 0.27 + (index + 0.5) * (0.63 / cuts));
    const bounds = [0, ...marks, 1];
    for (let index = 0; index < bounds.length - 1; index++) {
      const from = bounds[index],
        to = bounds[index + 1];
      // The gap widens toward the edge, so a finger is broad at its end and narrow where it joins
      const gapOut = cuts ? 0.024 : 0;
      const tFrom = index === 0 ? from : from + gapOut,
        tTo = index === bounds.length - 2 ? to : to - gapOut;
      const outline: Point[] = [];
      // Inner end of a cut: on the strip beside the midrib, a little toward the base, so cuts lean to the tip
      // Near the base a cut runs almost square to the midrib, toward the tip it sweeps forward: a fan
      const innerX = (t: number) => {
        const [mx, my] = at(edge, t);
        return Math.max(0.03 * L, Math.min(0.92 * L, mx - my * (0.1 + 0.55 * t)));
      };
      const startInner: Point = index === 0 ? [0.02 * L, 0] : [innerX(from) + 0.004 * L, strip];
      const endInner: Point = index === bounds.length - 2 ? [L, 0] : [innerX(to) - 0.004 * L, strip];
      outline.push(startInner);
      // Up the cut to the edge, bowed so the finger curves
      const startEdge = at(edge, tFrom);
      if (index > 0)
        outline.push(
          ...cubic(
            startInner,
            [startInner[0] + 0.02 * L, (startInner[1] + startEdge[1]) * 0.55],
            [startEdge[0] - 0.03 * L, startEdge[1] * 0.85],
            startEdge,
            6,
          ),
        );
      for (let k = Math.round(tFrom * 80); k <= Math.round(tTo * 80); k++) outline.push(edge[k]);
      const endEdge = at(edge, tTo);
      if (index < bounds.length - 2)
        outline.push(
          ...cubic(
            endEdge,
            [endEdge[0] - 0.04 * L, endEdge[1] * 0.85],
            [endInner[0] + 0.01 * L, (endInner[1] + endEdge[1]) * 0.55],
            endInner,
            6,
          ),
        );
      outline.push(endInner);

      const finger = new Path2D();
      outline.map(place).forEach(([px, py], k) => (k ? finger.lineTo(px, py) : finger.moveTo(px, py)));
      finger.closePath();
      // A window near the midrib in every other finger of a mature leaf
      const middle = at(edge, (from + to) / 2);
      // Each finger lit on its own: bright toward its outer end on the lit half, deep at the cuts
      const [ix, iy] = place([(startInner[0] + endInner[0]) / 2, strip]);
      const [ox, oy] = place(middle);
      if (windows && cuts && index > 0 && index < bounds.length - 2 && index % 2 === 1) {
        // An oval window in the inner part of the finger, long along the finger
        const hx = ix + (ox - ix) * 0.3,
          hy = iy + (oy - iy) * 0.3;
        finger.ellipse(hx, hy, 0.085 * W, 0.04 * L, Math.atan2(oy - iy, ox - ix), 0, Math.PI * 2);
      }
      const light = c.createLinearGradient(ix, iy, ox, oy);
      light.addColorStop(0, tone.dark);
      light.addColorStop(0.45, tone.mid);
      light.addColorStop(1, lit ? tone.light : tone.mid);
      c.fillStyle = light;
      c.fill(finger, 'evenodd');
      if (!lit) {
        c.fillStyle = 'rgba(12,34,24,.22)';
        c.fill(finger, 'evenodd');
      }
      if (depth > 0) {
        c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
        c.fill(finger, 'evenodd');
      }
      // The finger's own vein out toward the edge, kept off the window
      c.save();
      c.clip(finger, 'evenodd');
      c.strokeStyle = 'rgba(225,245,185,.32)';
      c.lineWidth = 0.3;
      c.beginPath();
      c.moveTo(ix, iy);
      c.lineTo(ix + (ox - ix) * 0.92, iy + (oy - iy) * 0.92);
      c.stroke();
      c.restore();
      // Dark rim where the finger's edge turns away
      c.strokeStyle = 'rgba(15,45,25,.35)';
      c.lineWidth = 0.35;
      c.stroke(finger);
    }
  }

  // The blade stays whole along the midrib: a band joining the fingers, tapering to the tip
  const band = new Path2D();
  const bandAt = (u: number) => strip * 1.15 * Math.min(1, (1 - u) * 6);
  for (let u = 0.02; u <= 1.0001; u += 0.04) {
    const [px, py] = shape(-1)([u * L, bandAt(u)]);
    if (u === 0.02) band.moveTo(px, py);
    else band.lineTo(px, py);
  }
  for (let u = 1; u >= 0.02; u -= 0.04) {
    const [px, py] = shape(1)([u * L, bandAt(u)]);
    band.lineTo(px, py);
  }
  band.closePath();
  c.fillStyle = tone.mid;
  c.fill(band);
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill(band);
  }

  // Midrib: a raised pale rib along the arch
  const rib = shape(1);
  c.strokeStyle = 'rgba(205,232,160,.75)';
  c.lineWidth = 0.75;
  c.lineCap = 'round';
  c.beginPath();
  for (let u = 0; u <= 0.96; u += 0.06) {
    const [px, py] = rib([u * L, 0]);
    if (u === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.stroke();
  c.restore();
}

// Monstera: stalks rising close together from the soil, nearly straight with a gentle bow, each a different
// length so the leaves spread evenly. Leaves face every way, not only left and right: ones leaning toward us
// hang down and look short, ones leaning away tip back and sit in shade. The blade folds sharply at the joint.
export const monstera: Plant = {
  name: 'Monstera',
  done: 'has split leaves',
  paint(c, stage, random) {
    const order = [3, 0, 6, 1, 5, 2, 4];
    const leaves = order.map((slot) => {
      // Around the pot: slot 0 far left .. 6 far right, and a random lean toward (+) or away (-) from us
      const lean = (slot / 6 - 0.5) * 1.2 + (random() - 0.5) * 0.15;
      const toward = (random() - 0.5) * 2;
      return {
        foot: (random() - 0.5) * 4,
        lean,
        toward,
        length: 46 - Math.abs(lean) * 20 - Math.max(0, toward) * 8 + (random() - 0.5) * 10,
        bow: (random() - 0.5) * 0.12,
        fold: 0.2 + random() * 0.5,
        size: 24 + random() * 7,
      };
    });
    const grow = 0.5 + stage * 0.125;
    // Young leaves are whole hearts; the cuts come with size, and the windows only on mature leaves
    const cuts = [0, 0, 0, 3, 5][stage];
    const windows = stage === 4;
    // Back to front, so leaves leaning toward us cover the ones behind
    const visible = leaves.slice(0, [0, 3, 4, 6, 7][stage]).sort((a, b) => a.toward - b.toward);
    for (const leaf of visible) {
      const length = leaf.length * grow;
      const base = { x: leaf.foot * 0.5, y: leaf.toward * 0.8 };
      const end = { x: leaf.foot + Math.sin(leaf.lean) * length, y: -Math.cos(leaf.lean) * length };
      // A gentle bow: the control point sits a little off the straight line
      const bend = {
        x: (base.x + end.x) / 2 - end.y * leaf.bow,
        y: (base.y + end.y) / 2 + (end.x - base.x) * leaf.bow,
      };
      c.lineCap = 'round';
      c.strokeStyle = '#4F7F3A';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(base.x, base.y);
      c.quadraticCurveTo(bend.x, bend.y, end.x, end.y);
      c.stroke();
      c.strokeStyle = 'rgba(200,235,150,.35)';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(base.x - 0.4, base.y);
      c.quadraticCurveTo(bend.x - 0.4, bend.y, end.x - 0.4, end.y);
      c.stroke();
      // Blade direction: out to its side and down, swinging toward straight down when it leans at us
      // and up when it leans away; the more it points at or away from us, the shorter it looks
      const side = leaf.lean >= 0 ? 1 : -1;
      const out = side > 0 ? leaf.fold : Math.PI - leaf.fold;
      const angle = out + side * leaf.toward * 0.9;
      const squash = 1 - Math.abs(leaf.toward) * 0.4;
      const shade = Math.max(0, -leaf.toward) * 0.55;
      paintMonsteraLeaf(c, end.x, end.y, angle, leaf.size * grow, LEAF, cuts, windows, shade, squash);
    }
    if (stage === 4) {
      // A new leaf still rolled into a pale spike
      stem(c, 0, 0, 1, -18, 2, -30, 1.2, '#5F8F42');
      c.fillStyle = YOUNG.mid;
      c.beginPath();
      c.ellipse(2.6, -35, 1.8, 6, 0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.3)';
      c.beginPath();
      c.ellipse(2, -36, 0.6, 4.2, 0.1, 0, Math.PI * 2);
      c.fill();
    }
  },
};
