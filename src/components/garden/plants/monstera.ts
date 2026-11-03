import type { Ctx, Plant, Tone } from './kit';

import { LIGHT, stem } from './kit';

const LEAF = { light: '#7DB86A', mid: '#3D7F45', dark: '#22502C' };
const YOUNG = { light: '#B7DB86', mid: '#6FAA52', dark: '#3E7535' };

// Monstera leaf along +x from the joint: a smooth heart (the base lobes curl back past the joint) with a
// pointed tip. Slits are real holes (even-odd fill), so whatever is
// behind shows through. `squash` shortens it along the midrib for a leaf pointing at or away from us.
function paintMonsteraLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  tone: Tone,
  slits: number,
  depth: number,
  squash = 1,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(squash, 1);
  const L = length,
    W = length * 0.44;
  const outline = new Path2D();
  outline.moveTo(0, 0);
  outline.bezierCurveTo(-0.14 * L, -0.25 * W, -0.16 * L, -0.92 * W, 0.16 * L, -W);
  outline.bezierCurveTo(0.5 * L, -1.06 * W, 0.86 * L, -0.55 * W, L, 0);
  outline.bezierCurveTo(0.86 * L, 0.55 * W, 0.5 * L, 1.06 * W, 0.16 * L, W);
  outline.bezierCurveTo(-0.16 * L, 0.92 * W, -0.14 * L, 0.25 * W, 0, 0);
  outline.closePath();

  // Leaf body minus the holes: a big rectangle with the slit wedges cut out, clipped to the outline
  const body = new Path2D();
  body.rect(-L, -2 * W, 3 * L, 4 * W);
  for (const side of [-1, 1]) {
    for (let index = 0; index < slits; index++) {
      const u = 0.22 + (index + 0.5) * (0.62 / slits);
      // Each slit runs from the edge in toward the midrib, leaning toward the tip, widest at the edge
      body.moveTo(L * (u + 0.13), side * W * 1.3);
      body.quadraticCurveTo(L * (u + 0.06), side * W * 0.7, L * (u + 0.03), side * W * 0.4);
      body.lineTo(L * (u + 0.0), side * W * 0.38);
      body.quadraticCurveTo(L * (u + 0.02), side * W * 0.7, L * (u + 0.05), side * W * 1.3);
      body.closePath();
    }
  }
  c.clip(outline);
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  const across = c.createLinearGradient(0, -W, 0, W);
  across.addColorStop(0, upperLit ? tone.light : tone.dark);
  across.addColorStop(0.5, tone.mid);
  across.addColorStop(1, upperLit ? tone.dark : tone.light);
  c.fillStyle = across;
  c.fill(body, 'evenodd');
  // Darker where it meets the stalk, and in shade when it leans away from us
  const base = c.createRadialGradient(0, 0, 0, 0, 0, L * 0.6);
  base.addColorStop(0, 'rgba(12,40,22,.35)');
  base.addColorStop(1, 'rgba(12,40,22,0)');
  c.fillStyle = base;
  c.fill(body, 'evenodd');
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill(body, 'evenodd');
  }
  // Side veins fanning toward the edge between the slits, then the midrib
  c.strokeStyle = 'rgba(230,248,190,.28)';
  c.lineWidth = 0.35;
  for (const side of [-1, 1]) {
    for (let index = 0; index <= slits; index++) {
      const u = 0.16 + index * (0.66 / Math.max(1, slits));
      c.beginPath();
      c.moveTo(L * u, 0);
      c.quadraticCurveTo(L * (u + 0.05), side * W * 0.5, L * (u + 0.1), side * W * 0.9);
      c.stroke();
    }
  }
  c.strokeStyle = 'rgba(235,250,200,.55)';
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(L * 0.5, -W * 0.04, L * 0.96, 0);
  c.stroke();
  // Glossy sheen on the lit half
  c.fillStyle = 'rgba(255,255,255,.12)';
  c.beginPath();
  c.ellipse(L * 0.45, (upperLit ? -1 : 1) * W * 0.45, L * 0.22, W * 0.18, 0, 0, Math.PI * 2);
  c.fill();
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
        size: 22 + random() * 6,
      };
    });
    const grow = 0.5 + stage * 0.125;
    const slits = stage >= 3 ? 3 : 0;
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
      paintMonsteraLeaf(c, end.x, end.y, angle, leaf.size * grow, LEAF, slits, shade, squash);
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
