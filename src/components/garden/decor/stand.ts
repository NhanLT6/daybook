// Tall, narrow plant hanger stand: the plant shelf's own frame (same legs, planks and oak), only narrower and
// taller, with two planks. Under each plank a brass hook and a jute rope cradle (three cords from a ring down
// to the pot's rim). Drawn in room units with (0, 0) on the floor under its centre; the scene paints the pots.
import type { Ctx } from '../creatures/kit';

import { TAU } from '../creatures/kit';
import { paintFrame, PLANK_THICKNESS } from '../layouts/shelf';

export const STAND = {
  width: 150,
  height: 660,
  // Plank heights above the floor (front edge), and how far each pot's rim hangs below its plank
  beams: [650, 345],
  drop: 92,
};

const JUTE = '#C9AE82';

// Brass S-hook under the plank, a ring, and three cords spreading to the rim
function cradle(c: Ctx, plankY: number, rimY: number, rimHalf: number) {
  const hookTop = plankY + PLANK_THICKNESS,
    ring = hookTop + 18;
  c.strokeStyle = '#B08A3E';
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(0, hookTop + 4, 4, -Math.PI / 2, Math.PI / 2);
  c.arc(0, hookTop + 12, 4, -Math.PI / 2, Math.PI / 2, true);
  c.stroke();
  c.beginPath();
  c.arc(0, ring, 3.5, 0, TAU);
  c.stroke();

  c.strokeStyle = JUTE;
  c.lineWidth = 1.6;
  c.lineCap = 'round';
  for (const x of [-rimHalf, 0, rimHalf]) {
    c.beginPath();
    c.moveTo(0, ring + 3);
    c.lineTo(x, rimY);
    c.stroke();
  }
  // A short wrapped knot under the ring
  c.fillStyle = '#B39466';
  c.beginPath();
  c.roundRect(-3, ring + 3, 6, 9, 2);
  c.fill();
}

// rimHalf: half the pot's opening in room units, so the cords meet its rim
export function paintStand(c: Ctx, rimHalf: number) {
  const { width, height } = STAND;
  c.save();
  c.translate(-width / 2, -height);
  paintFrame(
    c,
    { width, height },
    width * 0.05,
    width * 0.95,
    STAND.beams.map((beam) => height - beam),
    height,
  );
  c.restore();

  for (const beam of STAND.beams) cradle(c, -beam, -beam + STAND.drop, rimHalf);
}
