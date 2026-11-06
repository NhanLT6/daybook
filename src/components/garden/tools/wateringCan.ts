import type { Ctx } from '../creatures/kit';

// Galvanised watering can in a mid gunmetal grey (dark enough to stand out on the shelf, light enough to still
// read as metal), standing on (x, baseY), spout to the upper left
const METAL = { light: '#D2D5D8', mid: '#8F949A', dark: '#565B61', edge: '#62676D' };

export function paintWateringCan(c: Ctx, x: number, baseY: number, withShadow = true) {
  if (withShadow) {
    c.fillStyle = 'rgba(30,20,40,.25)';
    c.beginPath();
    c.ellipse(x + 3, baseY, 13, 2.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Handle first, its ends tucked into the body so it reads as attached
  c.strokeStyle = METAL.edge;
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(x + 2, baseY - 15, 6, Math.PI, 0);
  c.stroke();
  const metal = c.createLinearGradient(x - 9, 0, x + 9, 0);
  metal.addColorStop(0, METAL.mid);
  metal.addColorStop(0.3, METAL.light);
  metal.addColorStop(0.55, METAL.mid);
  metal.addColorStop(1, METAL.dark);
  c.fillStyle = metal;
  c.beginPath();
  c.roundRect(x - 9, baseY - 18, 18, 18, 3);
  c.fill();
  // Rolled rim and a seam band, as on a real tin can
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.fillRect(x - 8, baseY - 18, 16, 1.2);
  c.fillStyle = 'rgba(40,44,50,.25)';
  c.fillRect(x - 9, baseY - 6, 18, 1.2);
  c.strokeStyle = METAL.edge;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x - 8, baseY - 12);
  c.lineTo(x - 18, baseY - 22);
  c.stroke();
  c.fillStyle = METAL.dark;
  c.beginPath();
  c.ellipse(x - 19, baseY - 23, 2.4, 1.6, -0.7, 0, Math.PI * 2);
  c.fill();
}
