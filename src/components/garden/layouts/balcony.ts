import type { Ctx } from '../creatures/kit';
import type { GardenLayout } from './kit';

import { shelfLayout } from './shelf';

// Metres: a compact balcony, a normal sliding door, and a three-tier plant stand.
// Every architectural edge uses the same camera, including railing endpoints and glazing insets.
export const BALCONY = {
  halfWidth: 1,
  depth: 1.8,
  height: 2.4,
  eyeHeight: 1.5,
  railHeight: 1.05,
  doorHeight: 2.15,
  shelfWidth: 1.05,
  shelfDepth: 1.5,
} as const;
const SHELF_WIDTH = 340;
const SHELF_HEIGHT = 620;
type Point3 = [number, number, number];
type Point = { x: number; y: number };

export function createBalconySpace(width: number, height: number) {
  const backScale = Math.min(width * 0.3, (height * 0.68) / BALCONY.height);
  const landscape = Math.min(1, Math.max(0, (width / height - 0.5) / 0.5));
  const backFloor = height * (0.65 + landscape * 0.15);
  const horizon = backFloor - BALCONY.eyeHeight * backScale;
  // Keep the near roof and floor edges beyond the viewport, including portrait screens.
  const nearScale = Math.max(
    width * 0.62,
    ((height - horizon) / BALCONY.eyeHeight) * 1.1,
    (horizon / (BALCONY.height - BALCONY.eyeHeight)) * 1.1,
  );
  const cameraDistance = (BALCONY.depth * backScale) / (nearScale - backScale);
  const focalLength = nearScale * cameraDistance;
  const scaleAt = (depth: number) => focalLength / (cameraDistance + depth);
  const project = ([x, y, depth]: Point3): Point => ({
    x: width / 2 + x * scaleAt(depth),
    y: horizon + (BALCONY.eyeHeight - y) * scaleAt(depth),
  });
  const floor = project([0, 0, BALCONY.shelfDepth]);
  const scale = (scaleAt(BALCONY.shelfDepth) * BALCONY.shelfWidth) / SHELF_WIDTH;
  return {
    project,
    scaleAt,
    shelf: { scale, x: floor.x - (SHELF_WIDTH * scale) / 2, y: floor.y - (SHELF_HEIGHT * 0.925 + 4) * scale },
  };
}

function paintBalcony(c: Ctx, width: number, height: number) {
  const { project, scaleAt, shelf } = createBalconySpace(width, height);
  const back = BALCONY.depth,
    ceiling = BALCONY.height;
  const plane = (points: Point3[], color: string) => {
    c.fillStyle = color;
    c.beginPath();
    points.map(project).forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fill();
  };
  const rightPlane = (from: number, to: number, bottom: number, top: number, color: string) =>
    plane(
      [
        [1, top, from],
        [1, top, to],
        [1, bottom, to],
        [1, bottom, from],
      ],
      color,
    );
  const leftBeam = (bottom: number, top: number, color: string) => {
    plane(
      [
        [-0.98, top, 0],
        [-0.98, top, back],
        [-1.02, top, back],
        [-1.02, top, 0],
      ],
      '#89948d',
    );
    plane(
      [
        [-0.98, bottom, 0],
        [-0.98, bottom, back],
        [-0.98, top, back],
        [-0.98, top, 0],
      ],
      color,
    );
  };

  // Back to front: sky, enclosure, floor, door, railing, then the freestanding shelf.
  c.fillStyle = '#e5efef';
  c.fillRect(0, 0, width, height);
  plane(
    [
      [-1, ceiling, 0],
      [1, ceiling, 0],
      [1, ceiling, back],
      [-1, ceiling, back],
    ],
    '#e5e3dc',
  );
  plane(
    [
      [-1, 0, back],
      [1, 0, back],
      [1, ceiling, back],
      [-1, ceiling, back],
    ],
    '#f4f2eb',
  );
  plane(
    [
      [-1, 0, 0],
      [1, 0, 0],
      [1, 0, back],
      [-1, 0, back],
    ],
    '#dfddd4',
  );
  rightPlane(0, back, 0, ceiling, '#eae8df');

  // Sunlight crosses the open left edge and fades towards the interior.
  const floorPoints: Point3[] = [
    [-1, 0, 0],
    [1, 0, 0],
    [1, 0, back],
    [-1, 0, back],
  ];
  c.save();
  c.beginPath();
  floorPoints.map(project).forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.closePath();
  c.clip();
  const leftFloor = project([-1, 0, back * 0.6]);
  const rightFloor = project([1, 0, back * 0.6]);
  const floorLight = c.createLinearGradient(leftFloor.x, leftFloor.y, rightFloor.x, rightFloor.y);
  floorLight.addColorStop(0, '#fff5d86b');
  floorLight.addColorStop(0.55, '#fff8e024');
  floorLight.addColorStop(1, '#fff8e000');
  c.fillStyle = floorLight;
  c.fillRect(0, 0, width, height);

  // The sun travels rightwards and slightly towards the viewer. Cast real rail
  // geometry onto y=0, then clip to the floor so shadows never spill over glass or walls.
  const ontoFloor = ([x, y, depth]: Point3): Point3 => [x + y * 0.9, 0, depth - y * 0.24];
  const castShadow = (points: Point3[]) => plane(points.map(ontoFloor), '#48524418');
  const pixelRatio = c.getTransform().a;
  c.filter = `blur(${1.6 * pixelRatio}px)`;
  for (let i = 0; i <= 10; i++) {
    const depth = (back * i) / 10;
    castShadow([
      [-1, 0.1, depth - 0.0065],
      [-1, BALCONY.railHeight, depth - 0.0065],
      [-1, BALCONY.railHeight, depth + 0.0065],
      [-1, 0.1, depth + 0.0065],
    ]);
  }
  for (const [bottom, top] of [
    [0.16, 0.18],
    [0.54, 0.56],
    [BALCONY.railHeight - 0.015, BALCONY.railHeight + 0.02],
  ]) {
    castShadow([
      [-0.98, bottom, 0],
      [-0.98, top, 0],
      [-0.98, top, back],
      [-0.98, bottom, back],
    ]);
  }
  c.restore();

  // The whole sliding-door assembly is contained by the right wall. Panes, reflections,
  // mullion and handle share this plane; the frame meets its own sill, not a separate diagonal.
  rightPlane(0.04, back - 0.08, 0.035, BALCONY.doorHeight + 0.055, '#e9e9df');
  rightPlane(0.07, back - 0.11, 0.075, BALCONY.doorHeight + 0.025, '#899b94');
  const panes: [number, number][] = [
    [0.095, 0.86],
    [0.91, back - 0.135],
  ];
  for (const [start, end] of panes) {
    rightPlane(start, end, 0.1, BALCONY.doorHeight, '#cbdad5');
    // Reflections stay inside each pane in world space.
    rightPlane(start + 0.03, end - 0.03, 0.72, 1.04, '#eaf0eb70');
    rightPlane(start + 0.03, end - 0.03, 1.47, 1.8, '#eaf0eb70');
  }
  rightPlane(0.865, 0.905, 0.075, BALCONY.doorHeight + 0.025, '#f2f1e9');
  rightPlane(0.915, 0.935, 0.96, 1.1, '#697a73');
  plane(
    [
      [0.94, 0.035, 0.04],
      [1.02, 0.035, 0.04],
      [1.02, 0.035, back - 0.08],
      [0.94, 0.035, back - 0.08],
    ],
    '#89968e',
  );

  // The parapet and handrail both end at the back wall. No late wall patch masks
  // the end of the handrail; each upright is seated on the same parapet top.
  plane(
    [
      [-0.96, 0, 0],
      [-0.96, 0, back],
      [-0.96, 0.1, back],
      [-0.96, 0.1, 0],
    ],
    '#c6c7bd',
  );
  plane(
    [
      [-1.04, 0.1, 0],
      [-0.96, 0.1, 0],
      [-0.96, 0.1, back],
      [-1.04, 0.1, back],
    ],
    '#edede5',
  );
  // Far to near, so the nearer posts cover the horizontal members at their junctions.
  leftBeam(0.16, 0.18, '#67736c');
  leftBeam(0.54, 0.56, '#67736c');
  for (let i = 10; i >= 0; i--) {
    const depth = (back * i) / 10;
    const a = project([-1, 0.1, depth]),
      b = project([-1, BALCONY.railHeight, depth]);
    c.strokeStyle = '#606d69';
    c.lineWidth = Math.max(1, 0.013 * scaleAt(depth));
    c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
  }
  leftBeam(BALCONY.railHeight - 0.015, BALCONY.railHeight + 0.02, '#606d69');

  // Broad daylight, not a texture: warm near the opening and gently cooler/darker
  // at the sheltered upper-right corner. The plants and wood already use upper-left highlights.
  const lightRadius = Math.hypot(width, height) * 0.72;
  const daylight = c.createRadialGradient(width * 0.08, height * 0.04, 0, width * 0.08, height * 0.04, lightRadius);
  daylight.addColorStop(0, '#fffce99c');
  daylight.addColorStop(0.45, '#fff9df38');
  daylight.addColorStop(1, '#fff9df00');
  c.fillStyle = daylight;
  c.fillRect(0, 0, width, height);
  const shade = c.createRadialGradient(width, 0, 0, width, 0, lightRadius);
  shade.addColorStop(0, '#35473d2e');
  shade.addColorStop(0.48, '#35473d14');
  shade.addColorStop(1, '#35473d00');
  c.fillStyle = shade;
  c.fillRect(0, 0, width, height);

  c.save();
  c.translate(shelf.x, shelf.y);
  c.scale(shelf.scale, shelf.scale);
  shelfLayout.paintBackdrop(c, SHELF_WIDTH, SHELF_HEIGHT);
  c.restore();
}

export const balconyLayout: GardenLayout = {
  slots(width, height) {
    const { shelf } = createBalconySpace(width, height);
    return shelfLayout.slots(SHELF_WIDTH, SHELF_HEIGHT).map((slot) => ({
      ...slot,
      x: shelf.x + slot.x * shelf.scale,
      soilY: shelf.y + slot.soilY * shelf.scale,
      scale: slot.scale * shelf.scale,
    }));
  },
  paintBackdrop: paintBalcony,
  canHome(width, height) {
    const { shelf } = createBalconySpace(width, height);
    const point = shelfLayout.canHome(SHELF_WIDTH, SHELF_HEIGHT);
    // The can is on the floor beside the lower tier, not on a plank.
    return { x: shelf.x + point.x * shelf.scale, y: shelf.y + point.y * shelf.scale };
  },
  canScale: shelfLayout.canScale,
  toolScale: (width, height) => createBalconySpace(width, height).shelf.scale,
  maxVisitors: 5,
};
