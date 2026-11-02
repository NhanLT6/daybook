import type { Actor, Creature, Ctx, GardenWorld, Spot } from './kit';

import { approach, between, clamp, makeActor, moveToward, pick, TAU } from './kit';

interface LadybirdPose {
  open: number;
  wings: number;
  buzz: boolean;
  stride: number;
  legsDown: boolean;
  time: number;
}

// Ladybird in profile facing +x, feet on y = 0. open: elytra lifted; wings: hind wings unfolded.
function paintLadybird(c: Ctx, { open, wings, buzz, stride, legsDown, time }: LadybirdPose) {
  c.translate(0, -1.4);
  c.strokeStyle = '#151515';
  c.lineWidth = 0.4;
  c.lineCap = 'round';
  for (const [index, legX] of [-1.4, 0, 1.3].entries()) {
    const swing = legsDown ? Math.sin(stride * 2.2 + index * 2.1) * 0.6 : 0;
    c.beginPath();
    c.moveTo(legX, 0.2);
    c.lineTo(legX + swing + (legsDown ? 0.3 : -0.8), legsDown ? 1.4 : 1.7);
    c.stroke();
  }

  if (wings > 0) {
    // Hind wings unfold from under the shell; in the air they blur.
    const pivotX = 0.6,
      pivotY = -2.2,
      length = 2 + 6 * wings;
    const strokes = buzz ? [1.15 + Math.random() * 0.3, 0.3 + Math.random() * 0.2] : [0.5];
    for (const angle of strokes) {
      c.save();
      c.translate(pivotX, pivotY);
      c.rotate(angle);
      c.fillStyle = `rgba(205,180,150,${buzz ? 0.22 : 0.5})`;
      c.strokeStyle = `rgba(110,85,60,${buzz ? 0.25 : 0.5})`;
      c.lineWidth = 0.2;
      c.beginPath();
      c.ellipse(-length / 2, 0, length / 2, 1.1 * wings + 0.3, 0, 0, TAU);
      c.fill();
      c.stroke();
      c.restore();
    }
  }

  const dome = new Path2D();
  dome.ellipse(0, 0, 3.3, 2.7, 0, Math.PI, TAU);
  dome.closePath();
  const shell = (shade: boolean) => {
    const red = c.createRadialGradient(-0.8, -2, 0.2, 0, -0.6, 3.6);
    red.addColorStop(0, shade ? '#E8564A' : '#FF7A62');
    red.addColorStop(0.45, shade ? '#B91F1D' : '#E0302A');
    red.addColorStop(1, '#7A0E10');
    c.fillStyle = red;
    c.fill(dome);
    c.save();
    c.clip(dome);
    c.fillStyle = '#141010';
    for (const [spotX, spotY, radius] of [
      [-1.7, -1.1, 0.7],
      [0.4, -1.9, 0.75],
      [1.6, -0.7, 0.55],
      [-0.6, -0.3, 0.5],
    ]) {
      c.beginPath();
      c.arc(spotX, spotY, radius, 0, TAU);
      c.fill();
    }
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.7)';
    c.beginPath();
    c.ellipse(-0.6, -2.1, 0.9, 0.35, -0.25, 0, TAU);
    c.fill();
  };
  const lift = open * 0.62;
  if (open > 0) {
    c.save();
    c.translate(1.4, -2.3);
    c.rotate(lift * 0.8);
    c.translate(-1.4 - 0.5, 2.3 - 0.4);
    shell(true);
    c.restore();
  }
  c.fillStyle = '#1C1414';
  c.beginPath();
  c.ellipse(0, 0.05, 3.1, 0.7, 0, 0, TAU);
  c.fill();
  c.save();
  c.translate(1.4, -2.3);
  c.rotate(lift);
  c.translate(-1.4, 2.3);
  shell(false);
  c.restore();

  c.fillStyle = '#151111';
  c.beginPath();
  c.ellipse(3.1, -0.7, 1.35, 1.25, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#F4EFE6';
  c.beginPath();
  c.ellipse(3.2, -1.2, 0.5, 0.35, 0.3, 0, TAU);
  c.fill();
  c.beginPath();
  c.arc(4.1, -0.4, 0.25, 0, TAU);
  c.fill();
  const flick = Math.sin(time * 3) > 0.92 ? -0.5 : 0;
  c.strokeStyle = '#151111';
  c.lineWidth = 0.25;
  c.beginPath();
  c.moveTo(4.1, -0.9);
  c.lineTo(5, -1.4 + flick);
  c.stroke();
}

// Ladybird: flies in, folds its wings, walks and pauses, then slips under a leaf or climbs high to take off.
function updateLadybird(bug: Actor, world: GardenWorld, dt: number, time: number) {
  bug.timer -= dt;
  const walkSpeed = 4.5 * bug.scale;
  const at = () => world.spotWorld(bug.perch.index, bug.perch.spot, time);

  switch (bug.mode) {
    case 'away': {
      if (bug.timer > 0) return;
      const planted = world.plantedIndices();
      if (!planted.length) {
        bug.timer = 10;
        return;
      }
      const index = pick(planted),
        tops = world.plantSpots(index).tops;
      const spot =
        Math.random() < 0.5 || !tops.length ? world.rimSpot(index) : pick(tops.slice(0, Math.max(1, tops.length / 2)));
      const start = world.exitPoint();
      Object.assign(bug, {
        mode: 'flyIn',
        x: start.x,
        y: Math.min(start.y, world.height * 0.3),
        vx: 0,
        vy: 0,
        perch: { index, spot },
        open: 1,
        wings: 1,
        behind: false,
        rounds: Math.floor(between(1, 4)),
      });
      return;
    }
    case 'flyIn': {
      const goal = at();
      bug.scale = approach(bug.scale, goal.scale, 2, dt);
      if (Math.abs(bug.vx) > 5) bug.facing = Math.sign(bug.vx);
      bug.angle = approach(bug.angle, -0.55, 4, dt);
      if (moveToward(bug, goal, 70, 2.2, dt) < 0.8) {
        bug.mode = 'settle';
        bug.timer = 1.1;
        bug.angle = 0;
      }
      return;
    }
    case 'settle': {
      Object.assign(bug, at());
      // Hind wings fold away first, then the elytra close over them.
      bug.wings = clamp((bug.timer - 0.4) / 0.7, 0, 1);
      bug.open = clamp(bug.timer / 0.4, 0, 1);
      if (bug.timer <= 0) ladybirdWalk(world, bug);
      return;
    }
    case 'walk': {
      const goal = world.spotWorld(bug.perch.index, bug.goalSpot, time);
      const before = { x: bug.x, y: bug.y };
      const distance = moveToward(bug, goal, walkSpeed, 12, dt);
      bug.stride += Math.hypot(bug.x - before.x, bug.y - before.y);
      if (Math.abs(goal.x - bug.x) > 0.3) bug.facing = Math.sign(goal.x - bug.x);
      // On foliage it climbs along the leaf, so the body turns with the path.
      bug.angle = bug.perch.spot.rim
        ? 0
        : approach(bug.angle, clamp(Math.atan2(goal.y - bug.y, Math.abs(goal.x - bug.x) + 0.01), -1.3, 1.3), 4, dt);
      if (distance < 0.5) {
        bug.perch.spot = bug.goalSpot;
        if (bug.next === 'hidden') {
          bug.mode = 'hidden';
          bug.timer = between(7, 14);
        } else if (bug.next === 'surface') {
          bug.behind = false;
          bug.mode = 'pause';
          bug.timer = between(1, 2);
          bug.next = 'climb';
        } else if (bug.next === 'prepare') {
          bug.mode = 'prepare';
          bug.timer = 1.6;
          bug.angle = 0;
        } else {
          bug.mode = 'pause';
          bug.timer = between(1, 2.6);
        }
      }
      return;
    }
    case 'pause': {
      Object.assign(bug, at());
      if (bug.timer > 0) return;
      if (bug.next === 'climb') {
        ladybirdClimb(world, bug);
        return;
      }
      bug.rounds -= 1;
      if (bug.rounds > 0) {
        ladybirdWalk(world, bug);
        return;
      }
      const inside = world.plantSpots(bug.perch.index).inside;
      if (inside.length && Math.random() < 0.55) {
        bug.behind = true;
        bug.next = 'hidden';
        bug.mode = 'walk';
        bug.goalSpot = nearest(inside, bug.perch.spot);
      } else ladybirdClimb(world, bug);
      return;
    }
    case 'hidden': {
      Object.assign(bug, at());
      if (bug.timer > 0) return;
      const tops = world.plantSpots(bug.perch.index).tops;
      bug.mode = 'walk';
      bug.next = 'surface';
      bug.goalSpot = nearest(tops, bug.perch.spot);
      return;
    }
    case 'prepare': {
      Object.assign(bug, at());
      bug.open = clamp((1.6 - bug.timer) / 0.35, 0, 1);
      bug.wings = clamp((1.6 - bug.timer - 0.35) / 0.6, 0, 1);
      if (bug.timer <= 0) {
        bug.mode = 'flyOut';
        bug.goal = world.exitPoint();
        bug.goal.y = between(0, world.height * 0.25);
        bug.vy = -30;
      }
      return;
    }
    case 'flyOut': {
      bug.angle = approach(bug.angle, -0.55, 5, dt);
      if (Math.abs(bug.vx) > 5) bug.facing = Math.sign(bug.vx);
      if (moveToward(bug, bug.goal, 75, 1.8, dt) < 10) {
        bug.mode = 'away';
        bug.timer = between(30, 60);
        bug.open = 0;
        bug.wings = 0;
      }
    }
  }
}

function nearest(spots: Spot[], from: Spot) {
  return spots.reduce(
    (best, spot) =>
      Math.hypot(spot.dx - from.dx, spot.dy - from.dy) < Math.hypot(best.dx - from.dx, best.dy - from.dy) ? spot : best,
    spots[0],
  );
}
function ladybirdWalk(world: GardenWorld, bug: Actor) {
  const from = bug.perch.spot;
  let goalSpot: Spot;
  if (from.rim) {
    const reach = world.potWidth(bug.perch.index) * 0.34;
    goalSpot = { dx: clamp(from.dx + between(-14, 14), -reach, reach), dy: from.dy, rim: true };
  } else {
    const near = world
      .plantSpots(bug.perch.index)
      .tops.filter((spot) => Math.hypot(spot.dx - from.dx, spot.dy - from.dy) < 10);
    goalSpot = near.length ? pick(near) : from;
  }
  bug.mode = 'walk';
  bug.next = null;
  bug.goalSpot = goalSpot;
}
// Before take-off a ladybird walks up to the highest point it can reach.
function ladybirdClimb(world: GardenWorld, bug: Actor) {
  const tops = world.plantSpots(bug.perch.index).tops;
  const highest = tops.length
    ? tops
        .slice(0, Math.max(1, Math.floor(tops.length / 10)))
        .reduce((best, spot) =>
          Math.abs(spot.dx - bug.perch.spot.dx) < Math.abs(best.dx - bug.perch.spot.dx) ? spot : best,
        )
    : bug.perch.spot;
  if (bug.perch.spot.rim) bug.perch.spot = { ...bug.perch.spot, rim: false };
  bug.mode = 'walk';
  bug.next = 'prepare';
  bug.goalSpot = highest;
}

function paintLadybirdAt(c: Ctx, bug: Actor, time: number) {
  c.save();
  c.translate(bug.x, bug.y);
  c.scale(bug.scale * bug.facing, bug.scale);
  c.rotate(bug.angle);
  const flying = bug.mode === 'flyIn' || bug.mode === 'flyOut';
  paintLadybird(c, {
    open: bug.open,
    wings: bug.wings,
    buzz: flying || (bug.mode === 'prepare' && bug.wings >= 1),
    stride: bug.stride,
    legsDown: !flying,
    time,
  });
  c.restore();
}

export const ladybird: Creature = {
  night: false,
  count: 1,
  create: () => makeActor({ timer: 7 }),
  update: updateLadybird,
  paint: paintLadybirdAt,
  // Under a leaf it is painted before that plant, so the foliage covers it
  behindSlot: (bug) => (bug.behind ? bug.perch.index : null),
};
