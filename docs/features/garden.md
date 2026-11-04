# Garden

Canvas 2D mini game on the dedicated `/garden` page, available on desktop and mobile.
Garden is opt-in (`showGarden` defaults to `false`); Settings enables the page link in navigation.
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

`gardenScene.ts` is the engine: frame loop, plant bitmaps, landing spots, water, digging, night tint. It never
knows about a shelf; it asks its `layout` (default `shelfLayout`).

## Layouts
- A slot carries the **plant index** in the garden state, so the same plant shows in every layout that places
  that index (watering in one shows in all).
- `balcony.ts`: the original shelf centered against a balcony's back wall, with an open railing on the left and glass door on the right. It composes `shelfLayout` in a 340×620 frame (same plank/leg painters, taller legs and enough headroom for grown plants); shelf painting, pot indices, shapes and hanging room come from the existing shelf. The balcony uses a single perspective camera in metres (2m wide, 2.4m high, 1.8m deep; 1.05m railing; 2.15m glazing). The rack is about 95cm wide and 1.3m high, with its front feet and watering can on the same floor plane. Its scale follows its physical size at its depth rather than filling the screen. Rail members terminate at the back wall; door panes and reflections are inset in the same wall plane. Plants, tools and creatures use the regular scene renderer again. The background uses simple architectural planes, without material textures. Daylight enters at upper left, with a gentle sheltered shade at upper right. Rail shadows project along a shared sun direction onto the floor (clipped to that plane), with soft edges; lighting and shadows are cached with the backdrop on resize/theme changes.
- `shelf.ts`: three planks on the original legs, 9 slots (3 per tier). The former floor slots 3–5 move onto the bottom plank, preserving plant indices. Hanging room stops above the next tier or floor. `row.ts`: `rowLayout(count)`, 1–3 pots in a row on the surface, no
  scenery; it uses the first `count` slots, so adding pots later keeps the plant already in pot 1.
- The user picks one in Settings → Garden (`settingsStore.gardenLayout`, default `shelf`). The choices live in
  `layouts/index.ts` (`GARDEN_LAYOUTS`: label, canvas height, factory); 2 or 3 plants is one more entry there.
  The earlier `japanese` preference migrates to `shelf`, without changing saved plants or drops.
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
