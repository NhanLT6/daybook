// Things that stand out in the open courtyard: a Japanese maple, a stone lantern, a bamboo clump, moss, and a low
// wooden bench for potted plants. Drawn in room units with (0, 0) on the gravel under each piece's centre, lit
// from the upper right like the courtyard itself.
import type { Ctx } from '../creatures/kit';
import type { Curve } from '../plants/wood';

import { TAU } from '../creatures/kit';
import { paintLimb, seeded } from '../plants/wood';
import { woodGrain } from './materials';

const BARK = { dark: '#3E3128', mid: '#5E4C3E', light: '#8A7462', crack: '#2A2018', rough: 0.6 };

// One small five-pointed maple leaf
function mapleLeaf(c: Ctx, x: number, y: number, size: number, turn: number, color: string) {
  c.save();
  c.translate(x, y);
  c.rotate(turn);
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * TAU - Math.PI / 2;
    const radius = i % 2 ? size * 0.42 : size;
    c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  c.closePath();
  c.fill();
  c.restore();
}

// Japanese maple: a slim trunk that leans and forks, its foliage in flat, layered clouds of small red leaves,
// lighter on the side facing the light
export function paintMaple(c: Ctx, height: number, autumn = true) {
  const random = seeded(0.37);
  const trunk: Curve = [
    { x: 0, y: 0 },
    { x: 14, y: -height * 0.25 },
    { x: -18, y: -height * 0.45 },
    { x: -6, y: -height * 0.62 },
  ];
  paintLimb(c, trunk, 16, 7, BARK, 0.21, 0.08, 0.5);
  const branches: Curve[] = [
    [trunk[3], { x: 30, y: -height * 0.66 }, { x: 70, y: -height * 0.7 }, { x: 110, y: -height * 0.68 }],
    [trunk[3], { x: -30, y: -height * 0.7 }, { x: -70, y: -height * 0.74 }, { x: -100, y: -height * 0.72 }],
    [trunk[3], { x: 0, y: -height * 0.75 }, { x: 10, y: -height * 0.85 }, { x: 4, y: -height * 0.95 }],
    [
      { x: -8, y: -height * 0.42 },
      { x: 20, y: -height * 0.46 },
      { x: 50, y: -height * 0.47 },
      { x: 80, y: -height * 0.45 },
    ],
  ];
  branches.forEach((branch, index) => paintLimb(c, branch, 6, 2.2, BARK, 0.3 + index * 0.13, 0.05, 0.4));

  // Leaf clouds at the branch tips: flat domes, back leaves darker, front lit leaves warmer
  const tones = autumn ? ['#8E2A1E', '#B23A22', '#D2522B', '#E9824A'] : ['#3F6B2E', '#5A8A3A', '#7BA84A', '#A6C86A'];
  const clouds = [
    { x: 110, y: -height * 0.7, w: 90, h: 34 },
    { x: -100, y: -height * 0.74, w: 80, h: 30 },
    { x: 4, y: -height * 0.97, w: 95, h: 38 },
    { x: 80, y: -height * 0.47, w: 70, h: 26 },
    { x: 30, y: -height * 0.82, w: 70, h: 26 },
  ];
  for (const cloud of clouds) {
    for (let i = 0; i < 160; i++) {
      const angle = random() * TAU,
        reach = Math.sqrt(random());
      const x = cloud.x + Math.cos(angle) * cloud.w * reach,
        y = cloud.y + Math.sin(angle) * cloud.h * reach * (Math.sin(angle) > 0 ? 0.5 : 1);
      // Lit toward the upper right
      const lit = (x - cloud.x) / cloud.w - (y - cloud.y) / cloud.h;
      const tone = tones[Math.max(0, Math.min(3, Math.round(1.4 + lit * 1.1 + (random() - 0.5))))];
      mapleLeaf(c, x, y, 5 + random() * 3, random() * TAU, tone);
    }
  }
}

// Kasuga-style stone lantern: base, pillar, a firebox with an open window, a wide curved roof and a finial
export function paintLantern(c: Ctx, glow: number) {
  const stone = (x: number, w: number) => {
    const g = c.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#7E7B74');
    g.addColorStop(0.6, '#A6A299');
    g.addColorStop(1, '#C3BFB5');
    return g;
  };
  c.fillStyle = stone(-30, 60);
  c.beginPath();
  c.roundRect(-30, -16, 60, 16, 3);
  c.fill();
  c.fillStyle = stone(-12, 24);
  c.fillRect(-12, -78, 24, 62);
  c.fillStyle = stone(-26, 52);
  c.beginPath();
  c.roundRect(-26, -90, 52, 12, 2);
  c.fill();
  // Firebox
  c.fillStyle = stone(-20, 40);
  c.fillRect(-20, -128, 40, 38);
  c.fillStyle = glow > 0 ? `rgba(255,${190 + glow * 30},120,${0.5 + glow * 0.5})` : '#3B3833';
  c.fillRect(-9, -120, 18, 22);
  if (glow > 0) {
    const halo = c.createRadialGradient(0, -109, 0, 0, -109, 60);
    halo.addColorStop(0, `rgba(255,200,120,${0.45 * glow})`);
    halo.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = halo;
    c.fillRect(-60, -170, 120, 120);
  }
  // Roof: wide, low, its corners curling up
  c.fillStyle = stone(-44, 88);
  c.beginPath();
  c.moveTo(-44, -126);
  c.quadraticCurveTo(-20, -134, 0, -152);
  c.quadraticCurveTo(20, -134, 44, -126);
  c.quadraticCurveTo(46, -132, 40, -134);
  c.lineTo(-40, -134);
  c.quadraticCurveTo(-46, -132, -44, -126);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(0, -158, 7, 0, TAU);
  c.fill();
  // Moss on the roof's top
  c.fillStyle = 'rgba(96,130,70,.55)';
  c.beginPath();
  c.ellipse(-6, -140, 16, 4, -0.3, 0, TAU);
  c.fill();
}

// A clump of bamboo: tall culms with darker nodes, narrow leaves in sprays near the top
export function paintBamboo(c: Ctx, height: number) {
  const random = seeded(0.61);
  const culms = [-26, -8, 10, 24, 38];
  culms.forEach((x, index) => {
    const top = -height * (0.8 + random() * 0.2);
    const lean = (random() - 0.4) * 30;
    const g = c.createLinearGradient(x - 4, 0, x + 4, 0);
    g.addColorStop(0, '#5E7A3A');
    g.addColorStop(0.7, '#9AB65E');
    g.addColorStop(1, '#C3D488');
    c.strokeStyle = g;
    c.lineWidth = 7 - index * 0.5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, 0);
    c.quadraticCurveTo(x + lean * 0.3, top * 0.5, x + lean, top);
    c.stroke();
    // Nodes
    c.strokeStyle = 'rgba(60,80,40,.7)';
    c.lineWidth = 1.4;
    for (let t = 0.12; t < 1; t += 0.11) {
      const nx = x + lean * t * t,
        ny = top * t;
      c.beginPath();
      c.moveTo(nx - 4, ny);
      c.lineTo(nx + 4, ny);
      c.stroke();
    }
    // Leaf sprays
    for (let i = 0; i < 26; i++) {
      const t = 0.45 + random() * 0.55;
      const lx = x + lean * t * t,
        ly = top * t;
      const angle = (random() < 0.5 ? -1 : 1) * (0.4 + random() * 0.9) + Math.PI / 2;
      c.save();
      c.translate(lx, ly);
      c.rotate(angle);
      c.fillStyle = random() < 0.5 ? '#5F8A3C' : '#86AE52';
      c.beginPath();
      c.ellipse(16, 0, 16, 2.6, 0, 0, TAU);
      c.fill();
      c.restore();
    }
  });
}

// A soft patch of moss on the gravel
export function paintMoss(c: Ctx, w: number, h: number, seed: number) {
  const random = seeded(seed);
  for (let i = 0; i < 70; i++) {
    const angle = random() * TAU,
      reach = Math.sqrt(random());
    c.fillStyle = ['#5E7F3E', '#76994A', '#8FB05A'][Math.floor(random() * 3)];
    c.globalAlpha = 0.75;
    c.beginPath();
    c.ellipse(Math.cos(angle) * w * reach, Math.sin(angle) * h * reach, 6, 3, 0, 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

export const BENCH = { width: 300, height: 60 };

// A low cedar bench on two block legs, the kind bonsai stand on outdoors
export function paintBench(c: Ctx) {
  const { width, height } = BENCH;
  const slab = 14;
  c.fillStyle = '#6E5440';
  for (const x of [-width * 0.36, width * 0.36]) c.fillRect(x - 14, -height + slab, 28, height - slab);
  const top = c.createLinearGradient(0, -height, 0, -height + slab);
  top.addColorStop(0, '#C9A57E');
  top.addColorStop(1, '#8E6C4E');
  c.fillStyle = top;
  c.fillRect(-width / 2, -height, width, slab);
  woodGrain(c, -width / 2, -height, width, slab, 0.44, { density: 3, knots: false });
}
