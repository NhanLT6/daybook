import type { Ctx, Plant } from './kit';

import { linear, radial } from '../creatures/paint';
import { paintLeaf, TAU } from './kit';

const LEAF = { light: '#93C46F', mid: '#4C8A3E', dark: '#2A5A2C' };
const BARK = ['#C9B49A', '#9C8468', '#6E5A45'];

// Desert-rose flower facing us: five rounded petals, rose at the rim fading to white at a pink-veined throat
function paintFlower(c: Ctx, x: number, y: number, size: number, turn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  for (let index = 0; index < 5; index++) {
    c.save();
    c.rotate((index / 5) * TAU);
    const petal = new Path2D();
    petal.moveTo(0, 0);
    petal.bezierCurveTo(-size * 0.55, -size * 0.25, -size * 0.6, -size * 0.95, 0.1 * size, -size);
    petal.bezierCurveTo(size * 0.55, -size * 0.95, size * 0.45, -size * 0.3, 0, 0);
    c.fillStyle = radial(c, 0, 0, 0, size, [
      [0, '#FFFFFF'],
      [0.35, '#FFE3EA'],
      [0.75, '#F2708F'],
      [1, '#D63A62'],
    ]);
    c.fill(petal);
    c.strokeStyle = 'rgba(170,30,70,.35)';
    c.lineWidth = 0.25;
    c.stroke(petal);
    c.restore();
  }
  // Throat: pink streaks running into a small dark centre
  c.strokeStyle = 'rgba(214,58,98,.55)';
  c.lineWidth = 0.25;
  for (let index = 0; index < 10; index++) {
    const angle = (index / 10) * TAU;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(angle) * size * 0.35, Math.sin(angle) * size * 0.35);
    c.stroke();
  }
  c.fillStyle = '#7A2A3F';
  c.beginPath();
  c.arc(0, 0, size * 0.1, 0, TAU);
  c.fill();
  c.restore();
}

// Fat bottle-shaped trunk (caudex), lit from the left, with a few bark creases
function paintCaudex(c: Ctx, width: number, height: number) {
  const trunk = new Path2D();
  trunk.moveTo(-width, 0);
  trunk.bezierCurveTo(-width * 1.25, -height * 0.45, -width * 0.55, -height * 0.8, -width * 0.32, -height);
  trunk.lineTo(width * 0.32, -height);
  trunk.bezierCurveTo(width * 0.55, -height * 0.8, width * 1.25, -height * 0.45, width, 0);
  trunk.closePath();
  c.fillStyle = linear(c, -width, 0, width, 0, [
    [0, BARK[0]],
    [0.5, BARK[1]],
    [1, BARK[2]],
  ]);
  c.fill(trunk);
  c.save();
  c.clip(trunk);
  c.strokeStyle = 'rgba(80,60,40,.3)';
  c.lineWidth = 0.4;
  for (const [x, y, r] of [
    [-width * 0.4, -height * 0.3, 2.4],
    [width * 0.3, -height * 0.55, 2],
    [-width * 0.1, -height * 0.75, 1.6],
  ]) {
    c.beginPath();
    c.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,245,225,.25)';
  c.beginPath();
  c.ellipse(-width * 0.55, -height * 0.4, width * 0.2, height * 0.3, 0.2, 0, TAU);
  c.fill();
  c.restore();
}

// Desert rose: a swollen woody trunk, thick branches tipped with glossy leaves and pink-and-white flowers
export const suthai: Plant = {
  name: 'Desert rose',
  done: 'is in bloom',
  flowering: true,
  paint(c, stage, random) {
    const branches = Array.from({ length: 3 }, (_, index) => ({
      angle: (index - 1) * 0.55 + (random() - 0.5) * 0.25,
      length: 26 + random() * 10,
      leaves: Array.from({ length: 7 }, () => ({
        angle: (random() - 0.5) * 2.4,
        size: 8 + random() * 3,
        depth: random(),
      })),
      flowers: Array.from({ length: 3 }, () => ({
        dx: (random() - 0.5) * 12,
        dy: -random() * 6,
        turn: random() * TAU,
      })),
    }));
    const grow = 0.5 + stage * 0.125;
    const caudexHeight = 16 * grow;
    paintCaudex(c, 11 * grow, caudexHeight);

    for (const branch of branches.slice(0, [0, 1, 2, 3, 3][stage])) {
      const baseY = -caudexHeight + 1;
      const tipX = Math.sin(branch.angle) * branch.length * grow,
        tipY = baseY - Math.cos(branch.angle) * branch.length * grow;
      // Thick, smooth branch that tapers toward the tip
      c.strokeStyle = linear(c, tipX - 3, 0, tipX + 3, 0, [
        [0, BARK[0]],
        [1, BARK[2]],
      ]);
      c.lineCap = 'round';
      for (const [width, t] of [
        [4.2 * grow, 0.55],
        [3 * grow, 1],
      ]) {
        c.lineWidth = width;
        c.beginPath();
        c.moveTo(branch.angle * 3, baseY);
        c.quadraticCurveTo(
          tipX * 0.3,
          baseY + (tipY - baseY) * 0.6,
          tipX * t + branch.angle * 3 * (1 - t),
          baseY + (tipY - baseY) * t,
        );
        c.stroke();
      }
      // Leaves cluster only at the branch tip, pointing up and out
      for (const leaf of branch.leaves.slice().sort((a, b) => b.depth - a.depth)) {
        paintLeaf(
          c,
          tipX,
          tipY,
          -Math.PI / 2 + leaf.angle,
          leaf.size * grow,
          2.6 * grow,
          LEAF,
          'plump',
          leaf.depth * 0.6,
        );
      }
      if (stage === 4) {
        for (const flower of branch.flowers) paintFlower(c, tipX + flower.dx, tipY - 3 + flower.dy, 4.6, flower.turn);
      }
    }
  },
};
