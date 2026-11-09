# Canvas 2D art guide: plants, light and shadow

What we learned drawing the Daybook garden (`src/components/garden/`), written so another project can reuse the
ideas or lift the code without researching it again. Everything is plain Canvas 2D, no libraries. Each section says
the rule first, then where the working code lives, then a small snippet you can copy.

## 1. Ground rules that made it read as real

- **One light, one direction.** Every painter assumes the same light (here: from the upper left in a plant's own
  space, `LIGHT` in `plants/kit.ts`). If the scene's light comes from the other side, mirror the whole painting
  (`scale(-1, 1)`) instead of writing a second painter. Mixed light directions are the fastest way to look fake.
- **Realistic proportions.** Oversize the hero objects by at most ~15%. Handles, stalks and stems always attach to
  a body; nothing floats.
- **Depth = darker + smaller + behind.** Anything further back is painted first, a little darker and a little
  less saturated. Branches of different trees can interleave; sort pieces by depth, not by tree.
- **Seeded randomness.** Use a tiny seeded random (`seeded()` in `plants/wood.ts`) per object, so a plant looks the
  same every frame and adding one leaf never reshuffles the others.
- **Draw at the right scale.** Detail painters tuned for small things look smooth and plastic on big ones. Paint a
  big object at 1/3 size in a context scaled ×3 and its texture comes out three times bolder (trunks,
  `paintTrunk` in `decor/grove.ts`).
- **Cut, don't squeeze.** A tree taller than the screen runs off the edge and is clipped; never shrink it to fit.
  Hide awkward joins (a trunk meeting the ground) under something natural (a heap of pebbles) instead of a hard
  horizontal cut.
- **Calm palette.** Neutral greys beat warm yellow casts; the plants carry the colour.

```ts
// Park–Miller seeded random: same seed, same sequence
export function seeded(seed: number) {
  let value = Math.floor(seed * 2147483646) % 2147483647 || 1;
  return () => (value = (value * 16807) % 2147483647) / 2147483647;
}
```

## 2. Leaves

Code: `plants/foliage.ts` (`paintFoliageLeaf`, `leafVariety`), used by the snowbell grove and the bougainvillea;
`plants/kit.ts` (`paintLeaf`, `facing`) for the herbaceous plants.

A small leaf stops looking like a flat lozenge when it has:

1. **A short stalk** (~14% of its length), so it hangs from the twig.
2. **A fold along the midrib.** Paint the two halves separately; the half whose outward normal faces the light gets
   `mid → light → mid`, the other `dark → mid → dark`. This one trick does most of the work.
3. **Foreshortening.** A leaf turned away shows narrower: `width × (0.35 + 0.65 × turn)`, turn 0 edge-on .. 1 flat.
4. **A soft contact shadow** offset ~1px down-right at ~16% alpha, so overlapping leaves separate.
5. **Per-leaf hue.** Tint each blade a touch yellower or bluer (±14% alpha). No two leaves are the same green.
6. **No bright outline.** At most a faint dark edge on the shaded half.
7. **A pale midrib** fading toward the tip.
8. **Shade by depth.** Leaves on the far side of the twig, or on branches further back, get a dark overlay
   (`shade`, up to 50%).

Placement along a twig: alternate sides at uneven steps, crowd them toward the tip (new growth), let gravity pull
each one down a little and the light turn it up, and paint far leaves before near ones.

Herbaceous leaves (monstera, anthurium, orchid): tilt them toward or away from the viewer rather than drawing them
flat in 2D. `facing(depth, angle)` swings front leaves down toward us and tips back ones away, shortens both and
shades the back ones.

```ts
// Which half of a leaf faces the light (LIGHT is a unit vector toward the light, in the leaf's parent space)
const upperLit = LIGHT.x * Math.sin(angle) - LIGHT.y * Math.cos(angle) > 0;
for (const side of [-1, 1]) {
  const lit = (side === -1) === upperLit;
  const g = c.createLinearGradient(stalk, 0, stalk + blade, 0);
  g.addColorStop(0, lit ? tone.mid : tone.dark);
  g.addColorStop(0.55, lit ? tone.light : tone.mid);
  g.addColorStop(1, lit ? tone.mid : tone.dark);
  half(c, stalk, blade, width, side); // bezier half-blade from base to tip
  c.fillStyle = g;
  c.fill();
}
```

## 3. Wood, trunks and branches

Code: `plants/wood.ts` (`paintLimb`, `bezier`), `decor/grove.ts`.

- A limb is a **real outline** built from samples along a cubic curve (not a thick stroke), tapering from base to
  tip with a slight swell near the base and soft lumps along the way.
- Shade it **across its width** toward the light, then add bark: fissures along the length, a few knots and
  lenticels. A `rough` value goes from smooth skin to deeply fissured old bark.
- `gnarl` makes the centre line wander in small kinks (pinned at both ends) for old twisted wood.
- Trunks of a multi-stem tree: start close together at one spot, each wavering on the way up (random bends, not
  straight lines) and leaning outward.
- Branches arch up a little before running out; side twigs end in sprays of leaves; lower branches are longer,
  the crown's top short.
- Woody plants share one leaf painter, so trees and shrubs look like the same world.

## 4. Light

Code: `gardenScene.ts` (frame order), `layouts/room.ts` (`paintLightMap`, `paintSun`, `paintScallop`),
`layouts/daylight.ts` (time of day).

**Paint the scene flat, then light it with a light map.** The backdrop and the plants are painted in their own
colours. A separate canvas holds the light: white where fully lit, a darker/coloured tone where in shade. Each frame
it is drawn over everything with `globalCompositeOperation = 'multiply'`. Benefits: one place controls all
lighting, the light direction can't drift between painters, and time of day is just a different map.

Frame order that worked:

1. backdrop (cached per size/theme/day part)
2. shadows on the wall
3. pots, plants, creatures
4. light map, `multiply`
5. grade (one colour over everything for the time of day), `multiply`
6. warm lamp at dusk, `soft-light`
7. glow layer (lamp lenses, scallops), `screen`, night only

**Time of day** (`daylight.ts`): each part sets the sun's colour, strength and slant, how dark the far side of the
room gets, shadow alpha and length, a rim colour on leaves facing the light, and the grade. Morning: low cool-white
sun reaching far in. Noon: short, crisp. Golden: warm and long. Dusk: no sun, warm lamps.

**Rim light**: baked into the cached plant bitmap: the edge pixels facing the light get a thin bright rim.

**Night**: a colour-matrix filter (`NIGHT_MATRIX`, an SVG `feColorMatrix`) shifts the whole scene toward cool
moonlight instead of repainting everything.

### Ceiling spotlights near a wall (wall scalloping)

Researched for the night lamps. How a downlight close to a wall really looks:

- The cone cuts the wall in a curved **arch** (a hyperbola), its rounded apex a little below the fixture.
- Brightest just under the apex, fading downward (inverse square); the top edge is fairly crisp, softer lower down.
- The wall **above** the arch stays dark.
- The beam itself is **invisible** in clean air: don't draw a haze cone. Only a small glare at the lens.
- A pool where the beam lands on the floor, and a faint wide bounce off the lit wall.

Sources: [Nora Lighting: wall washing vs grazing vs scalloping](https://noralighting.com/what-is-the-difference-between-wall-washing-wall-grazing-and-wall-scalloping/),
[LRC: wall washing](https://www.lrc.rpi.edu/patternbook/techniques/wall_washing.asp).

```ts
// Scallop outline: half-width at depth d below the apex. bend (a) rounds the top, spread is the cone's slope.
const widthAt = (d: number) => spread * Math.sqrt((d + a) ** 2 - a * a);
c.beginPath();
c.moveTo(x, apex);
for (let y = apex; y <= floor; y += 6) c.lineTo(x + widthAt(y - apex), y);
for (let y = floor; y >= apex; y -= 6) c.lineTo(x - widthAt(y - apex), y);
c.closePath();

// Fill: radial falloff from the apex, soft edge from a blur filter
const falloff = c.createRadialGradient(x, apex, 0, x, apex, (floor - apex) * 0.85);
falloff.addColorStop(0, warm(1));
falloff.addColorStop(0.08, warm(0.95));
falloff.addColorStop(0.3, warm(0.5));
falloff.addColorStop(0.65, warm(0.16));
falloff.addColorStop(1, warm(0));
c.filter = 'blur(5px)';
c.fillStyle = falloff;
c.fill();
```

At night indoors the lamps are the main light, so the room should read brighter than outside: give the room an
even warm fill (light bounced off walls and floor) and leave the outdoors in its cooler moonlight, with a little
lamplight spilling out past the doorway (`paintNightMap`).

Paint this into the light map with `lighten` (so it brightens the night map without washing out what is already
lit), and a weaker copy into the `screen` glow layer.

## 5. Shadows

Code: `gardenScene.ts` (`shadowOf`), `layouts/room.ts` (`silhouette`, `paintLeafShade`, `nightShadow`,
`floorShadow`).

- **Cast shadows from silhouettes.** Draw the object's bitmap into a small canvas, then fill with
  `source-in` in a dark grey: you get its exact silhouette for free. Cache it per bitmap. Draw it offset away from
  the light at low alpha (~0.15–0.3) before the object itself.
- **Quarter resolution is a free blur.** Making the silhouette canvas 1/4 size and scaling it back up gives soft
  edges at no cost (tree shadows).
- **Shadows move with their object**: draw them with the same sway as the plant or branch.
- **Direction follows the light.** Day: away from the courtyard sun, length per time of day. Night under a ceiling
  lamp: almost straight down, leaning away from the nearest lamp.
- **Contact shadows** under feet, pots and furniture: a flat, soft ellipse on the floor (`floorShadow`).
- **Moving leaf dapple** on the ground: a few soft blob sprites, squashed for perspective, nudged with slow sines of
  different speeds and phases.
- Small shadows on every pebble (lower left) with a highlight on the opposite side make a gravel bed read as 3D.

```ts
// Soft silhouette of any drawn bitmap, for a cast shadow
function silhouette(source: HTMLCanvasElement) {
  const shadow = document.createElement('canvas');
  shadow.width = Math.max(1, Math.ceil(source.width / 4));
  shadow.height = Math.max(1, Math.ceil(source.height / 4));
  const s = shadow.getContext('2d')!;
  s.drawImage(source, 0, 0, shadow.width, shadow.height);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = 'rgb(30,34,40)';
  s.fillRect(0, 0, shadow.width, shadow.height);
  return shadow;
}
```

## 6. Motion and performance

- **Cache what doesn't move.** Backdrop once per size/theme/time of day; each plant, trunk and branch as its own
  bitmap. Per frame you only `drawImage` cached pieces with a small rotation.
- **Wind**: rotate each branch bitmap around its joint by a few degrees (`~1.7°` max) using a sum of two sines at
  different speeds, more toward the tips. Trunks don't sway.
- Fireflies, moths, bees: one file per creature with a shared contract (`creatures/kit.ts`); cap how many are on
  screen.

## 7. Reusing this in another project

The painters are plain functions taking a `CanvasRenderingContext2D` with (0, 0) at the object's anchor. The
pieces that travel well with no Daybook dependencies:

- `plants/wood.ts`: `seeded`, `bezier`, `paintLimb` (bark)
- `plants/foliage.ts`: `paintFoliageLeaf`, `leafVariety` (needs `LIGHT` from `plants/kit.ts`)
- `decor/courtyard.ts`: pebble bed and pebble heap
- `decor/grove.ts`: a multi-stem tree cut into sortable, swayable pieces
- `layouts/room.ts`: `silhouette`, `paintScallop` and the light-map approach
