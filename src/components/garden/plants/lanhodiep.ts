import type { Ctx, Plant } from './kit';

import { linear, radial } from '../creatures/paint';
import { paintLeaf, TAU } from './kit';

// Thick, glossy orchid leaf: darker than most, a little purple underneath
const ORCHID_LEAF = { light: '#7FB06A', mid: '#3F7A45', dark: '#24502E' };

// One moth-orchid bloom facing the viewer, about `size` across: three sepals behind two broad petals and a lip
function paintBloom(c: Ctx, x: number, y: number, size: number, tilt: number) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  const petal = (cx: number, cy: number, rx: number, ry: number, angle: number) => {
    c.save();
    c.translate(cx, cy);
    c.rotate(angle);
    c.fillStyle = radial(
      c,
      0,
      0,
      0.2,
      Math.max(rx, ry),
      [
        [0, '#FFFFFF'],
        [0.6, '#FBEFF5'],
        [1, '#E8C4D6'],
      ],
      -rx * 0.3,
      -ry * 0.3,
    );
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, TAU);
    c.fill();
    // Faint pink veins fanning from the centre
    c.strokeStyle = 'rgba(205,120,160,.28)';
    c.lineWidth = 0.18;
    for (const spread of [-0.5, 0, 0.5]) {
      c.beginPath();
      c.moveTo(-rx * 0.8 * Math.cos(spread), 0);
      c.quadraticCurveTo(0, ry * spread * 0.6, rx * 0.8, ry * spread);
      c.stroke();
    }
    c.strokeStyle = 'rgba(190,150,170,.45)';
    c.lineWidth = 0.2;
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, TAU);
    c.stroke();
    c.restore();
  };
  const s = size / 10;
  // Sepals: one up, two down and out
  petal(0, -3.2 * s, 1.5 * s, 3 * s, 0);
  petal(-2.4 * s, 2.4 * s, 1.3 * s, 2.8 * s, 0.75);
  petal(2.4 * s, 2.4 * s, 1.3 * s, 2.8 * s, -0.75);
  // Petals: broad and round, left and right
  petal(-3.1 * s, -0.4 * s, 3.2 * s, 2.9 * s, -0.25);
  petal(3.1 * s, -0.4 * s, 3.2 * s, 2.9 * s, 0.25);
  // Lip: magenta with a yellow throat and two little side lobes
  c.fillStyle = linear(c, 0, 0, 0, 3.6 * s, [
    [0, '#C2306E'],
    [1, '#E2618F'],
  ]);
  c.beginPath();
  c.moveTo(-1.3 * s, 0.4 * s);
  c.quadraticCurveTo(-1.8 * s, 2.6 * s, 0, 3.6 * s);
  c.quadraticCurveTo(1.8 * s, 2.6 * s, 1.3 * s, 0.4 * s);
  c.closePath();
  c.fill();
  c.fillStyle = '#B2275F';
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(side * 1.5 * s, 0.5 * s, 0.7 * s, 1 * s, side * 0.5, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#F3C548';
  c.beginPath();
  c.ellipse(0, 0.7 * s, 0.75 * s, 0.6 * s, 0, 0, TAU);
  c.fill();
  // Column: the small pale knob at the heart
  c.fillStyle = '#FFF6E8';
  c.beginPath();
  c.ellipse(0, -0.3 * s, 0.55 * s, 0.75 * s, 0, 0, TAU);
  c.fill();
  c.restore();
}

function paintBud(c: Ctx, x: number, y: number, size: number) {
  c.fillStyle = radial(
    c,
    x,
    y,
    0.1,
    size,
    [
      [0, '#F4F8E6'],
      [1, '#B9CC8C'],
    ],
    -size * 0.3,
    -size * 0.3,
  );
  c.beginPath();
  c.ellipse(x, y, size * 0.8, size, 0.3, 0, TAU);
  c.fill();
}

// Moth orchid: broad leaves low in the pot, silver air roots, and one arching spike of white blooms
export const lanhodiep: Plant = {
  name: 'Moth orchid',
  done: 'is in bloom',
  flowering: true,
  paint(c, stage, random) {
    const leaves = [];
    for (let index = 0; index < 6; index++) {
      const side = index % 2 ? 1 : -1;
      leaves.push({
        angle: side > 0 ? -0.25 - random() * 0.35 : Math.PI + 0.25 + random() * 0.35,
        length: 20 + random() * 6,
        depth: random(),
      });
    }
    const roots = Array.from({ length: 3 }, () => ({ x: (random() - 0.5) * 16, bend: random() }));
    const arc = (random() > 0.5 ? 1 : -1) * (0.8 + random() * 0.3);
    const grow = 0.6 + stage * 0.1;

    // Air roots curl over the rim, grey-green with pale tips
    if (stage >= 2) {
      for (const root of roots) {
        c.strokeStyle = '#B9C2AE';
        c.lineWidth = 1.5;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(root.x * 0.4, -2);
        c.bezierCurveTo(root.x, -8 - root.bend * 4, root.x * 1.6, -4, root.x * 1.5 + Math.sign(root.x) * 3, 3);
        c.stroke();
        c.fillStyle = '#9BCB8A';
        c.beginPath();
        c.arc(root.x * 1.5 + Math.sign(root.x) * 3, 3, 0.8, 0, TAU);
        c.fill();
      }
    }

    // Flower spike: rises from the base, then arches over to one side
    if (stage >= 3) {
      const top = { x: arc * 8, y: -56 };
      const tip = { x: arc * 34, y: -44 };
      c.strokeStyle = '#6C7A3E';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(0, -3);
      c.quadraticCurveTo(arc * 2, -40, top.x, top.y);
      c.quadraticCurveTo(arc * 22, -62, tip.x, tip.y);
      c.stroke();
      // Thin bamboo stake holding the spike, as growers do
      c.strokeStyle = '#C9A877';
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(arc * -1, 2);
      c.lineTo(arc * 5, -46);
      c.stroke();
      const along = (t: number) => {
        const u = 1 - t;
        return {
          x: u * u * top.x + 2 * u * t * arc * 22 + t * t * tip.x,
          y: u * u * top.y + 2 * u * t * -62 + t * t * tip.y,
        };
      };
      const open = stage === 4 ? 4 : 0;
      for (let index = 5; index >= 0; index--) {
        const p = along(index / 5.2);
        if (index < open) paintBloom(c, p.x, p.y + 6, 15 - index * 1.1, arc * 0.12 * index);
        else paintBud(c, p.x, p.y + 1.5, 2.2 - (index - open) * 0.25);
      }
    }

    // Leaves last, so they sit in front of the spike base and the roots
    const visible = leaves.slice(0, [0, 2, 3, 5, 6][stage]).sort((a, b) => b.depth - a.depth);
    for (const leaf of visible) {
      paintLeaf(c, 0, -2, leaf.angle, leaf.length * grow, 6.5 * grow, ORCHID_LEAF, 'plump', leaf.depth * 0.6);
    }
  },
};
