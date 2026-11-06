// Slim monitor on an aluminium stand, with a keyboard and mouse in front. The screen shows a small
// Daybook-like week chart, and at night it lights up the wall behind it.
// Drawn in room units with (0, 0) at the middle of the cabinet top.
import type { Ctx } from '../creatures/kit';
import type { Decor } from './index';

import { chrome } from './materials';

const SCREEN = { x: -132, y: -214, w: 264, h: 150 };
const BEZEL = 6;

function display(c: Ctx, dark: boolean) {
  const x = SCREEN.x + BEZEL,
    y = SCREEN.y + BEZEL,
    w = SCREEN.w - BEZEL * 2,
    h = SCREEN.h - BEZEL * 2;
  c.fillStyle = dark ? '#1E242C' : '#F3F5F2';
  c.fillRect(x, y, w, h);

  // Rail on the left, a title line, then a week of sage bars with a target line
  c.fillStyle = dark ? '#2A323C' : '#E2E7E1';
  c.fillRect(x, y, 22, h);
  c.fillStyle = dark ? '#7FC29C' : '#4A8C6A';
  c.beginPath();
  c.arc(x + 11, y + 12, 5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = dark ? '#3A4450' : '#CDD5CC';
  c.fillRect(x + 34, y + 12, 70, 6);
  c.fillRect(x + 34, y + 24, 40, 4);

  const bars = [0.7, 0.9, 0.55, 1, 0.8];
  const chartBottom = y + h - 16,
    chartHeight = h - 58;
  bars.forEach((value, index) => {
    const bx = x + 40 + index * 38;
    c.fillStyle = dark ? '#7FC29C' : '#6FA585';
    c.beginPath();
    c.roundRect(bx, chartBottom - chartHeight * value, 22, chartHeight * value, [3, 3, 0, 0]);
    c.fill();
  });
  c.strokeStyle = dark ? 'rgba(230,234,239,.35)' : 'rgba(40,50,45,.3)';
  c.setLineDash([3, 3]);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + 32, chartBottom - chartHeight * 0.85);
  c.lineTo(x + w - 10, chartBottom - chartHeight * 0.85);
  c.stroke();
  c.setLineDash([]);

  // Faint glare across the glass
  const glare = c.createLinearGradient(x, y, x + w, y + h);
  glare.addColorStop(0, 'rgba(255,255,255,.12)');
  glare.addColorStop(0.4, 'rgba(255,255,255,0)');
  c.fillStyle = glare;
  c.fillRect(x, y, w, h);
}

export const monitor: Decor = {
  paint(c) {
    // Soft contact shadow under stand and keyboard
    c.fillStyle = 'rgba(40,30,20,.18)';
    c.beginPath();
    c.ellipse(0, 0, 150, 6, 0, 0, Math.PI * 2);
    c.fill();

    // Stand: flat foot and a neck that leans back slightly
    c.fillStyle = chrome(c, -48, 96);
    c.beginPath();
    c.roundRect(-48, -7, 96, 7, 3);
    c.fill();
    c.beginPath();
    c.moveTo(-12, -7);
    c.lineTo(12, -7);
    c.lineTo(9, SCREEN.y + SCREEN.h - 10);
    c.lineTo(-9, SCREEN.y + SCREEN.h - 10);
    c.closePath();
    c.fill();

    // Black bezel with a slightly thicker chin
    c.fillStyle = '#1B1D20';
    c.beginPath();
    c.roundRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h + 6, 7);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.12)';
    c.fillRect(SCREEN.x + 4, SCREEN.y + 1, SCREEN.w - 8, 1);

    // Keyboard and mouse in front of the stand
    c.fillStyle = chrome(c, -110, 170);
    c.beginPath();
    c.roundRect(-110, -6, 170, 6, 2);
    c.fill();
    c.fillStyle = 'rgba(60,65,70,.35)';
    for (let key = 0; key < 14; key++) c.fillRect(-104 + key * 11.5, -5, 8, 1.5);
    c.fillStyle = '#E8EAEC';
    c.beginPath();
    c.ellipse(96, -4, 12, 5, 0, 0, Math.PI * 2);
    c.fill();
  },
  lit(c, dark) {
    if (dark) {
      // Cool screen light spilling onto the wall around the monitor
      const cx = SCREEN.x + SCREEN.w / 2,
        cy = SCREEN.y + SCREEN.h / 2;
      const glow = c.createRadialGradient(cx, cy, SCREEN.w * 0.3, cx, cy, SCREEN.w * 1.1);
      glow.addColorStop(0, 'rgba(170,200,230,.22)');
      glow.addColorStop(1, 'rgba(170,200,230,0)');
      c.fillStyle = glow;
      c.fillRect(cx - SCREEN.w * 1.1, cy - SCREEN.w * 1.1, SCREEN.w * 2.2, SCREEN.w * 2.2);
    }
    display(c, dark);
  },
};
