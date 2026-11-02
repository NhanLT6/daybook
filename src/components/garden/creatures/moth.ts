import type { Actor, Creature, Ctx, GardenWorld } from './kit';

import { approach, between, makeActor, pick, TAU } from './kit';
import { eyespot, featherAntenna, fur, linear, radial } from './paint';

// Night moths, seen from above with the head toward -y. Four kinds that differ in shape and colour; each visit
// picks one. They flutter in an erratic zigzag, settle on a leaf head-up and stay still, and the hawk-moth
// hovers at flowers instead of landing, the way it feeds.

interface MothKind {
  // Right-hand wings; mirrored for the left
  wing: (c: Ctx) => void;
  body: (c: Ctx) => void;
  // Wings folded into a tent at rest (they open only to fly)
  tent: boolean;
  size: number;
}

// Luna moth: pale green, long tails on the hind wings, eyespots, plum leading edge
const luna: MothKind = {
  tent: false,
  size: 0.78,
  wing(c) {
    const hind = new Path2D();
    hind.moveTo(0.8, 0.6);
    hind.bezierCurveTo(6.4, 0.4, 8.6, 3.8, 6.4, 7.2);
    hind.quadraticCurveTo(5.2, 9.6, 5.6, 15.4);
    hind.quadraticCurveTo(3.4, 12.6, 3.3, 9.2);
    hind.quadraticCurveTo(1.6, 6, 0.8, 0.6);
    c.fillStyle = linear(c, 0, 0, 6, 15, [
      [0, '#E3F4D8'],
      [0.5, '#B9DDB0'],
      [1, '#86B98A'],
    ]);
    c.fill(hind);
    c.strokeStyle = 'rgba(110,150,105,.55)';
    c.lineWidth = 0.22;
    for (const [x, y] of [
      [6.6, 4.8],
      [5.4, 7.6],
      [4.4, 11],
    ]) {
      c.beginPath();
      c.moveTo(1.2, 1.2);
      c.quadraticCurveTo(x * 0.5, y * 0.4, x, y);
      c.stroke();
    }
    c.strokeStyle = 'rgba(160,190,140,.9)';
    c.lineWidth = 0.35;
    c.stroke(hind);
    eyespot(c, 4.6, 4.4, 0.85, '#7C5466', '#E9C977', 'rgba(240,248,232,.9)');

    const fore = new Path2D();
    fore.moveTo(0.9, -2.2);
    fore.bezierCurveTo(4, -5.6, 8.4, -6.4, 10.4, -5.4);
    fore.quadraticCurveTo(10.6, -3.2, 8.4, -0.6);
    fore.quadraticCurveTo(5.6, 1.6, 1, 1);
    fore.closePath();
    c.fillStyle = linear(c, 1, -5, 9, 1, [
      [0, '#E8F6DE'],
      [0.55, '#C2E2B8'],
      [1, '#93C391'],
    ]);
    c.fill(fore);
    c.save();
    c.clip(fore);
    c.strokeStyle = 'rgba(110,150,105,.5)';
    c.lineWidth = 0.2;
    for (const [x, y] of [
      [9.8, -4.2],
      [8.8, -2],
      [6.8, 0.2],
      [4, 0.9],
    ]) {
      c.beginPath();
      c.moveTo(1.2, -1.4);
      c.quadraticCurveTo(x * 0.5, y * 0.6 - 1, x, y);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = '#7C5466';
    c.lineWidth = 0.75;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(1.1, -2.6);
    c.bezierCurveTo(4, -5.7, 8.2, -6.3, 10.2, -5.4);
    c.stroke();
    c.strokeStyle = 'rgba(160,190,140,.9)';
    c.lineWidth = 0.3;
    c.stroke(fore);
    eyespot(c, 6.2, -2.4, 0.95, '#7C5466', '#E9C977', 'rgba(240,248,232,.9)');
  },
  body(c) {
    c.fillStyle = radial(
      c,
      0,
      3,
      0.2,
      3.4,
      [
        [0, '#FFFFFF'],
        [1, '#D8E4D2'],
      ],
      -0.6,
      -1,
    );
    c.beginPath();
    c.ellipse(0, 3.2, 1.15, 3.2, 0, 0, TAU);
    c.fill();
    c.strokeStyle = 'rgba(170,185,165,.6)';
    c.lineWidth = 0.2;
    for (const y of [1.6, 2.8, 4, 5.2]) {
      c.beginPath();
      c.moveTo(-1, y);
      c.quadraticCurveTo(0, y + 0.4, 1, y);
      c.stroke();
    }
    c.fillStyle = radial(
      c,
      0,
      -1,
      0.2,
      2.4,
      [
        [0, '#FFFFFF'],
        [1, '#DDE6D6'],
      ],
      -0.5,
      -0.6,
    );
    c.beginPath();
    c.ellipse(0, -1, 1.6, 2.1, 0, 0, TAU);
    c.fill();
    fur(c, 0, -1, 1.5, 2, 'rgba(255,255,255,.9)', 36, 0.45);
    c.strokeStyle = '#B07A8E';
    c.lineWidth = 0.35;
    c.beginPath();
    c.moveTo(-1.6, -1.6);
    c.lineTo(1.6, -1.6);
    c.stroke();
    c.fillStyle = '#E9EFE4';
    c.beginPath();
    c.ellipse(0, -3.4, 1, 0.8, 0, 0, TAU);
    c.fill();
    featherAntenna(c, [-0.4, -3.9], [-1.4, -5.4], [-2.6, -6.8], '#C9A55E', 0.75);
    featherAntenna(c, [0.4, -3.9], [1.4, -5.4], [2.6, -6.8], '#C9A55E', 0.75);
  },
};

// Rosy maple moth: fluffy, pink and butter-yellow, wings folded into a tent
const rosyMaple: MothKind = {
  tent: true,
  size: 0.85,
  wing(c) {
    const wing = new Path2D();
    wing.moveTo(0.6, -2.4);
    wing.bezierCurveTo(4.4, -2.2, 6.6, 3, 6.4, 7.2);
    wing.quadraticCurveTo(3.6, 8.8, 0.4, 8.2);
    wing.closePath();
    // Pink at the base and tip, a yellow band across the middle
    c.fillStyle = linear(c, 0, -2.4, 2, 8.6, [
      [0, '#E98FAE'],
      [0.28, '#EFA1BB'],
      [0.36, '#F5DC86'],
      [0.66, '#F2D174'],
      [0.74, '#EC95B2'],
      [1, '#D66F95'],
    ]);
    c.fill(wing);
    c.save();
    c.clip(wing);
    c.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 26; i++) {
      c.beginPath();
      c.ellipse(1 + (i % 5) * 1.2, -1 + Math.floor(i / 5) * 1.8, 0.35, 0.22, 0.6, 0, TAU);
      c.fill();
    }
    c.fillStyle = linear(c, 0, 0, 6.5, 0, [
      [0.6, 'rgba(120,40,70,0)'],
      [1, 'rgba(120,40,70,.28)'],
    ]);
    c.fill(wing);
    c.restore();
    c.strokeStyle = 'rgba(170,80,110,.45)';
    c.lineWidth = 0.3;
    c.stroke(wing);
  },
  body(c) {
    c.fillStyle = '#E58BAA';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(side * 1.9, -1.6, 0.9, 0.5, side * 0.6, 0, TAU);
      c.fill();
    }
    c.fillStyle = radial(
      c,
      0,
      -2.2,
      0.3,
      2.6,
      [
        [0, '#FFF2B8'],
        [1, '#E9C566'],
      ],
      -0.5,
      -0.6,
    );
    c.beginPath();
    c.ellipse(0, -2.2, 1.9, 2.2, 0, 0, TAU);
    c.fill();
    fur(c, 0, -2.2, 1.8, 2.1, 'rgba(255,246,200,.95)', 60, 0.55);
    fur(c, 0, -2.2, 1.6, 1.9, 'rgba(210,170,80,.6)', 30, 0.4);
    c.fillStyle = radial(
      c,
      0,
      -4.6,
      0.2,
      1.3,
      [
        [0, '#FFF0B0'],
        [1, '#E2B95A'],
      ],
      -0.3,
      -0.3,
    );
    c.beginPath();
    c.ellipse(0, -4.6, 1.2, 1, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#3A2A2A';
    c.beginPath();
    c.arc(-0.75, -4.9, 0.35, 0, TAU);
    c.arc(0.75, -4.9, 0.35, 0, TAU);
    c.fill();
    featherAntenna(c, [-0.5, -5.4], [-1.6, -6.6], [-2.8, -6.9], '#D97898', 0.6);
    featherAntenna(c, [0.5, -5.4], [1.6, -6.6], [2.8, -6.9], '#D97898', 0.6);
  },
};

// White ermine: snow-white tent with black dots, woolly collar, yellow belly showing at the tail
const ermine: MothKind = {
  tent: true,
  size: 0.82,
  wing(c) {
    const wing = new Path2D();
    wing.moveTo(0.5, -2.6);
    wing.bezierCurveTo(4.6, -2.4, 7, 2.4, 6.8, 6.6);
    wing.quadraticCurveTo(4.2, 8, 1.2, 7.4);
    wing.quadraticCurveTo(0.5, 3, 0.5, -2.6);
    c.fillStyle = linear(c, 0, -2, 6, 7, [
      [0, '#FFFFFF'],
      [0.6, '#F1EFEA'],
      [1, '#D8D4CC'],
    ]);
    c.fill(wing);
    c.save();
    c.clip(wing);
    c.fillStyle = '#2B2828';
    for (const [x, y] of [
      [1.6, -0.6],
      [2.8, 0.8],
      [4, 2.4],
      [5, 4],
      [1.4, 2.2],
      [2.4, 3.8],
      [3.4, 5.4],
      [1.6, 5.6],
      [5.6, 5.8],
      [3, -1.4],
      [4.4, 0.6],
    ]) {
      c.beginPath();
      c.ellipse(x, y, 0.32, 0.26, 0.4, 0, TAU);
      c.fill();
    }
    c.fillStyle = linear(c, 0, 0, 7, 0, [
      [0.55, 'rgba(80,80,90,0)'],
      [1, 'rgba(80,80,90,.22)'],
    ]);
    c.fill(wing);
    c.restore();
    c.strokeStyle = 'rgba(150,145,140,.6)';
    c.lineWidth = 0.28;
    c.stroke(wing);
  },
  body(c) {
    c.fillStyle = radial(
      c,
      0,
      -2.4,
      0.3,
      2.4,
      [
        [0, '#FFFFFF'],
        [1, '#DCD8D0'],
      ],
      -0.5,
      -0.6,
    );
    c.beginPath();
    c.ellipse(0, -2.4, 1.8, 2, 0, 0, TAU);
    c.fill();
    fur(c, 0, -2.4, 1.7, 1.9, 'rgba(255,255,255,.95)', 60, 0.6);
    c.fillStyle = '#2B2828';
    for (const [x, y] of [
      [-0.7, -2.8],
      [0.7, -2.8],
      [0, -1.6],
    ]) {
      c.beginPath();
      c.arc(x, y, 0.3, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#F4F2EE';
    c.beginPath();
    c.ellipse(0, -4.6, 1.05, 0.85, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#1E1C1C';
    c.beginPath();
    c.arc(-0.65, -4.85, 0.3, 0, TAU);
    c.arc(0.65, -4.85, 0.3, 0, TAU);
    c.fill();
    featherAntenna(c, [-0.4, -5.3], [-1.4, -6.8], [-2.4, -7.4], '#3A3434', 0.45);
    featherAntenna(c, [0.4, -5.3], [1.4, -6.8], [2.4, -7.4], '#3A3434', 0.45);
  },
};

// Elephant hawk-moth: swept-back wings like a little jet, olive with rose bands
const hawkMoth: MothKind = {
  tent: false,
  size: 0.8,
  wing(c) {
    const hind = new Path2D();
    hind.moveTo(0.8, 1.4);
    hind.quadraticCurveTo(4.6, 1.6, 5, 4.4);
    hind.quadraticCurveTo(3, 5.6, 0.9, 4.6);
    hind.closePath();
    c.fillStyle = linear(c, 0.8, 2, 5, 4, [
      [0, '#4A3A30'],
      [0.35, '#B8506E'],
      [1, '#E07D9C'],
    ]);
    c.fill(hind);

    const fore = new Path2D();
    fore.moveTo(0.9, -2.2);
    fore.bezierCurveTo(4.2, -2.4, 8.6, 0.4, 10.6, 3.4);
    fore.quadraticCurveTo(9.4, 4.4, 7.6, 4);
    fore.quadraticCurveTo(4, 2.6, 1, 1.6);
    fore.closePath();
    c.fillStyle = linear(c, 1, -2, 10, 4, [
      [0, '#A6A061'],
      [0.5, '#8C8748'],
      [1, '#6E6A38'],
    ]);
    c.fill(fore);
    c.save();
    c.clip(fore);
    c.strokeStyle = 'rgba(222,112,150,.9)';
    c.lineCap = 'round';
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(1.6, 0.6);
    c.quadraticCurveTo(5.4, -0.2, 9.8, 2.8);
    c.stroke();
    c.lineWidth = 0.55;
    c.beginPath();
    c.moveTo(3.4, -1.6);
    c.quadraticCurveTo(5.6, 0.6, 5.2, 3);
    c.stroke();
    c.lineWidth = 0.8;
    c.strokeStyle = 'rgba(232,140,170,.95)';
    c.beginPath();
    c.moveTo(10.4, 3.4);
    c.quadraticCurveTo(9.2, 4.3, 7.4, 3.9);
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)';
    c.beginPath();
    c.arc(3.6, -0.6, 0.3, 0, TAU);
    c.fill();
    c.restore();
    c.strokeStyle = 'rgba(70,65,35,.5)';
    c.lineWidth = 0.28;
    c.stroke(fore);
  },
  body(c) {
    const body = new Path2D();
    body.moveTo(0, -4.2);
    body.bezierCurveTo(1.8, -3.6, 1.9, 2, 0.9, 6.4);
    body.quadraticCurveTo(0, 7.6, -0.9, 6.4);
    body.bezierCurveTo(-1.9, 2, -1.8, -3.6, 0, -4.2);
    c.fillStyle = linear(c, -1.8, 0, 1.8, 0, [
      [0, '#7E7A40'],
      [0.4, '#A9A466'],
      [1, '#6A6634'],
    ]);
    c.fill(body);
    c.save();
    c.clip(body);
    c.strokeStyle = '#D9708F';
    c.lineWidth = 0.5;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 1.4, -3);
      c.quadraticCurveTo(side * 1.7, 2, side * 0.6, 6.6);
      c.stroke();
    }
    c.strokeStyle = 'rgba(60,55,30,.35)';
    c.lineWidth = 0.2;
    for (let y = 0.6; y < 6.4; y += 0.9) {
      c.beginPath();
      c.moveTo(-1.6, y);
      c.quadraticCurveTo(0, y + 0.4, 1.6, y);
      c.stroke();
    }
    c.restore();
    c.fillStyle = '#9C9558';
    c.beginPath();
    c.ellipse(0, -4.6, 0.95, 0.75, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#2E2A22';
    c.beginPath();
    c.arc(-0.65, -4.8, 0.3, 0, TAU);
    c.arc(0.65, -4.8, 0.3, 0, TAU);
    c.fill();
    c.strokeStyle = '#EDE3DA';
    c.lineWidth = 0.28;
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(side * 0.4, -5.2);
      c.quadraticCurveTo(side * 1.4, -6.8, side * 2.6, -7.2);
      c.stroke();
    }
  },
};

const KINDS = [luna, rosyMaple, ermine, hawkMoth];
const HAWK_MOTH = 3;
// Kinds on screen now, so two moths at once are never the same kind
const showing = new Set<number>();

// spread: 1 = wings as drawn, smaller = folding up past vertical as seen from above
export function paintMoth(c: Ctx, kind: number, spread: number) {
  const moth = KINDS[kind];
  for (const side of [-1, 1]) {
    c.save();
    c.scale(side * spread, 1);
    moth.wing(c);
    c.restore();
  }
  moth.body(c);
}

function enter(moth: Actor, world: GardenWorld) {
  const free = KINDS.map((_, kind) => kind).filter((kind) => !showing.has(kind));
  moth.kind = pick(free.length ? free : [0, 1, 2, 3]);
  showing.add(moth.kind);
  const start = world.exitPoint();
  Object.assign(moth, { x: start.x, y: start.y, vx: 0, vy: 0, stops: Math.floor(between(1, 3)), angle: 0 });
  nextGoal(moth, world);
}

function nextGoal(moth: Actor, world: GardenWorld) {
  moth.stops -= 1;
  moth.mode = 'fly';
  if (moth.stops < 0) {
    moth.goal = { ...world.exitPoint(), exit: true };
    return;
  }
  // The hawk-moth feeds on the wing at flowers; the others rest on the upper leaves
  const flowers = world.flowerSlots();
  if (moth.kind === HAWK_MOTH && flowers.length) {
    const index = pick(flowers);
    moth.goal = { x: 0, y: 0, perch: { index, spot: pick(world.plantSpots(index).flowers) } };
    return;
  }
  const planted = world.plantedIndices();
  if (!planted.length || Math.random() < 0.25) {
    moth.goal = world.airPoint();
    return;
  }
  const index = pick(planted),
    tops = world.plantSpots(index).tops;
  moth.goal = { x: 0, y: 0, perch: { index, spot: pick(tops.slice(0, Math.max(1, tops.length / 3))) } };
}

function updateMoth(moth: Actor, world: GardenWorld, dt: number, time: number) {
  moth.timer -= dt;
  // Fireflies come first: with four or more about, moths stay away and any moth here leaves
  const crowded = world.onScreen('firefly') >= 4;
  if (moth.mode === 'away') {
    if (moth.timer <= 0 && !crowded) enter(moth, world);
    return;
  }
  if (crowded && !moth.goal.exit) {
    moth.stops = 0;
    nextGoal(moth, world);
  }

  // Wing beat: fast flutter in flight, still at rest with a rare shiver
  moth.phase += dt * (moth.mode === 'perch' ? 0 : moth.mode === 'hover' ? 22 : 11);

  if (moth.mode === 'perch' || moth.mode === 'hover') {
    const spot = world.spotWorld(moth.perch.index, moth.perch.spot, time);
    const hovering = moth.mode === 'hover';
    // Hovering, it holds just off the flower with a small drift
    moth.x = spot.x + (hovering ? Math.sin(time * 2.3) * 1.2 - 6 * moth.facing : 0);
    moth.y = spot.y + (hovering ? Math.sin(time * 3.1) * 0.8 - 2 : 0);
    moth.scale = approach(moth.scale, spot.scale, 2, dt);
    moth.angle = approach(moth.angle, moth.yaw, 4, dt);
    if (moth.mode === 'perch') moth.wings = Math.sin(time * 9) > 0.995 ? 0.8 : 1;
    if (moth.timer <= 0) {
      moth.vy = -30;
      nextGoal(moth, world);
    }
    return;
  }

  const perchAt = moth.goal.perch ? world.spotWorld(moth.goal.perch.index, moth.goal.perch.spot, time) : null;
  const target = perchAt ?? moth.goal;
  if (perchAt) moth.scale = approach(moth.scale, perchAt.scale, 1.5, dt);
  const dx = target.x - moth.x,
    dy = target.y - moth.y,
    distance = Math.hypot(dx, dy) || 1;
  // Erratic course: a steady pull toward the goal plus sharp random jinks, calmer on the final approach
  const near = distance < 25;
  const want = Math.min(near ? 18 : 42, distance * 2);
  moth.vx = approach(moth.vx, (dx / distance) * want, 2, dt);
  moth.vy = approach(moth.vy, (dy / distance) * want, 2, dt);
  if (Math.random() < dt * (near ? 3 : 9)) {
    moth.vx += between(-30, 30);
    moth.vy += between(-26, 22);
  }
  moth.x += moth.vx * dt;
  moth.y += moth.vy * dt;
  // Head points along the flight, leaning rather than spinning
  const heading = Math.atan2(moth.vy, moth.vx) + Math.PI / 2;
  const lean = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(heading), Math.cos(heading))));
  moth.angle = approach(moth.angle, lean, 3, dt);
  moth.wings = 0.3 + 0.7 * Math.abs(Math.cos(moth.phase * TAU * 0.5));
  if (Math.abs(moth.vx) > 4) moth.facing = Math.sign(moth.vx);

  if (moth.goal.perch && distance < 1.5) {
    moth.perch = moth.goal.perch;
    if (moth.kind === HAWK_MOTH && world.plantSpots(moth.perch.index).flowers.length) {
      moth.mode = 'hover';
      moth.timer = between(1.5, 3.5);
      moth.yaw = moth.facing * 0.9;
    } else {
      moth.mode = 'perch';
      moth.timer = between(10, 22);
      // Resting moths sit head-up, a little askew
      moth.yaw = between(-0.45, 0.45);
    }
  } else if (!moth.goal.perch && distance < 12) {
    if (moth.goal.exit) {
      moth.mode = 'away';
      moth.timer = between(18, 45);
      showing.delete(moth.kind);
    } else nextGoal(moth, world);
  }
}

export const moth: Creature = {
  name: 'moth',
  night: true,
  count: 2,
  // The second moth comes later, so most of the time there is only one
  create: (slot) => makeActor({ timer: slot ? between(25, 40) : between(2, 6), wings: 1 }),
  update: updateMoth,
  paint(c, moth) {
    const kind = KINDS[moth.kind];
    c.save();
    c.translate(moth.x, moth.y);
    c.rotate(moth.angle);
    c.scale(moth.scale * kind.size, moth.scale * kind.size);
    // Tent wings open out to fly; open wings beat as they are
    const spread = moth.mode === 'perch' ? moth.wings : kind.tent ? 0.6 + moth.wings * 0.9 : moth.wings;
    paintMoth(c, moth.kind, spread);
    c.restore();
  },
  reset: () => showing.clear(),
};
