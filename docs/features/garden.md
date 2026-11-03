# Garden

Canvas 2D mini game at the bottom of Insights. Everything it paints lives in its own folder under
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
- `shelf.ts`: two planks + floor, 9 slots. `row.ts`: `rowLayout(count)`, 1–3 pots in a row on the surface, no
  scenery; it uses the first `count` slots, so adding pots later keeps the plant already in pot 1.
- The user picks one in Settings → Garden (`settingsStore.gardenLayout`, default `one`). The choices live in
  `layouts/index.ts` (`GARDEN_LAYOUTS`: label, canvas height, factory); 2 or 3 plants is one more entry there.
  `GardenPanel` rebuilds the scene when the choice changes. Plants in slots the layout does not show are kept.

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
