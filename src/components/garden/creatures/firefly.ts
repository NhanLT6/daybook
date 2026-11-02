import type { Actor, Creature, Ctx, GardenWorld } from './kit';

import { approach, between, makeActor, pick, TAU } from './kit';
import { linear, radial } from './paint';

// Fireflies, side view facing +x. Like the common North American firefly: a male drifts low and slow, and every
// five to seven seconds gives one half-second flash while swooping up in a J. Between flashes he is dark and
// nearly invisible. A female waits on a leaf and answers about two seconds after a flash, shorter and dimmer.

const FEMALE = 0;
// Brightness over one flash: quick rise, short hold, slower fade
// Longer than the half-second of the common firefly, so a flash is easy to catch on a small shelf
const FLASH = 0.9;
function flashLevel(age: number, length = FLASH) {
  if (age < 0 || age > length) return 0;
  const rise = 0.12;
  if (age < rise) return age / rise;
  return Math.max(0, 1 - ((age - rise) / (length - rise)) ** 1.6);
}
// When the last male flash happened, so a female can answer it
let lastMaleFlash = -100;

// Body, lantern lit by `glow` (0-1). Feet on y = 0; about the size of the bee.
function paintFirefly(c: Ctx, glow: number) {
  c.save();
  c.scale(0.68, 0.68);
  c.strokeStyle = '#2A2622';
  c.lineWidth = 0.35;
  c.lineCap = 'round';
  for (const [x0, x1] of [
    [2.6, 3.4],
    [0.8, 0.6],
    [-1, -1.8],
  ]) {
    c.beginPath();
    c.moveTo(x0, -1.2);
    c.lineTo((x0 + x1) / 2, -0.4);
    c.lineTo(x1, 0);
    c.stroke();
  }
  // Lantern: two pale segments under the wing tips
  c.fillStyle = `rgb(${Math.round(150 + 105 * glow)},${Math.round(160 + 95 * glow)},${Math.round(110 + 50 * glow)})`;
  c.beginPath();
  c.ellipse(-4.1, -1.3, 2.4, 1.45, 0.08, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(150,170,80,.6)';
  c.lineWidth = 0.2;
  for (const x of [-3.2, -4.6]) {
    c.beginPath();
    c.moveTo(x, -2.5);
    c.lineTo(x - 0.2, -0.2);
    c.stroke();
  }
  // Black wing cases with a cream margin
  c.fillStyle = linear(c, 0, -4.6, 0, -0.6, [
    [0, '#3A3A40'],
    [1, '#121216'],
  ]);
  c.beginPath();
  c.ellipse(-0.3, -2.5, 4.3, 2.05, -0.05, 0, TAU);
  c.fill();
  c.strokeStyle = '#E8D9A0';
  c.lineWidth = 0.4;
  c.beginPath();
  c.ellipse(-0.3, -2.5, 4.3, 2.05, -0.05, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.25)';
  c.lineWidth = 0.3;
  c.beginPath();
  c.ellipse(-0.6, -3.3, 2.6, 0.8, -0.05, Math.PI * 1.1, Math.PI * 1.7);
  c.stroke();
  // Shield: orange with the dark central mark, head tucked beneath
  c.fillStyle = radial(
    c,
    4.4,
    -2.6,
    0.2,
    2,
    [
      [0, '#F7AE72'],
      [1, '#D9733A'],
    ],
    -0.5,
    -0.5,
  );
  c.beginPath();
  c.ellipse(4.4, -2.6, 1.85, 1.55, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#3A2A22';
  c.beginPath();
  c.ellipse(4.5, -3, 0.75, 0.6, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#1E1A17';
  c.beginPath();
  c.arc(6, -1.6, 0.85, 0, TAU);
  c.fill();
  // Segmented antennae
  c.strokeStyle = '#1E1A17';
  c.lineWidth = 0.28;
  c.beginPath();
  c.moveTo(6.4, -2.2);
  c.quadraticCurveTo(7.8, -4.4, 9.2, -4);
  c.stroke();
  for (let t = 0.2; t < 1; t += 0.2) {
    const x = 6.4 + (9.2 - 6.4) * t,
      y = -2.2 + (-4 + 2.2) * t - Math.sin(t * Math.PI) * 1.1;
    c.beginPath();
    c.arc(x, y, 0.17, 0, TAU);
    c.fill();
  }
  c.restore();
}

function appear(fly: Actor, world: GardenWorld, female: boolean) {
  fly.glow = 0;
  fly.phase = 0;
  if (female) {
    const planted = world.plantedIndices();
    if (!planted.length) {
      fly.timer = 10;
      return;
    }
    const index = pick(planted),
      tops = world.plantSpots(index).tops;
    // A lower leaf, not the very top: she waits inside the plant
    fly.perch = { index, spot: pick(tops.slice(Math.floor(tops.length / 3))) };
    fly.facing = Math.random() < 0.5 ? 1 : -1;
    fly.mode = 'perch';
    fly.timer = between(40, 80);
    return;
  }
  // Males rise out of the plants low on the shelf and drift
  Object.assign(fly, {
    mode: 'drift',
    x: between(0.15, 0.85) * world.width,
    y: between(0.5, 0.9) * world.height,
    vx: 0,
    vy: 0,
    timer: between(20, 45),
    next: null,
    bob: between(1, 3),
    goal: { x: 0, y: 0 },
  });
  wander(fly, world);
}

function wander(fly: Actor, world: GardenWorld) {
  fly.goal = {
    x: Math.max(10, Math.min(world.width - 10, fly.x + between(-50, 50))),
    y: Math.max(world.height * 0.2, Math.min(world.height * 0.95, fly.y + between(-25, 20))),
  };
  fly.stops = between(2, 4);
}

function updateFirefly(fly: Actor, world: GardenWorld, dt: number, time: number) {
  fly.timer -= dt;
  const female = fly.kind === FEMALE;
  if (fly.mode === 'away') {
    if (fly.timer <= 0) appear(fly, world, female);
    return;
  }

  if (fly.mode === 'perch') {
    const spot = world.spotWorld(fly.perch.index, fly.perch.spot, time);
    fly.x = spot.x;
    fly.y = spot.y;
    fly.scale = spot.scale;
    // Answer a male's flash after a fixed delay, if one flashed recently and she is not mid-flash
    const since = time - lastMaleFlash;
    if (since > 1.9 && since < 2.1 && time - fly.phase > 3) fly.phase = time;
    fly.glow = 0.75 * flashLevel(time - fly.phase, 0.6);
    if (fly.timer <= 0) {
      fly.mode = 'away';
      fly.timer = between(15, 30);
    }
    return;
  }

  // Male: slow drift between nearby points, one flash every few seconds
  fly.bob -= dt;
  if (fly.bob <= 0) {
    fly.bob = between(5, 7);
    fly.phase = time;
    lastMaleFlash = time;
    // The J: a short dip, then a climb while the lantern is lit
    fly.vy = 10;
    fly.next = 'climb';
  }
  const age = time - fly.phase;
  fly.glow = flashLevel(age);
  if (fly.next === 'climb' && age > 0.12) {
    fly.vy = -26;
    fly.next = null;
  }
  fly.stops -= dt;
  if (fly.stops <= 0) wander(fly, world);
  const dx = fly.goal.x - fly.x,
    dy = fly.goal.y - fly.y,
    distance = Math.hypot(dx, dy) || 1;
  const want = Math.min(11, distance);
  fly.vx = approach(fly.vx, (dx / distance) * want, 0.8, dt);
  fly.vy = approach(fly.vy, (dy / distance) * want, 0.8, dt);
  fly.x += fly.vx * dt;
  fly.y += fly.vy * dt;
  if (Math.abs(fly.vx) > 2) fly.facing = Math.sign(fly.vx);
  // Leaves quietly: it simply stops flashing once its time is up
  if (fly.timer <= 0 && age > FLASH) {
    fly.mode = 'away';
    fly.timer = between(15, 40);
  }
}

export const firefly: Creature = {
  name: 'firefly',
  night: true,
  count: 5,
  // Slot 0 is the female on a leaf; the males turn up one by one and come and go, so all five are rare
  create: (slot) =>
    makeActor({
      kind: slot,
      timer: slot === FEMALE ? between(4, 8) : slot === 1 ? between(0.5, 2) : between(6, 30) * (slot - 1),
    }),
  update: updateFirefly,
  paint(c, fly) {
    c.save();
    c.translate(fly.x, fly.y);
    c.scale(fly.scale * fly.facing, fly.scale);
    // Flying, the body tilts up with wings slightly open; dark between flashes
    if (fly.mode === 'drift') c.rotate(-0.25);
    c.globalAlpha = 0.55 + 0.45 * fly.glow;
    paintFirefly(c, fly.glow);
    c.restore();
  },
  // The glow sits over the night tint, so the flash stays a true yellow-green
  paintLight(c, fly) {
    if (fly.glow <= 0.01) return;
    const x = fly.x - 2.8 * fly.facing * fly.scale,
      y = fly.y - 1.2 * fly.scale;
    const radius = 9 * fly.scale;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const halo = c.createRadialGradient(x, y, 0, x, y, radius);
    halo.addColorStop(0, `rgba(226,255,140,${0.85 * fly.glow})`);
    halo.addColorStop(0.25, `rgba(200,250,110,${0.4 * fly.glow})`);
    halo.addColorStop(1, 'rgba(200,250,110,0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, radius, 0, TAU);
    c.fill();
    // The lantern itself, almost white at the peak
    c.fillStyle = `rgba(245,255,200,${fly.glow})`;
    c.beginPath();
    c.arc(x, y, 1.3 * fly.scale, 0, TAU);
    c.fill();
    c.restore();
  },
  reset: () => {
    lastMaleFlash = -100;
  },
};
