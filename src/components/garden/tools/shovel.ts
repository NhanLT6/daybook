import type { Ctx } from '../creatures/kit';

// Garden trowel standing on its blade tip (0, 0), handle up: wooden grip, steel blade lit from the left
export function paintShovelShape(c: Ctx) {
  const wood = c.createLinearGradient(-2, 0, 2, 0);
  wood.addColorStop(0, '#D9A872');
  wood.addColorStop(1, '#8E5E33');
  c.fillStyle = wood;
  c.beginPath();
  c.roundRect(-1.6, -44, 3.2, 26, 1.6);
  c.fill();
  c.fillStyle = '#6F7475';
  c.fillRect(-1.2, -20, 2.4, 5);

  const steel = c.createLinearGradient(-6, 0, 6, 0);
  steel.addColorStop(0, '#E4E7E8');
  steel.addColorStop(0.45, '#B9BEC0');
  steel.addColorStop(1, '#7C8285');
  c.fillStyle = steel;
  c.beginPath();
  c.moveTo(-5.5, -16);
  c.lineTo(5.5, -16);
  c.quadraticCurveTo(6.5, -6, 0, 0);
  c.quadraticCurveTo(-6.5, -6, -5.5, -16);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(40,45,50,.35)';
  c.lineWidth = 0.6;
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.5)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-3, -14);
  c.quadraticCurveTo(-3.6, -8, -1, -3);
  c.stroke();
}
