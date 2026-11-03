// Shared pieces for garden pots: the Pot contract and the painter every pot goes through.
// Each pot lives in its own file and is listed in ./index.ts, so adding or removing one is a one-line change.
import type { Ctx } from '../creatures/kit';

// A pot's outline in plant pixels; (0, 0) is the centre of the soil, the base sits at y = height
export interface Pot {
  width: number;
  height: number;
  // Half-widths at the opening, base and widest point, as a share of width / 2
  top: number;
  bottom: number;
  belly?: number;
  // Height of a rolled clay rim, 0 for none
  rim: number;
  // light, mid, dark: lit from the left
  colors: [string, string, string];
}

function potShape(c: Ctx, pot: Pot) {
  const half = pot.width / 2,
    topHalf = half * pot.top,
    bottomHalf = half * pot.bottom;
  const bellyHalf = half * (pot.belly || 1);
  c.beginPath();
  c.moveTo(-topHalf, 0);
  c.bezierCurveTo(-bellyHalf, pot.height * 0.45, -bottomHalf - 2, pot.height, -bottomHalf, pot.height);
  c.quadraticCurveTo(0, pot.height + 3.2, bottomHalf, pot.height);
  c.bezierCurveTo(bottomHalf + 2, pot.height, bellyHalf, pot.height * 0.45, topHalf, 0);
  c.closePath();
}

function sideGradient(c: Ctx, half: number, colors: string[]) {
  const gradient = c.createLinearGradient(-half, 0, half, 0);
  gradient.addColorStop(0, colors[1]);
  gradient.addColorStop(0.22, colors[0]);
  gradient.addColorStop(0.6, colors[1]);
  gradient.addColorStop(1, colors[2]);
  return gradient;
}

// Paints the pot with its shadow and soil, origin at the soil centre. The plant is painted on top afterwards.
export function paintPot(c: Ctx, pot: Pot) {
  const half = pot.width / 2;
  // Soft cast shadow toward the lower right, then a tight dark core where the pot meets the surface.
  c.save();
  c.translate(half * 0.35, pot.height + 1.5);
  c.scale(1, 0.22);
  const cast = c.createRadialGradient(0, 0, 1, 0, 0, half * 1.6);
  cast.addColorStop(0, 'rgba(30,20,30,.32)');
  cast.addColorStop(1, 'rgba(30,20,30,0)');
  c.fillStyle = cast;
  c.beginPath();
  c.arc(0, 0, half * 1.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
  const bottomHalf = half * pot.bottom;
  c.save();
  c.translate(0, pot.height + 1.2);
  c.scale(1, 0.2);
  const core = c.createRadialGradient(0, 0, bottomHalf * 0.5, 0, 0, bottomHalf * 1.25);
  core.addColorStop(0, 'rgba(20,12,20,.55)');
  core.addColorStop(1, 'rgba(20,12,20,0)');
  c.fillStyle = core;
  c.beginPath();
  c.arc(0, 0, bottomHalf * 1.25, 0, Math.PI * 2);
  c.fill();
  c.restore();

  potShape(c, pot);
  c.fillStyle = sideGradient(c, half, pot.colors);
  c.fill();
  c.save();
  potShape(c, pot);
  c.clip();
  const base = c.createLinearGradient(0, pot.height, 0, pot.height * 0.55);
  base.addColorStop(0, 'rgba(30,20,30,.28)');
  base.addColorStop(1, 'rgba(30,20,30,0)');
  c.fillStyle = base;
  c.fillRect(-half * 1.2, 0, half * 2.4, pot.height + 5);
  const shine = c.createLinearGradient(-half * 0.42, 0, -half * 0.22, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,255,255,.32)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = shine;
  c.fillRect(-half, 0, half * 2, pot.height + 5);
  c.restore();

  if (pot.rim) {
    const rimHalf = half * 1.06;
    c.fillStyle = sideGradient(c, rimHalf, pot.colors);
    // Rim bands curve with the opening, the same way the base curves.
    const rimBottom = pot.rim - 2;
    c.beginPath();
    c.moveTo(-rimHalf, 0);
    c.lineTo(-rimHalf, rimBottom);
    c.quadraticCurveTo(0, rimBottom + 3.2, rimHalf, rimBottom);
    c.lineTo(rimHalf, 0);
    c.ellipse(0, 0, rimHalf, 4.2, 0, 0, Math.PI, true);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(60,25,15,.3)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-half * 0.98, rimBottom + 0.6);
    c.quadraticCurveTo(0, rimBottom + 3.6, half * 0.98, rimBottom + 0.6);
    c.stroke();
  }
  const soilHalf = half * pot.top * 0.9;
  const soil = c.createLinearGradient(0, -3, 0, 3);
  soil.addColorStop(0, '#2E2019');
  soil.addColorStop(1, '#5A4130');
  c.fillStyle = pot.colors[2];
  c.beginPath();
  c.ellipse(0, 0, half * pot.top * (pot.rim ? 1.06 : 1), 4.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = soil;
  c.beginPath();
  c.ellipse(0, 0.6, soilHalf, 3.2, 0, 0, Math.PI * 2);
  c.fill();
}
