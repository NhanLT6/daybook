import type { Actor, Creature, Ctx, GardenWorld } from './kit';

import { approach, between, clamp, makeActor, pick, TAU } from './kit';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}
interface ButterflyPose {
  mode: string;
  yaw: number;
  theta: number;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  bob: number;
  scale: number;
}

// Butterfly in true 3D: each wing is a flat plane hinged on the body, projected by a camera looking slightly down.
const CAMERA_TILT = 0.38;
const project = (vector: Vec3) => ({
  x: vector.x,
  y: -(vector.y * Math.cos(CAMERA_TILT) - vector.z * Math.sin(CAMERA_TILT)),
});
const towardCamera = { x: 0, y: Math.sin(CAMERA_TILT), z: Math.cos(CAMERA_TILT) };
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const unit = (vector: Vec3): Vec3 => {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};
const sum = (...parts: [Vec3, number][]): Vec3 =>
  parts.reduce<Vec3>(
    (total, [vector, amount]) => ({
      x: total.x + vector.x * amount,
      y: total.y + vector.y * amount,
      z: total.z + vector.z * amount,
    }),
    { x: 0, y: 0, z: 0 },
  );

const FOREWING = [
  [1.2, 0.3],
  [4.6, 4],
  [5.2, 9.2],
  [3.6, 11.8],
  [2.2, 12.6],
  [-0.6, 11.6],
  [-1.9, 9.6],
  [-2.3, 6],
  [-1.2, 2],
  [-0.6, 0.6],
];
const HINDWING = [
  [-0.3, 0.6],
  [0.6, 4],
  [0.2, 7.6],
  [-1.6, 8.8],
  [-3.6, 9.4],
  [-6.4, 8.4],
  [-7.8, 6],
  [-7.6, 3.6],
  [-4.4, 0.7],
  [-1.2, 0.3],
];
function smoothShape(c: Ctx, points: number[][]) {
  c.beginPath();
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[points.length - 1], points[0]);
  c.moveTo(start[0], start[1]);
  points.forEach((point, index) => {
    const next = mid(point, points[(index + 1) % points.length]);
    c.quadraticCurveTo(point[0], point[1], next[0], next[1]);
  });
  c.closePath();
}

function butterflyFrame(fly: ButterflyPose) {
  let forward: Vec3;
  if (fly.mode === 'perch') forward = unit({ x: Math.cos(fly.yaw), y: 0.12, z: Math.sin(fly.yaw) * 0.9 });
  else {
    forward = unit({ x: fly.vx ?? 0, y: -(fly.vy ?? 0) * 0.5, z: (fly.vz ?? 0) * 30 + 0.001 });
    forward = unit({ x: forward.x, y: clamp(forward.y, -0.45, 0.6), z: forward.z });
  }
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }));
  return { forward, right, up: cross(right, forward) };
}

function paintButterfly(c: Ctx, fly: ButterflyPose) {
  const { forward, right, up } = butterflyFrame(fly);
  const size = fly.scale * (1 + fly.z * 0.12) * 0.95;
  c.save();
  c.translate(fly.x, fly.y + fly.bob - (fly.mode === 'perch' ? 1.5 * size : 0));
  c.scale(size, size);

  const wings = [1, -1]
    .map((side) => {
      const span = sum([right, side * Math.cos(fly.theta)], [up, Math.sin(fly.theta)]);
      const normal = cross(span, forward);
      const upper = side * dot(normal, towardCamera) > 0;
      return { side, span, upper, depth: dot(span, towardCamera) };
    })
    .sort((a, b) => a.depth - b.depth);

  const paintWing = ({ span, upper }: { span: Vec3; upper: boolean }) => {
    const along = project(forward),
      out = project(span);
    c.save();
    c.transform(along.x, along.y, out.x, out.y, 0, 0);
    paintWingSurface(c, HINDWING, upper, true);
    paintWingSurface(c, FOREWING, upper, false);
    c.restore();
  };
  paintWing(wings[0]);
  paintButterflyBody(c, forward, up);
  paintWing(wings[1]);
  c.restore();
}

// Wing pattern after the common tiger, frequent in Vietnamese gardens: orange cells, black veins and border, white spots.
function paintWingSurface(c: Ctx, points: number[][], upper: boolean, hind: boolean) {
  smoothShape(c, points);
  c.save();
  const base = c.createLinearGradient(0, 0, 0, hind ? 9 : 12.5);
  if (upper) {
    base.addColorStop(0, '#C8551A');
    base.addColorStop(0.5, '#EE8A2E');
    base.addColorStop(1, '#F5A443');
  } else {
    base.addColorStop(0, '#C9762E');
    base.addColorStop(0.6, '#E8B26A');
    base.addColorStop(1, '#F0C487');
  }
  c.fillStyle = base;
  c.fill();
  c.clip();
  c.strokeStyle = upper ? 'rgba(25,15,10,.7)' : 'rgba(60,35,20,.5)';
  c.lineWidth = 0.3;
  const veins = hind
    ? [
        [-1, 8.6],
        [-3, 9],
        [-5.4, 8],
        [-7, 5.6],
        [0, 7],
      ]
    : [
        [4.6, 9.5],
        [3.2, 11.8],
        [1, 12.3],
        [-1, 11],
        [-2, 8],
      ];
  for (const [veinX, veinY] of veins) {
    c.beginPath();
    c.moveTo(-0.4, 0.8);
    c.quadraticCurveTo(veinX * 0.4, veinY * 0.55, veinX, veinY);
    c.stroke();
  }
  if (!hind) {
    // Dark apex with a row of white spots, the tiger's signature.
    c.fillStyle = upper ? '#1C130E' : '#3C2A1E';
    c.beginPath();
    c.ellipse(4, 11, 4.2, 3.4, 0.4, 0, TAU);
    c.fill();
    c.fillStyle = '#FBF5EA';
    for (const [spotX, spotY, radius] of [
      [4.4, 9.8, 0.75],
      [3, 10.8, 0.65],
      [1.6, 11.3, 0.55],
      [5, 8.4, 0.5],
      [2.6, 12.2, 0.4],
    ]) {
      c.beginPath();
      c.arc(spotX, spotY, radius, 0, TAU);
      c.fill();
    }
  }
  c.lineWidth = 1.5;
  c.strokeStyle = upper ? '#1C130E' : '#3C2A1E';
  smoothShape(c, points);
  c.stroke();
  c.fillStyle = 'rgba(251,245,234,.9)';
  const dots = hind
    ? [
        [-1.6, 8.3],
        [-3.6, 8.8],
        [-5.6, 7.8],
        [-7, 5.8],
      ]
    : [
        [-0.2, 11.2],
        [-1.4, 9.8],
      ];
  for (const [dotX, dotY] of dots) {
    c.beginPath();
    c.arc(dotX, dotY, 0.32, 0, TAU);
    c.fill();
  }
  c.restore();
}

function paintButterflyBody(c: Ctx, forward: Vec3, up: Vec3) {
  const point = (along: number, lift: number) => project(sum([forward, along], [up, lift]));
  c.lineCap = 'round';
  // Head, thorax, then an abdomen that tapers and droops slightly.
  for (let step = 0; step <= 18; step++) {
    const t = step / 18,
      along = 3.4 - t * 9.6,
      lift = -0.9 * t * t;
    const radius = t < 0.12 ? 1.05 : t < 0.35 ? 1.35 - (t - 0.12) * 0.6 : 1.2 * (1 - (t - 0.35) / 0.65) + 0.35;
    const at = point(along, lift);
    c.fillStyle = t < 0.1 ? '#2A1E18' : '#36271E';
    c.beginPath();
    c.arc(at.x, at.y, radius, 0, TAU);
    c.fill();
  }
  const shine = point(0.8, 0.6);
  c.fillStyle = 'rgba(255,255,255,.28)';
  c.beginPath();
  c.arc(shine.x, shine.y, 0.5, 0, TAU);
  c.fill();
  c.strokeStyle = '#1E1612';
  c.lineWidth = 0.3;
  for (const side of [-0.7, 0.7]) {
    const from = point(3.8, 0.5),
      tip = project(sum([forward, 9], [up, 3.2], [cross(up, forward), side * 2.4]));
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(tip.x, tip.y);
    c.stroke();
    c.fillStyle = '#1E1612';
    c.beginPath();
    c.arc(tip.x, tip.y, 0.5, 0, TAU);
    c.fill();
  }
}

// Butterfly: 7 Hz strokes, each downstroke lifts the body and kicks its course, in bursts with short glides.
function updateButterfly(fly: Actor, world: GardenWorld, dt: number, time: number) {
  fly.timer -= dt;
  if (fly.mode === 'away') {
    if (fly.timer > 0) return;
    const start = world.exitPoint();
    Object.assign(fly, {
      x: start.x,
      y: start.y,
      z: between(-0.5, 0.5),
      vx: 0,
      vy: 0,
      vz: 0,
      stops: Math.floor(between(1, 4)),
    });
    butterflyNextGoal(world, fly);
    fly.mode = 'fly';
    return;
  }

  if (fly.mode === 'perch') {
    const spot = world.spotWorld(fly.perch.index, fly.perch.spot, time);
    fly.x = spot.x;
    fly.y = spot.y;
    fly.bob = 0;
    // Wings rest closed above the back; now and then they open slowly to bask.
    fly.bask -= dt;
    if (fly.bask < 0) fly.bask = between(2.5, 5);
    const open = fly.bask > 1.8 && fly.bask < 3.2;
    fly.theta = approach(fly.theta, open ? 0.25 : 1.5, open ? 2.2 : 3, dt);
    if (fly.timer <= 0) {
      fly.mode = 'fly';
      fly.vy = -55;
      fly.beats = 6;
      fly.glide = 0;
      butterflyNextGoal(world, fly);
    }
    return;
  }

  const perchAt = fly.goal.perch ? world.spotWorld(fly.goal.perch.index, fly.goal.perch.spot, time) : null;
  if (perchAt) fly.scale = approach(fly.scale, perchAt.scale, 1.5, dt);
  const target = perchAt ?? fly.goal;
  const distance = Math.hypot(target.x - fly.x, target.y - fly.y);
  const landing = fly.goal.perch && distance < 30;

  if (fly.glide > 0 && !landing) {
    fly.glide -= dt;
    fly.theta = approach(fly.theta, 0.22, 6, dt);
    fly.vy += 22 * dt;
    fly.bob = approach(fly.bob, 0, 4, dt);
  } else {
    const before = Math.floor(fly.phase);
    fly.phase += (landing ? 6.5 : 5) * dt;
    if (Math.floor(fly.phase) !== before) {
      // Every stroke shoves the body a little: the zigzag is the stroke, not noise added on top.
      fly.vx += between(-16, 16);
      fly.vy += between(-18, 10);
      fly.vz = clamp(fly.vz + between(-0.6, 0.6), -0.8, 0.8);
      fly.beats -= 1;
      if (fly.beats <= 0) {
        fly.beats = Math.floor(between(3, 8));
        if (Math.random() < 0.55) fly.glide = between(0.25, 0.6);
      }
    }
    const stroke = Math.cos(fly.phase * TAU);
    fly.theta = 0.52 + 0.96 * stroke;
    fly.bob = 2.4 * stroke;
  }

  const want = landing ? 22 : 48;
  const dx = target.x - fly.x,
    dy = target.y - fly.y,
    length = Math.hypot(dx, dy) || 1;
  fly.vx = approach(fly.vx, (dx / length) * Math.min(want, length * 2), 1.6, dt);
  fly.vy = approach(fly.vy, (dy / length) * Math.min(want, length * 2), 1.6, dt);
  fly.x += fly.vx * dt;
  fly.y += fly.vy * dt;
  fly.z = clamp(fly.z + fly.vz * dt, -1, 1);
  if (Math.abs(fly.z) > 0.95) fly.vz *= -0.5;

  if (fly.goal.perch && distance < 2.2) {
    fly.mode = 'perch';
    fly.perch = fly.goal.perch;
    fly.timer = between(4, 9);
    fly.bask = between(0.5, 2);
    fly.yaw = (Math.random() < 0.5 ? 0 : Math.PI) + between(-0.6, 0.6);
  } else if (!fly.goal.perch && distance < 14) {
    if (fly.goal.exit) {
      fly.mode = 'away';
      fly.timer = between(8, 18);
    } else butterflyNextGoal(world, fly);
  }
}

function butterflyNextGoal(world: GardenWorld, fly: Actor) {
  fly.stops -= 1;
  if (fly.stops < 0) {
    fly.goal = { ...world.exitPoint(), exit: true };
    return;
  }
  const slots = world.flowerSlots().length ? world.flowerSlots() : world.plantedIndices();
  if (!slots.length || Math.random() < 0.35) {
    fly.goal = world.airPoint();
    return;
  }
  const index = pick(slots),
    spots = world.plantSpots(index);
  const choices = spots.flowers.length > 2 ? spots.flowers : spots.tops.slice(0, Math.max(1, spots.tops.length / 3));
  fly.goal = { x: 0, y: 0, perch: { index, spot: pick(choices) } };
}

export const butterfly: Creature = {
  night: false,
  count: 1,
  create: () => makeActor({ timer: 2.5 }),
  update: updateButterfly,
  paint: (c, fly) => paintButterfly(c, fly),
};
