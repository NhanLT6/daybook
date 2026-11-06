# Garden

Canvas 2D mini game on the dedicated `/garden` page, available on desktop and mobile.
Garden is opt-in (`showGarden` defaults to `false`, stored under the `gardenEnabled` key: the old `showGarden` key
held an auto-written `true` from when the default was on); Settings enables the page link in navigation.
A direct visit while disabled shows a link to Settings and does not mount the scene.
The garden card fills the available viewport with an 8px inset, without a title, stats or footer. An icon button floats in its upper-right corner. Fullscreen hides app navigation and chat without using the browser Fullscreen API.
Exit fullscreen or Escape restores the UI; leaving the page resets this transient mode. Everything it paints lives in its own folder under
`src/components/garden/`, one file per thing, listed in that folder's `index.ts`:

| Folder | What | Contract |
|---|---|---|
| `plants/` | Species, painted per growth stage 1–4 | `Plant` in `plants/kit.ts`; `paintPlant` in `plants/paint.ts` adds the seed tag |
| `pots/` | Pot shapes and colours | `Pot` + `paintPot` in `pots/kit.ts` |
| `creatures/` | Insects, seeds | `Creature` + `GardenWorld` in `creatures/kit.ts` |
| `tools/` | Watering can, trowel | plain paint functions |
| `layouts/` | Where pots stand + scenery behind them | `GardenLayout` / `LayoutSlot` in `layouts/kit.ts` |
| `decor/` | Room pieces: cabinet, hanging stand, items on the cabinet, wood/plaster textures | `Decor` in `decor/index.ts` |

`gardenScene.ts` is the engine: frame loop, plant bitmaps, landing spots, water, digging, night tint. It never
knows about a shelf; it asks its `layout` (default `shelfLayout`).

A new plant starts at stage 1 (seedling with its tag), not 0 (bare soil).

## Layouts
- A slot carries the **plant index** in the garden state, so the same plant shows in every layout that places
  that index (watering in one shows in all).
- `room.ts`: `roomLayout(decor)`, a cool grey room seen straight on (pale cement-grey walls, light grey-washed
  floor, all furniture in one mid-brown wood darker than the floor, `SHELF_WOOD`), open on the right to a courtyard
  (a light well, about a third of the width): a bare cement back wall (faint horizontal trowel streaks, speckle
  noise), loose grey gravel of mixed sizes (no rake lines), a Japanese bàng (`decor/bang.ts`: straight trunk near
  the right edge, flat tiers of leaf rosettes painted with the plants' own `paintLeaf`) on a bed of bigger pebbles,
  two textured stone slabs beside the room's sill down to the bottom edge, a timber sill and a dark post where the
  room's roof ends. No window, no sky, no lantern. The trunk is in the backdrop; each tier is its own bitmap that
  `paintBehind` turns a little about the trunk every frame (wind, with slow gusts).
  By day, soft leaf shade drifts on the courtyard floor (`paintShade`, drawn every frame under the light map).
  Preview only: localStorage `gardenCourt=bench` adds a bench with 3 outdoor pots (slots 11–13). From the left: a
  low wooden cabinet (`decor/cabinet.ts`, 0.75 scale) with one item (`DECOR`: `espresso` or `monitor`), the shelf
  (`shelfLayout`), then the tall hanging stand (`decor/stand.ts`, the shelf's own `paintFrame`) with two hanging
  bowls (slots 9 and 10, `HANGING_SLOTS`, only `trails` plants). The can stands between shelf and stand. Floor
  boards are all one length, each row's joints a third of a board on (a steady stagger). Narrow screens get the
  shelf alone, still lit from the right.
  Plants are drawn bigger than their pots (`LayoutSlot.plantScale`, shelf `PLANT_GROW` 1.15). Pothos' fullness is
  `POTHOS`, monstera's leaf count `MONSTERA` (7); no plant sets `Plant.size` now (Nhan found bigger too much).
  The bougainvillea gets height from bonsai tiers (`TRUNK` pieces, `PADS` per tier).
  One light source, from above the courtyard (`lightFromRight`: pots, plants, shelf, stand, cabinet and decor are
  painted lit from the upper left and mirrored). A point in the room is lit when its ray, traced back up at the
  part of the day's slant, clears the room's edge; the courtyard is always lit. `paintLight` (the layout's light
  map) is multiplied over everything each frame, plants included: white where lit, toward a shade colour away
  from it, with a soft edge. Sun colour is laid on the lit side in the backdrop.
  Time of day (`layouts/daylight.ts`): by day the room follows the viewer's clock (morning 5–10, noon 10–15,
  golden 15–18:30, dusk after; preview with localStorage `gardenDayPart`). Each `Daylight` sets sun colour,
  strength and slant, the room's shade, plant shadows on the wall (`castShadow` × length/opacity), the leaf rim
  (`rimLight`, baked into cached plant bitmaps) and a grade; dusk has no sun and a warm soft-light lamp glow.
  Dust drifts in the beam (`lightShaft`). The scene checks the clock once a minute. Dark mode is moonlight: the
  same light map in cool slate, plus the night colour filter; `Decor.lit` keeps the espresso power light glowing.
- `shelf.ts`: three planks on the original legs, 9 slots (3 per tier), wood grain from `decor/materials.ts`. The former floor slots 3–5 move onto the bottom plank, preserving plant indices. Hanging room stops above the next tier or floor. `row.ts`: `rowLayout(count)`, 1–3 pots in a row on the surface, no
  scenery; it uses the first `count` slots, so adding pots later keeps the plant already in pot 1.
- The user picks one in Settings → Garden (`settingsStore.gardenLayout`, default `shelf`). The choices live in
  `layouts/index.ts` (`GARDEN_LAYOUTS`: label, canvas height, factory); 2 or 3 plants is one more entry there.
  Options: `shelf` (Coffee corner, espresso), `desk` (Desk corner, monitor), `one`. Unknown older keys (`japanese`,
  balcony) fall back to `shelf`, without changing saved plants or drops.
  `GardenPanel` rebuilds the scene when the choice changes. On the Garden page its canvas fills the available height (`getHeight`), resizing without resetting plant or watering state. Plants in slots the layout does not show are kept.
- `maxVisitors` on a layout caps how many insects are out at once (the row: one per pot, so a lone plant gets one
  visitor at a time). Creatures with `visitor: false` (drifting seeds) don't count.

## Succulents
`plants/rosette.ts` paints echeveria rosettes for every succulent: leaves on the golden angle, built in 3D and
projected, each with a keel, dark rim and a small shadow. `RosetteLook` sets colours, tip blush, bloom, leaf
width and where the leaf is widest; `edge` gives a red margin that is full at the tip, gone by the middle of
the leaf and bleeds inward (red-edged echeveria).

## Seeds that drift
Plants flagged `drifts` (dandelion) get `Spots.seeds` read from the near-white pixels of their seed heads. The
`seed` creature (both themes) lets one go every few seconds, at most 3 in the air. The painted head keeps a
couple of gaps but never empties, so it does not look bare.

## Open
- A single pot on its own can look plain next to the full shelf. Decide later: a bit of scenery in `row.ts`
  (sill, saucer, light), or more ambient life around one plant.
- Floating plant: Document Picture-in-Picture was tried and dropped (the browser keeps a title bar and an opaque
  window). A transparent, frameless desktop plant needs a native shell (Tauri) plus garden state synced through
  the API; planned later, not started.
- Sound (idle / focus background): hook cues where the scene already has events — pour start, water landing,
  grown sparkle, dig — plus ambient per creature. Keep audio out of the paint code.
