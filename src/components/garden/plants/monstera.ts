import type { Ctx, Plant, Tone } from './kit';

import { LIGHT, stem } from './kit';

const LEAF = { light: '#7DB86A', mid: '#3D7F45', dark: '#22502C' };
const YOUNG = { light: '#B7DB86', mid: '#6FAA52', dark: '#3E7535' };

// Monstera leaf along +x: a broad heart cut into lobes by deep slits from the edge toward the midrib.
// Each lobe is its own shape, so the gaps show whatever is behind the leaf.
function paintMonsteraLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  tone: Tone,
  slits: number,
  depth: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const width = length * 0.46;
  // Half-width of the outline at t (0 base .. 1 tip): heart lobes at the base, a rounded point at the tip
  // Heart-shaped base (already wide where the stalk joins), widest before the middle, rounded point at the tip
  const half = (t: number) => width * Math.pow(Math.sin(Math.PI * (0.14 + 0.86 * t)), 0.65);
  const midrib = (t: number) => length * t;
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;

  for (const side of [-1, 1]) {
    // Lobe boundaries along the leaf; slits lean toward the tip like the real leaf
    const cuts = [0];
    for (let index = 1; index <= slits; index++) cuts.push(index / (slits + 1));
    cuts.push(1);
    for (let index = 0; index < cuts.length - 1; index++) {
      const from = cuts[index],
        to = cuts[index + 1];
      const gap = slits ? 0.025 : 0;
      const a = index === 0 ? from : from + gap,
        b = index === cuts.length - 2 ? to : to - gap;
      // Slits reach about 70% of the way in; the inner part of the leaf stays whole
      const inner = 0.3;
      c.beginPath();
      c.moveTo(midrib(Math.max(0, a - 0.06)), 0);
      c.lineTo(midrib(a) + width * 0.05, side * half(a) * inner);
      for (let t = a; t <= b + 0.0001; t += (b - a) / 6) {
        // The outer edge sits a little toward the tip of the inner point: the slit slants forward
        const lean = length * 0.06;
        c.lineTo(midrib(t) + lean, side * half(t));
      }
      c.lineTo(midrib(b) + width * 0.05, side * half(b) * inner);
      c.lineTo(midrib(Math.min(1, b + 0.06)), 0);
      c.closePath();
      const lit = side < 0 === upperLit;
      const across = c.createLinearGradient(0, 0, 0, side * width);
      across.addColorStop(0, tone.mid);
      across.addColorStop(1, lit ? tone.light : tone.dark);
      c.fillStyle = across;
      c.fill();
      const base = c.createLinearGradient(0, 0, length, 0);
      base.addColorStop(0, 'rgba(12,40,22,.35)');
      base.addColorStop(0.5, 'rgba(12,40,22,0)');
      c.fillStyle = base;
      c.fill();
      if (depth > 0) {
        c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
        c.fill();
      }
      c.strokeStyle = 'rgba(225,245,170,.22)';
      c.lineWidth = 0.5;
      c.stroke();
      // Side vein down the middle of each lobe
      const mid = (a + b) / 2;
      c.strokeStyle = 'rgba(230,248,190,.3)';
      c.lineWidth = 0.4;
      c.beginPath();
      c.moveTo(midrib(mid - 0.05), 0);
      c.lineTo(midrib(mid) + length * 0.05, side * half(mid) * 0.9);
      c.stroke();
    }
  }
  c.strokeStyle = 'rgba(235,250,200,.55)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(length * 0.96, 0);
  c.stroke();
  c.restore();
}

// Monstera: straight stalks rising close together from the soil, each a different length so the leaves
// spread evenly; the blade folds sharply down where it meets the stalk, like an anthurium
export const monstera: Plant = {
  name: 'Monstera',
  done: 'has split leaves',
  paint(c, stage, random) {
    const order = [3, 0, 6, 1, 5, 2, 4];
    const leaves = order.map((slot) => {
      // Slot 0 leans far left .. 6 far right; middle stalks stand tallest
      const lean = (slot / 6 - 0.5) * 1.3 + (random() - 0.5) * 0.15;
      const side = lean === 0 ? 1 : Math.sign(lean);
      return {
        foot: (random() - 0.5) * 4,
        lean,
        length: 46 - Math.abs(lean) * 22 + (random() - 0.5) * 12,
        // How far the blade folds down past horizontal at the joint
        fold: 0.2 + random() * 0.55,
        side: Math.abs(lean) < 0.15 && random() < 0.5 ? -side : side,
        size: 22 + random() * 6,
        depth: random(),
      };
    });
    const grow = 0.5 + stage * 0.125;
    const slits = stage >= 3 ? 3 : 0;
    const visible = leaves.slice(0, [0, 3, 4, 6, 7][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const length = leaf.length * grow;
      const end = { x: leaf.foot + Math.sin(leaf.lean) * length, y: -Math.cos(leaf.lean) * length };
      // Stalk: straight and a little thicker at the base, where it wraps the others
      c.lineCap = 'round';
      c.strokeStyle = '#4F7F3A';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(leaf.foot * 0.5, 0);
      c.lineTo(end.x, end.y);
      c.stroke();
      c.strokeStyle = 'rgba(200,235,150,.35)';
      c.lineWidth = 0.5;
      c.beginPath();
      c.moveTo(leaf.foot * 0.5 - 0.4, 0);
      c.lineTo(end.x - 0.4, end.y);
      c.stroke();
      // Blade hangs out and down from the joint; ones facing us look shorter
      const angle = leaf.side > 0 ? leaf.fold : Math.PI - leaf.fold;
      const facing = 0.8 + Math.min(1, Math.abs(leaf.lean) * 2) * 0.2;
      paintMonsteraLeaf(c, end.x, end.y, angle, leaf.size * grow * facing, LEAF, slits, leaf.depth * 0.6);
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
