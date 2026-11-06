// Cream enamel espresso machine with a cup under the spout, and a jar of beans beside it.
// Drawn in room units with (0, 0) at the middle of the cabinet top.
import type { Ctx } from '../creatures/kit';
import type { Decor } from './index';

import { TAU } from '../creatures/kit';
import { seeded } from '../plants/wood';
import { chrome } from './materials';

const MACHINE_X = 40;
const ENAMEL = ['#FBF5E8', '#EADFC8', '#CDBD9C'];

function enamel(c: Ctx, x: number, w: number) {
  const body = c.createLinearGradient(x, 0, x + w, 0);
  body.addColorStop(0, ENAMEL[1]);
  body.addColorStop(0.2, ENAMEL[0]);
  body.addColorStop(0.7, ENAMEL[1]);
  body.addColorStop(1, ENAMEL[2]);
  return body;
}

function softShadow(c: Ctx, x: number, w: number) {
  const shadow = c.createRadialGradient(x, 0, 0, x, 0, w);
  shadow.addColorStop(0, 'rgba(40,30,20,.32)');
  shadow.addColorStop(1, 'rgba(40,30,20,0)');
  c.save();
  c.scale(1, 0.12);
  c.fillStyle = shadow;
  c.fillRect(x - w, -w, w * 2, w * 2);
  c.restore();
}

// Small cup; `upsideDown` for the ones warming on top of the machine
function cup(c: Ctx, x: number, base: number, upsideDown = false) {
  const top = base - 18;
  const china = c.createLinearGradient(x - 11, 0, x + 11, 0);
  china.addColorStop(0, '#E9E6E0');
  china.addColorStop(0.3, '#FFFFFF');
  china.addColorStop(1, '#C9C5BD');
  c.fillStyle = china;
  c.beginPath();
  if (upsideDown) {
    c.moveTo(x - 7, top);
    c.lineTo(x + 7, top);
    c.lineTo(x + 11, base);
    c.lineTo(x - 11, base);
  } else {
    c.moveTo(x - 11, top);
    c.lineTo(x + 11, top);
    c.quadraticCurveTo(x + 10, base, x + 6, base);
    c.lineTo(x - 6, base);
    c.quadraticCurveTo(x - 10, base, x - 11, top);
  }
  c.closePath();
  c.fill();
  if (upsideDown) return;

  // Handle, crema and saucer
  c.strokeStyle = '#D9D5CD';
  c.lineWidth = 2.4;
  c.beginPath();
  c.arc(x + 12, top + 7, 4.5, -1.3, 1.3);
  c.stroke();
  c.fillStyle = '#7A4A2A';
  c.beginPath();
  c.ellipse(x, top + 1, 10, 2.2, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#F2EFE9';
  c.beginPath();
  c.ellipse(x, base + 1, 16, 2.6, 0, 0, TAU);
  c.fill();
}

function gauge(c: Ctx, x: number, y: number) {
  c.fillStyle = chrome(c, x - 15, 30);
  c.beginPath();
  c.arc(x, y, 15, 0, TAU);
  c.fill();
  c.fillStyle = '#FBFAF6';
  c.beginPath();
  c.arc(x, y, 11.5, 0, TAU);
  c.fill();
  c.strokeStyle = '#6b6560';
  c.lineWidth = 0.8;
  for (let tick = 0; tick <= 8; tick++) {
    const angle = Math.PI * 0.8 + (tick / 8) * Math.PI * 1.4;
    c.beginPath();
    c.moveTo(x + Math.cos(angle) * 8.5, y + Math.sin(angle) * 8.5);
    c.lineTo(x + Math.cos(angle) * 10.5, y + Math.sin(angle) * 10.5);
    c.stroke();
  }
  c.strokeStyle = '#B5432F';
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + 6, y - 6);
  c.stroke();
}

function machine(c: Ctx) {
  softShadow(c, 0, 95);

  // Chrome plinth and drip tray grille
  c.fillStyle = chrome(c, -82, 164);
  c.beginPath();
  c.roundRect(-82, -14, 164, 14, [2, 2, 3, 3]);
  c.fill();
  c.fillStyle = '#3A3D40';
  c.fillRect(-48, -24, 96, 10);
  c.strokeStyle = 'rgba(255,255,255,.25)';
  c.lineWidth = 1;
  for (let x = -44; x <= 44; x += 6) {
    c.beginPath();
    c.moveTo(x, -23);
    c.lineTo(x, -15);
    c.stroke();
  }

  // Enamel body with a recess for the cup
  c.fillStyle = enamel(c, -74, 148);
  c.beginPath();
  c.moveTo(-74, -14);
  c.lineTo(-74, -146);
  c.quadraticCurveTo(-74, -164, -56, -164);
  c.lineTo(56, -164);
  c.quadraticCurveTo(74, -164, 74, -146);
  c.lineTo(74, -14);
  c.lineTo(48, -14);
  c.lineTo(48, -92);
  c.lineTo(-48, -92);
  c.lineTo(-48, -14);
  c.closePath();
  c.fill();
  const recess = c.createLinearGradient(0, -92, 0, -24);
  recess.addColorStop(0, '#A8977A');
  recess.addColorStop(0.25, '#CDBD9E');
  recess.addColorStop(1, '#D8CAAE');
  c.fillStyle = recess;
  c.fillRect(-48, -92, 96, 68);
  // Chrome belt between the control panel and the recess
  c.fillStyle = chrome(c, -74, 148);
  c.fillRect(-74, -100, 148, 8);

  // Controls: pressure gauge, two buttons and the power light's housing
  gauge(c, -38, -130);
  for (const x of [2, 26]) {
    c.fillStyle = chrome(c, x - 8, 16);
    c.beginPath();
    c.arc(x, -130, 8, 0, TAU);
    c.fill();
    c.fillStyle = '#2E2F31';
    c.beginPath();
    c.arc(x, -130, 5.5, 0, TAU);
    c.fill();
  }
  c.fillStyle = '#6A5A48';
  c.beginPath();
  c.arc(52, -130, 3, 0, TAU);
  c.fill();

  // Group head, portafilter with its black handle, twin spouts
  c.fillStyle = chrome(c, -20, 40);
  c.fillRect(-20, -92, 40, 12);
  c.beginPath();
  c.roundRect(-24, -80, 48, 10, [0, 0, 4, 4]);
  c.fill();
  const handle = c.createLinearGradient(0, -80, 0, -70);
  handle.addColorStop(0, '#4A4A4C');
  handle.addColorStop(1, '#151517');
  c.fillStyle = handle;
  c.beginPath();
  c.moveTo(-24, -79);
  c.lineTo(-84, -82);
  c.quadraticCurveTo(-92, -77, -84, -71);
  c.lineTo(-24, -71);
  c.closePath();
  c.fill();
  c.fillStyle = '#9aa1a8';
  c.fillRect(-7, -70, 3, 5);
  c.fillRect(4, -70, 3, 5);

  cup(c, 0, -24);

  // Steam wand on the right, with its knob
  c.strokeStyle = chrome(c, 60, 16);
  c.lineWidth = 3.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(70, -112);
  c.quadraticCurveTo(84, -90, 80, -46);
  c.stroke();
  c.fillStyle = '#2E2F31';
  c.beginPath();
  c.roundRect(64, -122, 12, 10, 3);
  c.fill();

  // Cup warmer rail and two cups resting upside down on top
  c.strokeStyle = chrome(c, -66, 132);
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-66, -164);
  c.lineTo(-66, -174);
  c.lineTo(66, -174);
  c.lineTo(66, -164);
  c.stroke();
  cup(c, -28, -164, true);
  cup(c, 0, -164, true);

  // Gloss along the enamel's left side
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.fillRect(-68, -150, 4, 120);
}

// Glass jar of coffee beans, cork lid
function beanJar(c: Ctx, x: number) {
  softShadow(c, x, 40);
  c.fillStyle = 'rgba(225,235,235,.45)';
  c.beginPath();
  c.roundRect(x - 24, -78, 48, 78, 8);
  c.fill();
  const random = seeded(0.47);
  for (let i = 0; i < 70; i++) {
    const bx = x - 19 + random() * 38,
      by = -6 - random() * 50;
    c.fillStyle = random() < 0.5 ? '#5B3520' : '#6E4429';
    c.beginPath();
    c.ellipse(bx, by, 3.4, 2.3, random() * TAU, 0, TAU);
    c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.fillRect(x - 19, -72, 3, 62);
  const cork = c.createLinearGradient(x - 22, 0, x + 22, 0);
  cork.addColorStop(0, '#C9A579');
  cork.addColorStop(0.3, '#E1C196');
  cork.addColorStop(1, '#A9845A');
  c.fillStyle = cork;
  c.beginPath();
  c.roundRect(x - 21, -92, 42, 16, 4);
  c.fill();
}

export const espresso: Decor = {
  paint(c) {
    beanJar(c, -140);
    c.save();
    c.translate(MACHINE_X, 0);
    machine(c);
    c.restore();
  },
  // The power light glows at night
  lit(c, dark) {
    if (!dark) return;
    const x = MACHINE_X + 52,
      y = -130;
    const glow = c.createRadialGradient(x, y, 0, x, y, 14);
    glow.addColorStop(0, 'rgba(255,170,70,.9)');
    glow.addColorStop(0.25, 'rgba(255,150,60,.35)');
    glow.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = glow;
    c.fillRect(x - 14, y - 14, 28, 28);
  },
};
