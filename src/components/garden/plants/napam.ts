import type { Ctx, Plant } from './kit';

import { linear } from '../creatures/paint';
import { facing, paintLeaf, TAU } from './kit';

interface PitcherLook {
  // Body colour from the bulb up to the mouth
  low: string;
  high: string;
  mottle: string;
  // Ribbed lip: bright top, deep shadow between the ribs
  lip: [string, string];
}

// Two colour forms, the way one plant often shows both: a red-flushed pitcher and a greener one
const LOOKS: PitcherLook[] = [
  { low: '#9CC25A', high: '#B8452F', mottle: 'rgba(125,20,24,.55)', lip: ['#EE6A55', '#8E1A20'] },
  { low: '#B9D56E', high: '#8DB04B', mottle: 'rgba(150,40,30,.5)', lip: ['#E14B3E', '#7E161B'] },
];

// Half-width of the pitcher (as a share of its width) from the base (t = 0) to the mouth (t = 1):
// a round bulb, a narrow hip, then a slightly flared upper tube
const PROFILE: [number, number][] = [
  [0, 0.36],
  [0.07, 0.5],
  [0.2, 0.53],
  [0.38, 0.46],
  [0.55, 0.33],
  [0.72, 0.32],
  [0.9, 0.36],
  [1, 0.4],
];

function bodyPath(height: number, width: number) {
  const path = new Path2D();
  const point = ([t, half]: [number, number], side: number): [number, number] => [side * half * width, -t * height];
  const smooth = (side: number, points: [number, number][]) => {
    for (let index = 1; index < points.length; index++) {
      const [x0, y0] = point(points[index - 1], side),
        [x1, y1] = point(points[index], side);
      path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    const [lastX, lastY] = point(points[points.length - 1], side);
    path.lineTo(lastX, lastY);
  };
  // Round bottom: the base bulges a little below t = 0
  path.moveTo(0, height * 0.05);
  path.bezierCurveTo(
    -PROFILE[0][1] * width * 0.7,
    height * 0.05,
    -PROFILE[0][1] * width,
    height * 0.03,
    -PROFILE[0][1] * width,
    0,
  );
  smooth(-1, PROFILE);
  // Across the mouth, then back down the right side
  const reversed = PROFILE.slice().reverse();
  const [rightX, rightY] = point(reversed[0], 1);
  path.lineTo(rightX, rightY);
  smooth(1, reversed);
  path.bezierCurveTo(
    PROFILE[0][1] * width,
    height * 0.03,
    PROFILE[0][1] * width * 0.7,
    height * 0.05,
    0,
    height * 0.05,
  );
  path.closePath();
  return path;
}

// Speckles used on the body and the lid; positions come from the plant's random so they never shimmer
function speckle(
  c: Ctx,
  random: () => number,
  area: { x: number; y: number; w: number; h: number },
  count: number,
  color: string,
  size: number,
) {
  c.fillStyle = color;
  for (let index = 0; index < count; index++) {
    // Denser toward the top of the area, like the blotches on real upper pitchers
    const v = Math.pow(random(), 0.7);
    c.beginPath();
    c.ellipse(
      area.x + random() * area.w,
      area.y + (1 - v) * area.h,
      size * (0.4 + random() * 0.8),
      size * (0.3 + random() * 0.5),
      random() * TAU,
      0,
      TAU,
    );
    c.fill();
  }
}

// The lid stands up off the back of the mouth, tipped back, with a small spur where it joins
function lid(c: Ctx, height: number, width: number, look: PitcherLook, random: () => number) {
  const baseY = -height - width * 0.12;
  c.save();
  c.translate(width * 0.08, baseY);
  c.rotate(0.5);
  const w = width * 0.62,
    h = width * 0.48;
  const shape = new Path2D();
  shape.moveTo(-w * 0.45, 0);
  shape.bezierCurveTo(-w * 0.6, -h * 0.6, -w * 0.2, -h * 1.05, 0, -h);
  shape.bezierCurveTo(w * 0.2, -h * 1.05, w * 0.6, -h * 0.6, w * 0.45, 0);
  shape.closePath();
  c.fillStyle = linear(c, -w * 0.5, 0, w * 0.5, 0, [
    [0, look.low],
    [0.35, look.high],
    [1, '#5E2018'],
  ]);
  c.fill(shape);
  c.save();
  c.clip(shape);
  speckle(c, random, { x: -w * 0.5, y: -h, w, h }, 8, look.mottle, width * 0.05);
  c.restore();
  c.strokeStyle = 'rgba(70,20,15,.35)';
  c.lineWidth = 0.5;
  c.stroke(shape);
  // Spur: a little hook pointing back from the lid's foot
  c.strokeStyle = '#6E3A22';
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(w * 0.35, -1);
  c.quadraticCurveTo(w * 0.6, -2, w * 0.68, -4.5);
  c.stroke();
  c.restore();
}

// Ribbed lip around the opening. The far half paints with the dark mouth, the near half over the body.
function lip(c: Ctx, height: number, width: number, look: PitcherLook, half: 'back' | 'front') {
  const rx = width * 0.44,
    ry = width * 0.17,
    y = -height;
  const start = half === 'back' ? Math.PI : 0,
    end = half === 'back' ? TAU : Math.PI;
  c.lineCap = 'butt';
  c.strokeStyle = linear(c, -rx, 0, rx, 0, [
    [0, look.lip[0]],
    [0.6, look.lip[1]],
    [1, '#5A0F12'],
  ]);
  c.lineWidth = width * 0.13;
  c.beginPath();
  c.ellipse(0, y, rx, ry, 0, start, end);
  c.stroke();
  // Fine ribs across the lip
  c.strokeStyle = 'rgba(70,8,12,.55)';
  c.lineWidth = 0.35;
  for (let index = 0; index < 22; index++) {
    const angle = start + ((index + 0.5) / 22) * Math.PI;
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    c.beginPath();
    c.moveTo(cos * (rx - width * 0.065), y + sin * (ry - width * 0.05));
    c.lineTo(cos * (rx + width * 0.065), y + sin * (ry + width * 0.05));
    c.stroke();
  }
  if (half === 'front') {
    // Wet shine along the top of the lip
    c.strokeStyle = 'rgba(255,220,210,.55)';
    c.lineWidth = 0.5;
    c.beginPath();
    c.ellipse(0, y - width * 0.03, rx * 0.95, ry * 0.9, 0, Math.PI * 0.2, Math.PI * 0.65);
    c.stroke();
  }
}

// A whole pitcher standing on its base at (0, 0), mouth up
function pitcher(c: Ctx, height: number, look: PitcherLook, depth: number, random: () => number) {
  const width = height * 0.56;
  lid(c, height, width, look, random);
  // Inside the mouth, dark and wet
  c.fillStyle = linear(c, 0, -height - width * 0.17, 0, -height + width * 0.17, [
    [0, '#1E0A0A'],
    [1, '#4A1A16'],
  ]);
  c.beginPath();
  c.ellipse(0, -height, width * 0.44, width * 0.17, 0, 0, TAU);
  c.fill();
  lip(c, height, width, look, 'back');

  const body = bodyPath(height, width);
  c.fillStyle = linear(c, 0, 0, 0, -height, [
    [0, look.low],
    [0.35, look.low],
    [0.75, look.high],
    [1, look.high],
  ]);
  c.fill(body);
  c.save();
  c.clip(body);
  speckle(c, random, { x: -width * 0.55, y: -height, w: width * 1.1, h: height }, 40, look.mottle, width * 0.06);
  // Lit from the left: a soft highlight down the left, shade on the right
  c.fillStyle = linear(c, -width * 0.55, 0, width * 0.55, 0, [
    [0, 'rgba(255,250,220,.0)'],
    [0.22, 'rgba(255,250,220,.32)'],
    [0.45, 'rgba(255,250,220,0)'],
    [1, 'rgba(40,10,10,.38)'],
  ]);
  c.fillRect(-width, -height - 2, width * 2, height + 4);
  // Shadow cast down the tube by the lip
  c.fillStyle = linear(c, 0, -height, 0, -height + width * 0.5, [
    [0, 'rgba(50,10,10,.35)'],
    [1, 'rgba(50,10,10,0)'],
  ]);
  c.fillRect(-width, -height, width * 2, width * 0.5);
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.4 * depth})`;
    c.fill(body);
  }
  c.restore();
  c.strokeStyle = 'rgba(60,25,15,.35)';
  c.lineWidth = 0.5;
  c.stroke(body);

  // Two fringed wings running up the front of the bulb
  for (const side of [-1, 1]) {
    const x = side * width * 0.13;
    c.strokeStyle = 'rgba(110,140,60,.9)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(x, -height * 0.06);
    c.quadraticCurveTo(x + side * width * 0.06, -height * 0.25, x * 0.7, -height * 0.5);
    c.stroke();
    c.strokeStyle = 'rgba(150,40,30,.6)';
    c.lineWidth = 0.35;
    for (let t = 0.1; t < 0.48; t += 0.06) {
      const wx = x + side * width * 0.06 * Math.sin((t / 0.5) * Math.PI) - (x * 0.3 * t) / 0.5;
      c.beginPath();
      c.moveTo(wx, -height * t);
      c.lineTo(wx + side * 1.4, -height * t - 0.6);
      c.stroke();
    }
  }
  lip(c, height, width, look, 'front');
}

// Tendril from the leaf tip down to the pitcher's base, with a little curl on the long ones
function tendril(c: Ctx, fromX: number, fromY: number, toX: number, toY: number, curl: boolean) {
  c.strokeStyle = '#7E9A45';
  c.lineWidth = 0.8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(fromX, fromY);
  const midX = (fromX + toX) / 2 + (toX - fromX) * 0.4,
    midY = Math.max(fromY, toY) + 4;
  if (curl) {
    c.quadraticCurveTo(midX, fromY + (midY - fromY) * 0.5, midX, midY - 2);
    c.arc(midX + 1.6, midY - 2, 1.6, Math.PI, Math.PI * 2.6);
    c.quadraticCurveTo(midX + 2, toY + 4, toX, toY);
  } else {
    c.quadraticCurveTo(midX, midY, toX, toY);
  }
  c.stroke();
}

interface NepenthesLeaf {
  baseY: number;
  angle: number;
  length: number;
  depth: number;
  // Pitcher hanging off this leaf, if it has one
  pitcher: { height: number; hang: boolean; drop: number; look: PitcherLook } | null;
}

// Pitcher plant: glossy strap leaves on a short stem, each leaf tip running on as a tendril that ends in a
// mottled pitcher with a ribbed red lip and a lid. Grown, a couple of pitchers hang over the edge of the pot.
export const napam: Plant = {
  name: 'Pitcher plant',
  done: 'is full of pitchers',
  paint(c, stage, random, room) {
    // Order matters: which leaves carry pitchers and which pitchers hang is fixed by index
    const leaves: NepenthesLeaf[] = Array.from({ length: 10 }, (_, index) => {
      const side = index % 2 ? 1 : -1;
      return {
        // Low leaves spread almost flat, the newest stand up from the top of the short stem
        baseY: -2 - (index / 9) * 12,
        angle: -Math.PI / 2 + side * ((1 - index / 9) * 0.85 + 0.3 + random() * 0.35),
        length: 24 + random() * 9,
        depth: random(),
        pitcher: null,
      };
    });
    const looks = Array.from({ length: 6 }, () => LOOKS[random() < 0.65 ? 0 : 1]);
    // Low leaves hang their pitchers over the rim; higher ones hold them beside the foliage
    const pitchered: [number, boolean][] = [
      [5, false],
      [2, true],
      [6, false],
      [3, true],
      [8, false],
    ];
    pitchered.forEach(([index, hang], order) => {
      leaves[index].pitcher = { height: 15 + random() * 5, hang, drop: 6 + random() * 6, look: looks[order] };
    });

    const grow = 0.5 + stage * 0.125;
    const shownLeaves = leaves.slice(0, [0, 3, 5, 7, 10][stage]);
    const pitcherCount = [0, 0, 1, 3, 5][stage];
    const pitcherScale = [0, 0, 0.55, 0.8, 1][stage];
    const withPitcher = new Set(pitchered.slice(0, pitcherCount).map(([index]) => index));

    // Short woody stem the leaves come off
    c.strokeStyle = linear(c, -2, 0, 2, 0, [
      [0, '#9AAE5C'],
      [1, '#5B6E30'],
    ]);
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(1, -6 * grow, 0, -14 * grow);
    c.stroke();

    // Back to front: back leaves and their pitchers first
    const order = shownLeaves.map((leaf, index) => ({ leaf, index })).sort((a, b) => b.leaf.depth - a.leaf.depth);
    for (const { leaf, index } of order) {
      const look = facing(leaf.depth, leaf.angle);
      const baseY = leaf.baseY * grow,
        length = leaf.length * grow * look.squash;
      const tipX = Math.cos(look.angle) * length,
        tipY = baseY + Math.sin(look.angle) * length;
      paintLeaf(
        c,
        0,
        baseY,
        look.angle,
        length,
        5 * grow,
        { light: '#B6D774', mid: '#79A542', dark: '#45702A' },
        'oval',
        look.shade,
      );

      const hanging = leaf.pitcher;
      if (!hanging || !withPitcher.has(index)) continue;
      const height = hanging.height * pitcherScale;
      // Hanging pitchers drop below the soil line as far as the room allows; the rest sit just under the tip
      const outward = Math.sign(tipX || 1);
      const baseX = tipX + outward * (hanging.hang ? 6 : 5);
      const bottom = hanging.hang && stage === 4 ? Math.min(room * 0.8, height + 10) : tipY + hanging.drop + height;
      tendril(c, tipX, tipY, baseX, bottom, hanging.hang);
      c.save();
      c.translate(baseX, bottom);
      // Tipped slightly outward, the way a pitcher's weight pulls it
      c.rotate(outward * (hanging.hang ? 0.12 : 0.18));
      pitcher(c, height, hanging.look, look.shade * 0.6, random);
      c.restore();
    }
  },
};
