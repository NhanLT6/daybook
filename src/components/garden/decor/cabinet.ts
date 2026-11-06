// Low sideboard beside the plant shelf: sage-painted body, two drawers over two doors, oak top and legs.
// Drawn in room units with (0, 0) at the floor under its centre; the top surface is at y = -CABINET.height.
import type { Ctx } from '../creatures/kit';

import { TAU } from '../creatures/kit';
import { woodGrain } from './materials';

export const CABINET = { width: 440, height: 300 };

const LEG = 44,
  SLAB = 16,
  DRAWER = 56;
const PAINT = ['#B7C8B5', '#A5B8A3', '#8DA18C'];
const OAK = ['#E3BC8C', '#CF9F6B', '#B07D4A'];

// Raised edge of a door or drawer front: light on the top and left, shade on the bottom and right
function bevel(c: Ctx, x: number, y: number, w: number, h: number, inset = false) {
  const lit = 'rgba(255,255,250,.45)',
    shade = 'rgba(40,55,40,.28)';
  c.lineWidth = 1.4;
  c.strokeStyle = inset ? shade : lit;
  c.beginPath();
  c.moveTo(x, y + h);
  c.lineTo(x, y);
  c.lineTo(x + w, y);
  c.stroke();
  c.strokeStyle = inset ? lit : shade;
  c.beginPath();
  c.moveTo(x + w, y);
  c.lineTo(x + w, y + h);
  c.lineTo(x, y + h);
  c.stroke();
}

function knob(c: Ctx, x: number, y: number, radius: number) {
  c.fillStyle = 'rgba(40,40,20,.25)';
  c.beginPath();
  c.ellipse(x + 1.5, y + 2, radius, radius * 0.9, 0, 0, TAU);
  c.fill();
  const brass = c.createRadialGradient(x - radius * 0.4, y - radius * 0.4, 0.5, x, y, radius);
  brass.addColorStop(0, '#FFF1C4');
  brass.addColorStop(0.45, '#D8B25E');
  brass.addColorStop(1, '#8E6A27');
  c.fillStyle = brass;
  c.beginPath();
  c.arc(x, y, radius, 0, TAU);
  c.fill();
}

function oak(c: Ctx, x: number, w: number) {
  const wood = c.createLinearGradient(x, 0, x + w, 0);
  wood.addColorStop(0, OAK[1]);
  wood.addColorStop(0.3, OAK[0]);
  wood.addColorStop(1, OAK[2]);
  return wood;
}

export function paintCabinet(c: Ctx) {
  const half = CABINET.width / 2;
  const top = -CABINET.height,
    bodyTop = top + SLAB,
    bodyBottom = -LEG;
  const bodyLeft = -half + 8,
    bodyWidth = CABINET.width - 16;

  // Tapered legs, splayed a little outward
  for (const side of [-1, 1]) {
    const x = side * (half - 30);
    c.fillStyle = oak(c, x - 8, 16);
    c.beginPath();
    c.moveTo(x - 8, bodyBottom);
    c.lineTo(x + 8, bodyBottom);
    c.lineTo(x + 4 + side * 5, 0);
    c.lineTo(x - 3 + side * 5, 0);
    c.closePath();
    c.fill();
  }

  // Painted body, lit from the left
  const body = c.createLinearGradient(bodyLeft, 0, bodyLeft + bodyWidth, 0);
  body.addColorStop(0, PAINT[1]);
  body.addColorStop(0.2, PAINT[0]);
  body.addColorStop(1, PAINT[2]);
  c.fillStyle = body;
  c.beginPath();
  c.roundRect(bodyLeft, bodyTop, bodyWidth, bodyBottom - bodyTop, [0, 0, 4, 4]);
  c.fill();
  // Plinth shade at the bottom edge
  c.fillStyle = 'rgba(40,55,40,.22)';
  c.fillRect(bodyLeft, bodyBottom - 6, bodyWidth, 6);

  // Two drawers over two doors, with a hairline gap between fronts
  const frontLeft = bodyLeft + 10,
    frontWidth = bodyWidth - 20,
    gap = 4;
  const fronts = {
    drawerTop: bodyTop + 12,
    doorTop: bodyTop + 12 + DRAWER + gap,
    doorBottom: bodyBottom - 12,
  };
  const halfWidth = (frontWidth - gap) / 2;
  for (const column of [0, 1]) {
    const x = frontLeft + column * (halfWidth + gap);
    bevel(c, x, fronts.drawerTop, halfWidth, DRAWER);
    knob(c, x + halfWidth / 2, fronts.drawerTop + DRAWER / 2, 5.5);

    const doorHeight = fronts.doorBottom - fronts.doorTop;
    bevel(c, x, fronts.doorTop, halfWidth, doorHeight);
    // Recessed panel inside each door
    bevel(c, x + 18, fronts.doorTop + 18, halfWidth - 36, doorHeight - 36, true);
    knob(c, column === 0 ? x + halfWidth - 14 : x + 14, fronts.doorTop + 30, 5);
  }

  // Shadow the top slab casts on the body
  const under = c.createLinearGradient(0, bodyTop, 0, bodyTop + 14);
  under.addColorStop(0, 'rgba(30,40,30,.3)');
  under.addColorStop(1, 'rgba(30,40,30,0)');
  c.fillStyle = under;
  c.fillRect(bodyLeft, bodyTop, bodyWidth, 14);

  // Oak top with grain, a lit front edge and a darker underside line
  c.fillStyle = oak(c, -half, CABINET.width);
  c.beginPath();
  c.roundRect(-half, top, CABINET.width, SLAB, 3);
  c.fill();
  woodGrain(c, -half, top, CABINET.width, SLAB, 0.31, { density: 3.2 });
  c.fillStyle = 'rgba(255,245,225,.55)';
  c.fillRect(-half + 2, top, CABINET.width - 4, 1.5);
  c.fillStyle = 'rgba(70,40,15,.35)';
  c.fillRect(-half + 2, top + SLAB - 1.5, CABINET.width - 4, 1.5);
}
