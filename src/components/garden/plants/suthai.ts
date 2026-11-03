import type { Ctx, Plant } from './kit';

import { linear, radial } from '../creatures/paint';
import { paintLeaf, TAU } from './kit';
import { paintLimb, seeded } from './wood';

const LEAF = { light: '#93C46F', mid: '#4C8A3E', dark: '#2A5A2C' };
const SKIN = ['#D6C4A8', '#A8907A', '#73604D'];
const BARK = { dark: '#7A6551', mid: '#A48C74', light: '#CDB89C', crack: '#5A4636', rough: 0.15 };

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

// Fat bottle-shaped trunk (caudex) with root flares at the soil, lit from the upper left. The skin is smooth
// but folded: soft horizontal creases that follow the swelling, a few pale lenticels and a glossy sheen.
function paintCaudex(c: Ctx, width: number, height: number) {
  const random = seeded(0.58);
  const trunk = new Path2D();
  trunk.moveTo(-width * 1.25, 1);
  // Left root flare, then up the swollen side to the neck
  trunk.quadraticCurveTo(-width * 1.05, -height * 0.05, -width * 1.08, -height * 0.25);
  trunk.bezierCurveTo(-width * 1.2, -height * 0.55, -width * 0.6, -height * 0.82, -width * 0.34, -height);
  trunk.lineTo(width * 0.3, -height);
  trunk.bezierCurveTo(width * 0.62, -height * 0.8, width * 1.15, -height * 0.5, width * 1.02, -height * 0.22);
  trunk.quadraticCurveTo(width * 1.0, -height * 0.04, width * 1.3, 1);
  // A third flare toward the front
  trunk.quadraticCurveTo(width * 0.4, -height * 0.02, width * 0.15, 1.5);
  trunk.quadraticCurveTo(-width * 0.3, -height * 0.02, -width * 1.25, 1);
  trunk.closePath();
  c.fillStyle = radial(c, -width * 0.35, -height * 0.55, width * 0.1, width * 1.5, [
    [0, SKIN[0]],
    [0.55, SKIN[1]],
    [1, SKIN[2]],
  ]);
  c.fill(trunk);

  c.save();
  c.clip(trunk);
  // Darker toward the soil and under the neck
  c.fillStyle = linear(c, 0, -height, 0, 2, [
    [0, 'rgba(70,52,38,.3)'],
    [0.2, 'rgba(70,52,38,0)'],
    [0.75, 'rgba(70,52,38,0)'],
    [1, 'rgba(70,52,38,.4)'],
  ]);
  c.fill(trunk);
  // Folds: each a dark crease with a lit lip just above it, bowed down like rings around a ball
  c.lineCap = 'round';
  for (let index = 0; index < 11; index++) {
    const y = -height * (0.1 + random() * 0.8);
    const span = width * (0.25 + random() * 0.45);
    const x = (random() - 0.55) * width * 1.2;
    const sag = span * 0.25;
    c.strokeStyle = 'rgba(85,62,44,.45)';
    c.lineWidth = 0.35;
    c.beginPath();
    c.moveTo(x - span / 2, y);
    c.quadraticCurveTo(x, y + sag, x + span / 2, y);
    c.stroke();
    c.strokeStyle = 'rgba(255,246,228,.35)';
    c.lineWidth = 0.3;
    c.beginPath();
    c.moveTo(x - span / 2.4, y - 0.5);
    c.quadraticCurveTo(x, y + sag - 0.5, x + span / 2.4, y - 0.5);
    c.stroke();
  }
  // Faint vertical streaks where the skin stretched as the trunk swelled
  c.strokeStyle = 'rgba(95,72,54,.18)';
  c.lineWidth = 0.3;
  for (let index = 0; index < 6; index++) {
    const x = (random() - 0.5) * width * 1.6;
    c.beginPath();
    c.moveTo(x, -height * (0.15 + random() * 0.2));
    c.quadraticCurveTo(x * 1.1, -height * 0.5, x * 0.6, -height * (0.7 + random() * 0.25));
    c.stroke();
  }
  // Lenticels
  c.fillStyle = 'rgba(245,236,215,.6)';
  for (let index = 0; index < 12; index++) {
    c.beginPath();
    c.ellipse((random() - 0.5) * width * 1.7, -height * random() * 0.9, 0.45, 0.2, 0, 0, TAU);
    c.fill();
  }
  // Soft sheen on the lit shoulder
  c.fillStyle = 'rgba(255,248,232,.28)';
  c.beginPath();
  c.ellipse(-width * 0.5, -height * 0.45, width * 0.18, height * 0.28, 0.25, 0, TAU);
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

    branches.slice(0, [0, 1, 2, 3, 3][stage]).forEach((branch, index) => {
      const baseY = -caudexHeight + 1;
      const tipX = Math.sin(branch.angle) * branch.length * grow,
        tipY = baseY - Math.cos(branch.angle) * branch.length * grow;
      // Thick, smooth branch that tapers toward the tip, bending a little outward
      paintLimb(
        c,
        [
          { x: branch.angle * 3, y: baseY + 1 },
          { x: branch.angle * 4, y: baseY + (tipY - baseY) * 0.35 },
          { x: tipX * 0.7, y: baseY + (tipY - baseY) * 0.7 },
          { x: tipX, y: tipY },
        ],
        5 * grow,
        2.4 * grow,
        BARK,
        0.2 + index * 0.3,
        0.06,
      );
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
    });
  },
};
