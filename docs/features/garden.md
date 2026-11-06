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
| `decor/` | Room pieces: cabinet, window, items on the cabinet, wood/plaster textures | `Decor` in `decor/index.ts` |

`gardenScene.ts` is the engine: frame loop, plant bitmaps, landing spots, water, digging, night tint. It never
knows about a shelf; it asks its `layout` (default `shelfLayout`).

A new plant starts at stage 1 (seedling with its tag), not 0 (bare soil).

## Layouts
- A slot carries the **plant index** in the garden state, so the same plant shows in every layout that places
  that index (watering in one shows in all).
- `room.ts`: `roomLayout(decor)`, a room corner seen straight on. From the left: a tall narrow hanging stand
  (`decor/stand.ts`, built on the shelf's own `paintFrame`, same oak) with two hanging bowls on brass hooks and
  jute cords (slots 9 and 10, `HANGING_SLOTS`; only `trails` plants are offered there, and their vines may hang
  to the next pot or the floor), the shelf (`shelfLayout`), then a low sage cabinet (`decor/cabinet.ts`) with one
  item on top (`DECOR`: `espresso` or `monitor`) under a big window (`decor/window.ts`) that always shows whole.
  Plastered wall, skirting, oak floor boards. Room units are the shelf's own pixels; one `unit` fits the whole
  room to the canvas. The cabinet, its item and the window are drawn at 0.85 so the plants stay the main thing.
  Narrow screens (phones) get the shelf alone, no stand or cabinet.
  Plants are drawn bigger than their pots (`LayoutSlot.plantScale`, shelf `PLANT_GROW` 1.15, kept moderate): a
  grown plant may reach past the plank above (Nhan's call). Plants that are big in real life (pothos, monstera,
  bougainvillea) also set `Plant.size`, and their fullness is a parameter object at the top of their file
  (`POTHOS`, `MONSTERA`, `BOUGAINVILLEA`: leaves, branches, flowers).
  Light comes from the window on the right (`GardenLayout.lightFromRight`): plants, pots and helpers are painted
  lit from the upper left, so the scene mirrors pots and plants, and room.ts mirrors the shelf, stand and cabinet.
  A slanted sun patch falls from the window across the floor toward the shelf, furniture casts one soft shadow
  to the left, and the room falls off darker to the left. Decor on the cabinet is not mirrored.
  Night: one multiply pass darkens the room toward slate, except the window glass; `Decor.lit` then draws what
  stays bright (monitor screen and its glow, the espresso machine's power light). `paintBackdrop` gets `dark`.
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
