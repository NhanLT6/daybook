// Shared pieces for garden plants: the Plant contract the scene paints, and the leaf and stem helpers.
// Each plant lives in its own file and is listed in ./index.ts, so adding or removing one is a one-line change.
import type { Ctx } from '../creatures/kit';

export type { Ctx } from '../creatures/kit';
export { glossyBall, TAU } from '../creatures/kit';

export type LeafShape = 'heart' | 'plump' | 'oval';
export interface Tone {
  light: string;
  mid: string;
  dark: string;
}

export interface Plant {
  name: string;
  // Shown when it is fully grown: "<name> <done>"
  done: string;
  // Has flowers that bees and butterflies visit
  flowering?: boolean;
  // stage 1-4; room: plant pixels free below the soil line, for vines that hang over the shelf
  paint: (c: Ctx, stage: number, random: () => number, room: number) => void;
}

export const LIGHT = { x: -0.6, y: -0.8 };

// Painting helpers: every shape is lit from the upper left and shaded toward its base.
export const TONES = {
  deep: { light: '#86B95E', mid: '#4F8C3F', dark: '#2B5A2B' },
  fresh: { light: '#C3DE73', mid: '#82B44C', dark: '#4A7C32' },
  sage: { light: '#9BC797', mid: '#5F9A6D', dark: '#356549' },
  waxy: { light: '#A9D3AE', mid: '#6FA98A', dark: '#3E7563' },
};

export function leafPath(c: Ctx, length: number, width: number, shape: LeafShape) {
  c.beginPath();
  c.moveTo(0, 0);
  if (shape === 'heart') {
    c.bezierCurveTo(-length * 0.14, -width * 1.15, length * 0.55, -width * 1.25, length, 0);
    c.bezierCurveTo(length * 0.55, width * 1.25, -length * 0.14, width * 1.15, 0, 0);
  } else if (shape === 'plump') {
    c.bezierCurveTo(length * 0.1, -width * 1.1, length * 1.02, -width * 0.9, length, 0);
    c.bezierCurveTo(length * 1.02, width * 0.9, length * 0.1, width * 1.1, 0, 0);
  } else {
    c.bezierCurveTo(length * 0.25, -width, length * 0.75, -width, length, 0);
    c.bezierCurveTo(length * 0.75, width, length * 0.25, width, 0, 0);
  }
  c.closePath();
}

export function paintLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  tone: Tone,
  shape: LeafShape = 'oval',
  depth = 0,
  blush: string | null = null,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  leafPath(c, length, width, shape);
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  const across = c.createLinearGradient(0, -width, 0, width);
  across.addColorStop(0, upperLit ? tone.light : tone.dark);
  across.addColorStop(0.5, tone.mid);
  across.addColorStop(1, upperLit ? tone.dark : tone.mid);
  c.fillStyle = across;
  c.fill();

  const along = c.createLinearGradient(0, 0, length, 0);
  along.addColorStop(0, 'rgba(12,40,22,.42)');
  along.addColorStop(0.55, 'rgba(12,40,22,0)');
  c.fillStyle = along;
  c.fill();
  if (blush) {
    const tip = c.createRadialGradient(length, 0, 0, length, 0, length * 0.5);
    tip.addColorStop(0, blush);
    tip.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = tip;
    c.fill();
  }
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill();
  }

  c.strokeStyle = 'rgba(225,245,170,.28)';
  c.lineWidth = 0.7;
  c.stroke();
  if (shape !== 'plump') {
    c.strokeStyle = 'rgba(235,250,205,.32)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(length * 0.06, 0);
    c.quadraticCurveTo(length * 0.5, -width * 0.12, length * 0.88, 0);
    c.stroke();
  }
  c.restore();
}

export function stem(
  c: Ctx,
  fromX: number,
  fromY: number,
  controlX: number,
  controlY: number,
  toX: number,
  toY: number,
  thickness: number,
  color = '#5B7D3A',
) {
  c.strokeStyle = color;
  c.lineWidth = thickness;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(fromX, fromY);
  c.quadraticCurveTo(controlX, controlY, toX, toY);
  c.stroke();
}

// Long arrow blade with two small back lobes and a wavy edge, lit across like every leaf.
export function arrowLeaf(
  c: Ctx,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  tone: Tone,
  depth: number,
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  const edge: [number, number][] = [];
  for (let t = 0.02; t <= 1.0001; t += 0.04) {
    const profile = t < 0.12 ? 0.8 + (t / 0.12) * 0.2 : Math.pow((1 - t) / 0.88, 0.75);
    edge.push([length * t, width * profile * (1 + 0.05 * Math.sin(t * 19))]);
  }
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(-length * 0.02, -width * 0.4, -length * 0.08, -width * 0.8);
  for (const [along, half] of edge) c.lineTo(along, -half);
  for (const [along, half] of edge.slice().reverse()) c.lineTo(along, half);
  c.lineTo(-length * 0.08, width * 0.8);
  c.quadraticCurveTo(-length * 0.02, width * 0.4, 0, 0);
  c.closePath();
  const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
  const across = c.createLinearGradient(0, -width, 0, width);
  across.addColorStop(0, upperLit ? tone.light : tone.dark);
  across.addColorStop(0.5, tone.mid);
  across.addColorStop(1, upperLit ? tone.dark : tone.mid);
  c.fillStyle = across;
  c.fill();
  const along = c.createLinearGradient(0, 0, length, 0);
  along.addColorStop(0, 'rgba(12,40,22,.3)');
  along.addColorStop(0.4, 'rgba(12,40,22,0)');
  c.fillStyle = along;
  c.fill();
  if (depth > 0) {
    c.fillStyle = `rgba(28,46,62,${0.42 * depth})`;
    c.fill();
  }
  c.strokeStyle = 'rgba(225,245,170,.25)';
  c.lineWidth = 0.6;
  c.stroke();
  c.strokeStyle = 'rgba(236,240,150,.6)';
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(length * 0.92, 0);
  c.stroke();
  c.strokeStyle = 'rgba(20,60,30,.18)';
  c.lineWidth = 0.5;
  for (let t = 0.2; t < 0.9; t += 0.12) {
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(length * t, 0);
      c.lineTo(length * (t + 0.08), side * width * 0.7 * (1 - t));
      c.stroke();
    }
  }
  c.restore();
}

// ── Trailing vines ──────────────────────────────────────────────────────────────

export interface Strand {
  x: number;
  drift: number;
  length: number;
  depth: number;
}

// Strands start on the soil near the rim, arch over it and hang down the outside of the pot.
// length is 0-1 of the room below the soil line, so a plant on the top shelf trails much further.
export function makeStrands(random: () => number, count: number): Strand[] {
  return Array.from({ length: count }, (_, index) => ({
    x: ((index + 0.5) / count - 0.5) * 34 + (random() - 0.5) * 4,
    drift: (random() - 0.5) * 12,
    // A mix of long trails and short ones that only just clear the rim
    length: index % 3 === 1 ? 0.25 + random() * 0.2 : 0.6 + random() * 0.4,
    depth: random(),
  }));
}

export function strandAt(strand: Strand, reach: number, t: number) {
  const out = Math.sign(strand.x || 1);
  const edge = Math.max(Math.abs(strand.x), 13);
  // Over the rim, then hanging close to the pot's side, swaying a little as it falls
  const p0 = { x: strand.x * 0.5, y: -2 },
    p1 = { x: out * (edge + 4), y: -7 },
    p2 = { x: out * (edge + 6) + strand.drift * 0.6, y: reach * 0.35 },
    p3 = { x: out * (edge + 1) - strand.drift, y: reach };
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

// The vine itself, thin and slightly darker toward its old end
export function paintStrand(c: Ctx, strand: Strand, reach: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.lineCap = 'round';
  c.beginPath();
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const p = strandAt(strand, reach, t);
    if (t === 0) c.moveTo(p.x, p.y);
    else c.lineTo(p.x, p.y);
  }
  c.stroke();
}
