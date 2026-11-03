// Shared pieces for garden creatures: the Creature contract the scene runs, the world it hands them, and small math.
// Each creature lives in its own file and is listed in ./index.ts, so adding or removing one is a one-line change.

export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;
export const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
export const between = (low: number, high: number) => low + Math.random() * (high - low);
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const approach = (value: number, goal: number, rate: number, dt: number) =>
  value + (goal - value) * Math.min(1, rate * dt);

// Shiny bead lit from the upper left: berries, flower centres, a bee's pollen basket
export function glossyBall(c: Ctx, x: number, y: number, radius: number, light: string, mid: string, dark: string) {
  const body = c.createRadialGradient(x - radius * 0.35, y - radius * 0.4, radius * 0.1, x, y, radius);
  body.addColorStop(0, light);
  body.addColorStop(0.55, mid);
  body.addColorStop(1, dark);
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,.75)';
  c.beginPath();
  c.ellipse(x - radius * 0.38, y - radius * 0.42, radius * 0.22, radius * 0.14, -0.6, 0, Math.PI * 2);
  c.fill();
}

// A place on a plant, relative to the pot's soil centre in unscaled plant pixels
export interface Spot {
  dx: number;
  dy: number;
  rim?: boolean;
}
export interface Spots {
  tops: Spot[];
  flowers: Spot[];
  inside: Spot[];
  // Seed fluff on plants whose seed heads let go in the wind
  seeds: Spot[];
}
export interface Perch {
  index: number;
  spot: Spot;
}
export interface Goal {
  x: number;
  y: number;
  exit?: boolean;
  perch?: Perch;
}

// One shape for every creature: each uses the fields its own state machine needs
export interface Actor {
  mode: string;
  timer: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  facing: number;
  scale: number;
  visits: number;
  loaded: boolean;
  perch: Perch;
  goal: Goal;
  goalSpot: Spot;
  phase: number;
  theta: number;
  beats: number;
  glide: number;
  bob: number;
  stops: number;
  bask: number;
  yaw: number;
  open: number;
  wings: number;
  stride: number;
  angle: number;
  behind: boolean;
  rounds: number;
  next: string | null;
  kind: number;
  glow: number;
}

export function makeActor(fields: Partial<Actor>): Actor {
  return {
    mode: 'away',
    timer: 1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 1,
    scale: 1,
    visits: 0,
    loaded: false,
    perch: { index: 0, spot: { dx: 0, dy: 0 } },
    goal: { x: 0, y: 0 },
    goalSpot: { dx: 0, dy: 0 },
    phase: 0,
    theta: 1,
    beats: 0,
    glide: 0,
    bob: 0,
    stops: 0,
    bask: 0,
    yaw: 0,
    open: 0,
    wings: 0,
    stride: 0,
    angle: 0,
    behind: false,
    rounds: 0,
    next: null,
    kind: 0,
    glow: 0,
    ...fields,
  };
}

// Steer toward a point with eased velocity; returns the distance left
export function moveToward(actor: Actor, goal: { x: number; y: number }, speed: number, turn: number, dt: number) {
  const dx = goal.x - actor.x,
    dy = goal.y - actor.y,
    distance = Math.hypot(dx, dy) || 1;
  const want = Math.min(speed, distance * 2.4);
  actor.vx = approach(actor.vx, (dx / distance) * want, turn, dt);
  actor.vy = approach(actor.vy, (dy / distance) * want, turn, dt);
  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;
  return distance;
}

// What the scene tells a creature about the shelf and its plants
export interface GardenWorld {
  width: number;
  height: number;
  // Landing places read from a grown plant's pixels (empty below stage 2)
  plantSpots: (index: number) => Spots;
  // Slots holding a plant big enough to land on
  plantedIndices: () => number[];
  flowerSlots: () => number[];
  // Slots holding a plant with seed heads ready to drift away
  seedSlots: () => number[];
  // A spot in scene pixels, riding the plant's sway, plus that row's scale
  spotWorld: (index: number, spot: Spot, time: number) => { x: number; y: number; scale: number };
  // A random spot on the pot rim, and the pot's width in plant pixels
  rimSpot: (index: number) => Spot;
  potWidth: (index: number) => number;
  airPoint: () => Goal;
  // How many of the named creature are on screen now
  onScreen: (name: string) => number;
  exitPoint: () => Goal;
}

export interface Creature {
  // Lets other creatures ask how many of this one are on screen
  name: string;
  // true: shown in dark mode only; false: in light mode only; left out: in both
  night?: boolean;
  // How many of it can be on screen at once
  count: number;
  create: (slot: number) => Actor;
  update: (actor: Actor, world: GardenWorld, dt: number, time: number) => void;
  paint: (c: Ctx, actor: Actor, time: number) => void;
  // Slot whose plant it is behind (painted before that plant), or null when in front
  behindSlot?: (actor: Actor) => number | null;
  // Light it gives off, painted after the night tint so it stays bright
  paintLight?: (c: Ctx, actor: Actor, time: number) => void;
  // Forget shared state when the scene starts the creature over (theme switch)
  reset?: () => void;
}
