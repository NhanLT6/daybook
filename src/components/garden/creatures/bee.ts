import type { Actor, Creature, Ctx, GardenWorld } from './kit';

import { approach, between, glossyBall, makeActor, moveToward, pick, TAU } from './kit';

// Bee in profile facing +x, standing on y = 0.
function paintBee(c: Ctx, flying: boolean, loaded: boolean) {
  c.translate(0, flying ? -3.5 : -2.6);
  const wing = (angle: number, alpha: number) => {
    c.save();
    c.translate(0.6, -1.6);
    c.rotate(angle);
    c.fillStyle = `rgba(232,240,248,${alpha})`;
    c.strokeStyle = `rgba(150,160,175,${alpha * 0.8})`;
    c.lineWidth = 0.25;
    c.beginPath();
    c.ellipse(-3.2, 0, 3.6, 1.35, 0, 0, TAU);
    c.fill();
    c.stroke();
    c.restore();
  };
  if (flying) {
    // At 230 strokes a second the eye sees the two ends of the stroke as faint fans.
    const flicker = 0.18 + Math.random() * 0.14;
    wing(-0.95, flicker);
    wing(-0.2, flicker * 0.8);
    wing(-0.55, flicker * 0.5);
  }

  c.strokeStyle = '#3A2A1C';
  c.lineWidth = 0.45;
  c.lineCap = 'round';
  const legs = flying
    ? [
        [0.6, 4.6, -0.8],
        [-0.2, 4.4, -1.6],
        [-1.2, 4.8, -2.8],
      ]
    : [
        [1.6, 2.6, 2.4],
        [0.2, 2.6, 0.4],
        [-1.4, 2.6, -2],
      ];
  for (const [startX, reach, endX] of legs) {
    c.beginPath();
    c.moveTo(startX, 1);
    c.quadraticCurveTo(startX + 0.4, reach * 0.6, endX, reach);
    c.stroke();
  }
  if (loaded && flying) glossyBall(c, -2.6, 4.2, 0.9, '#FFE08A', '#F2B233', '#B97A12');

  c.save();
  c.rotate(0.14);
  const abdomen = new Path2D();
  abdomen.ellipse(-3.1, 0.6, 3.6, 2.4, 0, 0, TAU);
  const amber = c.createLinearGradient(0, -2, 0, 3.2);
  amber.addColorStop(0, '#F4C25A');
  amber.addColorStop(0.55, '#D98E2B');
  amber.addColorStop(1, '#7A4A16');
  c.fillStyle = amber;
  c.fill(abdomen);
  c.save();
  c.clip(abdomen);
  c.fillStyle = 'rgba(40,24,12,.88)';
  for (const bandX of [-2.2, -4.0, -5.7]) {
    c.beginPath();
    c.ellipse(bandX, 0.6, 0.55, 3, 0.1, 0, TAU);
    c.fill();
  }
  c.restore();
  c.restore();

  const thorax = c.createRadialGradient(0.2, -1, 0.2, 0.6, 0, 2.3);
  thorax.addColorStop(0, '#E2BF82');
  thorax.addColorStop(0.6, '#9A7442');
  thorax.addColorStop(1, '#4E3720');
  c.fillStyle = thorax;
  c.beginPath();
  c.arc(0.6, -0.1, 2.1, 0, TAU);
  c.fill();
  c.strokeStyle = 'rgba(240,215,160,.6)';
  c.lineWidth = 0.25;
  for (let hair = 0; hair < 7; hair++) {
    const angle = -2.8 + hair * 0.42;
    c.beginPath();
    c.moveTo(0.6 + Math.cos(angle) * 1.9, -0.1 + Math.sin(angle) * 1.9);
    c.lineTo(0.6 + Math.cos(angle) * 2.5, -0.1 + Math.sin(angle) * 2.5);
    c.stroke();
  }

  c.fillStyle = '#2A1F17';
  c.beginPath();
  c.ellipse(3, 0.5, 1.35, 1.6, 0.2, 0, TAU);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)';
  c.beginPath();
  c.arc(3.2, -0.1, 0.4, 0, TAU);
  c.fill();
  c.strokeStyle = '#2A1F17';
  c.lineWidth = 0.35;
  c.beginPath();
  c.moveTo(3.5, -0.8);
  c.lineTo(4.4, -2.5);
  c.lineTo(5.4, -2.1);
  c.stroke();
  if (!flying) wing(0.08, 0.45);
}

// Bee: strokes near 230 Hz read as a haze; it darts in a zigzag, hovers, lands on a flower, hops on, then leaves for a while.
function updateBee(bee: Actor, world: GardenWorld, dt: number, time: number) {
  bee.timer -= dt;
  if (bee.mode === 'away') {
    if (bee.timer > 0) return;
    const start = world.exitPoint();
    Object.assign(bee, { x: start.x, y: start.y, vx: 0, vy: 0, visits: Math.floor(between(3, 7)), loaded: false });
    beeNextFlower(world, bee, null);
    return;
  }
  if (bee.mode === 'leave') {
    const distance = moveToward(bee, bee.goal, 150, 3, dt);
    bee.x += Math.sin(time * 9) * 18 * dt;
    if (distance < 8) {
      bee.mode = 'away';
      bee.timer = between(6, 14);
    }
    return;
  }

  const goal = world.spotWorld(bee.perch.index, bee.perch.spot, time);
  bee.scale = approach(bee.scale, goal.scale, 2, dt);
  if (bee.mode === 'fly') {
    const hoverAt = { x: goal.x - bee.facing * 7 * goal.scale, y: goal.y - 7 * goal.scale };
    const distance = moveToward(bee, hoverAt, 130, 4, dt);
    // Sideways zigzag, the way a forager scans for scent.
    const across = Math.sin(time * 8.5 + bee.visits) * 26;
    bee.x += (-bee.vy / (Math.hypot(bee.vx, bee.vy) + 1)) * across * dt;
    bee.y += (bee.vx / (Math.hypot(bee.vx, bee.vy) + 1)) * across * dt;
    if (Math.abs(bee.vx) > 10) bee.facing = Math.sign(bee.vx);
    if (distance < 3) {
      bee.mode = 'hover';
      bee.timer = between(0.4, 1.1);
    }
  } else if (bee.mode === 'hover') {
    bee.facing = Math.sign(goal.x - bee.x) || bee.facing;
    const jitter = {
      x: goal.x - bee.facing * 7 * goal.scale + Math.sin(time * 5.3) * 2.2 + Math.sin(time * 11.7) * 0.8,
      y: goal.y - 7 * goal.scale + Math.sin(time * 6.1) * 1.8,
    };
    moveToward(bee, jitter, 60, 8, dt);
    if (bee.timer <= 0) {
      bee.mode = 'land';
    }
  } else if (bee.mode === 'land') {
    if (moveToward(bee, goal, 30, 10, dt) < 0.8) {
      bee.mode = 'visit';
      bee.timer = between(1.2, 3);
    }
  } else if (bee.mode === 'visit') {
    bee.x = goal.x + Math.sin(time * 1.7) * 1.2 * goal.scale;
    bee.y = goal.y;
    bee.vx = 0;
    bee.vy = 0;
    bee.loaded = true;
    if (bee.timer <= 0) {
      bee.visits -= 1;
      if (bee.visits <= 0) {
        bee.mode = 'leave';
        bee.goal = world.exitPoint();
        bee.vy = -40;
      } else beeNextFlower(world, bee, bee.perch.index);
    }
  }
}

function beeNextFlower(world: GardenWorld, bee: Actor, current: number | null) {
  const slots = world.flowerSlots();
  if (!slots.length) {
    // No flowers yet: it checks a leaf briefly and moves on.
    const planted = world.plantedIndices();
    if (!planted.length) {
      bee.mode = 'away';
      bee.timer = 8;
      return;
    }
    const index = pick(planted),
      tops = world.plantSpots(index).tops;
    bee.perch = { index, spot: pick(tops.slice(0, Math.max(1, tops.length / 4))) };
    bee.visits = Math.min(bee.visits, 1);
  } else {
    const index = current !== null && slots.includes(current) && Math.random() < 0.55 ? current : pick(slots);
    bee.perch = { index, spot: pick(world.plantSpots(index).flowers) };
  }
  bee.mode = 'fly';
  bee.vy -= 25;
}

export const bee: Creature = {
  night: false,
  count: 1,
  create: () => makeActor({ timer: 1 }),
  update: updateBee,
  paint(c, bee) {
    c.save();
    c.translate(bee.x, bee.y);
    c.scale(bee.scale * bee.facing, bee.scale);
    const flying = bee.mode !== 'visit';
    c.rotate(flying ? (bee.mode === 'hover' ? -0.42 : -0.18) : -0.08);
    paintBee(c, flying, bee.loaded);
    c.restore();
  },
};
