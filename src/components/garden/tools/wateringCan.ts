import type { Ctx } from '../creatures/kit';

// Watering can standing on (x, baseY), spout to the upper left
export function paintWateringCan(c: Ctx, x: number, baseY: number, withShadow = true) {
  if (withShadow) {
    c.fillStyle = 'rgba(30,20,40,.25)';
    c.beginPath();
    c.ellipse(x + 3, baseY, 13, 2.6, 0, 0, Math.PI * 2);
    c.fill();
  }
  // Handle first, its ends tucked into the body so it reads as attached
  c.strokeStyle = '#5E9890';
  c.lineWidth = 2.2;
  c.beginPath();
  c.arc(x + 2, baseY - 15, 6, Math.PI, 0);
  c.stroke();
  const metal = c.createLinearGradient(x - 9, 0, x + 9, 0);
  metal.addColorStop(0, '#9CC9C2');
  metal.addColorStop(0.3, '#CFEAE4');
  metal.addColorStop(1, '#4F8A82');
  c.fillStyle = metal;
  c.beginPath();
  c.roundRect(x - 9, baseY - 18, 18, 18, 3);
  c.fill();
  c.strokeStyle = '#5E9890';
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x - 8, baseY - 12);
  c.lineTo(x - 18, baseY - 22);
  c.stroke();
  c.fillStyle = '#4F8A82';
  c.beginPath();
  c.ellipse(x - 19, baseY - 23, 2.4, 1.6, -0.7, 0, Math.PI * 2);
  c.fill();
}
