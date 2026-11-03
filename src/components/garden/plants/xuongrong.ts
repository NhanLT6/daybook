import type { Plant } from './kit';

import { glossyBall, paintLeaf } from './kit';

export const xuongrong: Plant = {
  name: 'Cactus',
  done: 'is in bloom',
  flowering: true,
  paint(c, stage, random) {
    const radius = [0, 8, 12, 15, 18][stage];
    const half = radius * 1.08,
      centerY = -half;
    // Barrel profile: flatter top and base than a ball.
    const halfWidth = (y: number) =>
      radius * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y - centerY) / half, 2.6)), 1 / 2.6);
    const body = new Path2D();
    for (let step = 0; step <= 40; step++) {
      const y = centerY - half + (step / 40) * half * 2;
      body.lineTo(-halfWidth(y), y);
    }
    for (let step = 40; step >= 0; step--) {
      const y = centerY - half + (step / 40) * half * 2;
      body.lineTo(halfWidth(y), y);
    }
    body.closePath();
    const across = c.createLinearGradient(-radius, 0, radius, 0);
    across.addColorStop(0, '#4E8F4E');
    across.addColorStop(0.3, '#7DB66A');
    across.addColorStop(0.65, '#3F7D45');
    across.addColorStop(1, '#1F4D2E');
    c.fillStyle = across;
    c.fill(body);

    c.save();
    c.clip(body);
    const down = c.createLinearGradient(0, centerY - half, 0, 0);
    down.addColorStop(0, 'rgba(220,240,170,.22)');
    down.addColorStop(0.5, 'rgba(0,0,0,0)');
    down.addColorStop(1, 'rgba(10,30,15,.4)');
    c.fillStyle = down;
    c.fillRect(-radius, centerY - half, radius * 2, half * 2);
    // Ribs: each groove is a dark crease, each ridge a lit edge, both foreshortened toward the sides.
    const ribs = 14,
      along = (theta: number, y: number) => Math.sin(theta) * halfWidth(y);
    const trace = (theta: number) => {
      c.beginPath();
      for (let step = 0; step <= 30; step++) {
        const y = centerY - half + (step / 30) * half * 2;
        c.lineTo(along(theta, y), y);
      }
    };
    for (let index = 0; index < ribs; index++) {
      const groove = -Math.PI + (index / ribs) * Math.PI * 2,
        ridge = groove + Math.PI / ribs;
      if (Math.cos(groove) > 0) {
        trace(groove);
        c.strokeStyle = `rgba(12,40,20,${0.25 + 0.35 * Math.cos(groove)})`;
        c.lineWidth = 0.5 + 1.4 * Math.cos(groove);
        c.stroke();
      }
      if (Math.cos(ridge) > 0) {
        const lit = Math.sin(ridge) < 0 ? 0.5 : 0.18;
        trace(ridge);
        c.strokeStyle = `rgba(200,235,160,${lit * Math.cos(ridge)})`;
        c.lineWidth = 0.4 + 0.9 * Math.cos(ridge);
        c.stroke();
      }
    }
    c.restore();

    // Areoles with small spine clusters run down each ridge.
    for (let index = 0; index < ribs; index++) {
      const ridge = -Math.PI + ((index + 0.5) / ribs) * Math.PI * 2;
      if (Math.cos(ridge) < 0.2) continue;
      for (let row = 1; row <= 6; row++) {
        const y = centerY - half + (row / 7) * half * 2;
        const x = along(ridge, y);
        c.strokeStyle = 'rgba(245,232,190,.85)';
        c.lineWidth = 0.35;
        for (let spine = 0; spine < 6; spine++) {
          const angle = (spine / 6) * Math.PI * 2 + random() * 0.4,
            length = 1.6 + random() * 1.4;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(angle) * length * Math.cos(ridge), y + Math.sin(angle) * length);
          c.stroke();
        }
        c.fillStyle = 'rgba(250,244,222,.95)';
        c.beginPath();
        c.arc(x, y, 0.65, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Woolly crown where new areoles form.
    const crown = c.createRadialGradient(0, centerY - half + 2, 0, 0, centerY - half + 2, radius * 0.4);
    crown.addColorStop(0, 'rgba(250,244,220,.8)');
    crown.addColorStop(1, 'rgba(250,244,220,0)');
    c.fillStyle = crown;
    c.beginPath();
    c.ellipse(0, centerY - half + 2, radius * 0.4, radius * 0.18, 0, 0, Math.PI * 2);
    c.fill();
    if (stage >= 3) {
      // The bloom opens from an areole anywhere on the upper third, not always the crown.
      const bloomY = centerY - half + 1 + random() * half * 0.6;
      const bloomX = Math.sin((random() - 0.5) * 2.2) * halfWidth(bloomY) * 0.85;
      c.translate(bloomX, bloomY - (centerY - half + 1));
      const top = centerY - half + 1;
      if (stage === 3) {
        glossyBall(c, 0, top - 2, 3, '#F7B4C8', '#DE6C94', '#9E3A62');
        return;
      }
      // One round bloom sitting on top of the body: an outer ring, a lighter inner ring, the centre.
      const petal = { light: '#FFC2D6', mid: '#EC7FA6', dark: '#B2456F' };
      const inner = { light: '#FFE1EA', mid: '#F6A9C3', dark: '#D9709A' };
      for (let index = 0; index < 14; index++) {
        paintLeaf(c, 0, top - 4, (index / 14) * Math.PI * 2 + random() * 0.12, 10, 3.2, petal, 'oval', 0);
      }
      for (let index = 0; index < 9; index++) {
        paintLeaf(c, 0, top - 4, (index / 9) * Math.PI * 2 + 0.3 + random() * 0.12, 6, 2.4, inner, 'oval', 0);
      }
      glossyBall(c, 0, top - 4, 2.6, '#FFF2A8', '#F2C33E', '#C08A1C');
    }
  },
};
