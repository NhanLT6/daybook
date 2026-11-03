import type { Actor, Creature, Ctx } from './kit';

import { approach, between, makeActor, pick, TAU } from './kit';

// A dandelion seed that lets go of a seed head and drifts off on the breeze. Only a few at a time, spaced out,
// so the head still looks full: the painted head never loses seeds, these are the odd ones the wind takes.

function release(seed: Actor, world: Parameters<Creature['update']>[1], time: number) {
  const slots = world.seedSlots();
  if (!slots.length) {
    seed.timer = 3;
    return;
  }
  const index = pick(slots);
  const spot = pick(world.plantSpots(index).seeds);
  const at = world.spotWorld(index, spot, time);
  seed.mode = 'drift';
  seed.x = at.x;
  seed.y = at.y;
  seed.scale = at.scale;
  // A small lift as it lets go, then the breeze carries it, mostly one way
  seed.vx = between(6, 14) * (Math.random() < 0.8 ? 1 : -1);
  seed.vy = between(-14, -7);
  seed.phase = between(0, TAU);
  seed.glow = 0;
}

function paintSeed(c: Ctx, seed: Actor, time: number) {
  const size = 6 * seed.scale;
  c.save();
  c.translate(seed.x, seed.y);
  // Rocks a little under its parachute
  c.rotate(Math.sin(time * 1.7 + seed.phase) * 0.35 + seed.vx * 0.012);
  // Fades in as it leaves the head, so it never pops into being
  c.globalAlpha = Math.min(1, seed.glow);
  // Brown seed hanging at the bottom, on a long fine beak
  c.strokeStyle = 'rgba(235,232,220,.9)';
  c.lineWidth = 0.4 * seed.scale;
  c.beginPath();
  c.moveTo(0, size * 0.55);
  c.lineTo(0, -size * 0.35);
  c.stroke();
  c.fillStyle = '#7A5A3A';
  c.beginPath();
  c.ellipse(0, size * 0.62, 0.45 * seed.scale, 1.1 * seed.scale, 0, 0, TAU);
  c.fill();
  // Parachute: a fan of silky hairs, a touch brighter toward the tips
  c.strokeStyle = 'rgba(255,255,255,.85)';
  c.lineWidth = 0.35 * seed.scale;
  for (let index = 0; index < 11; index++) {
    const angle = -Math.PI / 2 + (index / 10 - 0.5) * 2.5;
    const reach = size * (0.42 + 0.06 * Math.cos(index * 2.3));
    c.beginPath();
    c.moveTo(0, -size * 0.35);
    c.quadraticCurveTo(
      Math.cos(angle) * reach * 0.5,
      -size * 0.35 + Math.sin(angle) * reach * 0.6,
      Math.cos(angle) * reach,
      -size * 0.35 + Math.sin(angle) * reach,
    );
    c.stroke();
  }
  c.restore();
}

export const seed: Creature = {
  name: 'seed',
  // Day and night alike: the wind does not care
  count: 3,
  create: (slot) => makeActor({ timer: 4 + slot * between(3, 6) }),
  update(seed, world, dt, time) {
    if (seed.mode === 'away') {
      seed.timer -= dt;
      if (seed.timer <= 0) release(seed, world, time);
      return;
    }
    // Gusts come and go; the seed sinks slowly once the first lift is spent
    const gust = Math.sin(time * 0.5 + seed.phase) * 5 + Math.sin(time * 1.3 + seed.phase * 2) * 2;
    seed.vx = approach(seed.vx, Math.sign(seed.vx) * (9 + gust), 0.6, dt);
    seed.vy = approach(seed.vy, 2.5 + Math.sin(time * 0.9 + seed.phase) * 4, 0.35, dt);
    seed.x += seed.vx * dt;
    seed.y += seed.vy * dt;
    seed.glow += dt * 1.5;
    if (seed.x < -20 || seed.x > world.width + 20 || seed.y < -20 || seed.y > world.height + 10) {
      seed.mode = 'away';
      seed.timer = between(6, 14);
    }
  },
  paint: paintSeed,
};
