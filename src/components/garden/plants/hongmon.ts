import type { Ctx, Plant } from './kit';

import { linear } from '../creatures/paint';
import { paintLeaf, stem, TAU } from './kit';

const LEAF = { light: '#6FA463', mid: '#2F6B3A', dark: '#1C4527' };
const SPATHE = { light: '#FF8A86', mid: '#D8222F', dark: '#7E0E19' };

// The red "flower" is a glossy heart-shaped spathe, with a cream spadix standing out of it
function paintSpathe(c: Ctx, x: number, y: number, size: number, turn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  // Heart, notch at the top where the stalk joins, point at the bottom
  const heart = new Path2D();
  heart.moveTo(0, -size * 0.35);
  heart.bezierCurveTo(-size * 0.25, -size * 0.75, -size * 1.05, -size * 0.6, -size * 0.85, 0.05 * size);
  heart.bezierCurveTo(-size * 0.7, size * 0.55, -size * 0.2, size * 0.8, 0, size * 1.05);
  heart.bezierCurveTo(size * 0.2, size * 0.8, size * 0.7, size * 0.55, size * 0.85, 0.05 * size);
  heart.bezierCurveTo(size * 1.05, -size * 0.6, size * 0.25, -size * 0.75, 0, -size * 0.35);
  c.fillStyle = linear(c, -size, -size, size, size, [
    [0, SPATHE.light],
    [0.45, SPATHE.mid],
    [1, SPATHE.dark],
  ]);
  c.fill(heart);
  // Quilted veins and a wet highlight: anthurium spathes look lacquered
  c.save();
  c.clip(heart);
  c.strokeStyle = 'rgba(120,10,20,.35)';
  c.lineWidth = 0.3;
  for (const bend of [-0.7, -0.35, 0.35, 0.7]) {
    c.beginPath();
    c.moveTo(0, -size * 0.3);
    c.quadraticCurveTo(size * bend, size * 0.1, size * bend * 0.4, size * 0.95);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,.45)';
  c.beginPath();
  c.ellipse(-size * 0.42, -size * 0.18, size * 0.22, size * 0.1, -0.6, 0, TAU);
  c.fill();
  c.restore();
  c.strokeStyle = 'rgba(90,5,15,.5)';
  c.lineWidth = 0.35;
  c.stroke(heart);
  // Spadix: a short curved cone, pale yellow with tiny bumps
  c.strokeStyle = linear(c, 0, -size * 0.2, size * 0.5, -size * 0.9, [
    [0, '#FFF3C4'],
    [1, '#E7C35A'],
  ]);
  c.lineWidth = size * 0.16;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, -size * 0.15);
  c.quadraticCurveTo(size * 0.15, -size * 0.7, size * 0.45, -size * 0.95);
  c.stroke();
  c.restore();
}

// Anthurium: dark glossy heart leaves on long stalks, and lacquered red spathes held above them
export const hongmon: Plant = {
  name: 'Anthurium',
  done: 'is in bloom',
  flowering: true,
  paint(c, stage, random) {
    const leaves = [];
    for (let index = 0; index < 8; index++) {
      const spread = (random() - 0.5) * 1.8;
      leaves.push({ spread, reach: 22 + random() * 14, size: 13 + random() * 4, depth: random() });
    }
    const blooms = Array.from({ length: 3 }, (_, index) => ({
      spread: (index - 1) * 0.55 + (random() - 0.5) * 0.3,
      reach: 40 + random() * 10,
      turn: (random() - 0.5) * 0.5,
    }));
    const grow = 0.55 + stage * 0.11;

    const visible = leaves.slice(0, [0, 3, 5, 7, 8][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      const reach = leaf.reach * grow;
      const endX = Math.sin(leaf.spread) * reach,
        endY = -Math.cos(leaf.spread) * reach * 0.9;
      stem(c, 0, 0, endX * 0.3, endY * 0.8, endX, endY, 1.1, '#3E6E35');
      // The blade hangs from the stalk tip, pointing out and a little down
      const out = endX >= 0 ? 0.55 + leaf.spread * 0.2 : Math.PI - 0.55 + leaf.spread * 0.2;
      paintLeaf(c, endX, endY, out, leaf.size * grow * 1.5, leaf.size * grow * 0.55, LEAF, 'heart', leaf.depth * 0.6);
    }

    for (const bloom of blooms.slice(0, [0, 0, 0, 1, 3][stage])) {
      const reach = bloom.reach * grow;
      const endX = Math.sin(bloom.spread) * reach * 0.8,
        endY = -Math.cos(bloom.spread) * reach;
      stem(c, 0, 0, endX * 0.2, endY * 0.7, endX, endY, 0.9, '#4E7A3A');
      paintSpathe(c, endX, endY + 7 * grow, 8.5 * grow, bloom.turn + bloom.spread * 0.3);
    }
  },
};
