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
- `shelf.ts`: two planks + floor, 9 slots. `single.ts`: one pot, centred, no scenery.
- `view` option: the window that owns the canvas. Pass the picture-in-picture window, or its frames stop when
  the Daybook tab goes to the background.

## Floating plant (picture-in-picture)
- Button in the garden's top-right corner (only where `documentPictureInPicture` exists: Chromium 116+,
  Firefox 151+, no Safari). Click it, then tap a plant: `useGardenPip().open(index, theme)` opens a 220×280
  window with a scene using `singleLayout(index)` and `view: pip`. The tap is the user gesture the API needs.
- The window is built by hand (no app CSS there): its own `<style>`, its own night `<filter>`
  (`NIGHT_MATRIX` from the scene) and a small status line. Canvas height follows the window (`height` option
  takes a function).
- Tap in the window waters, same rules as the shelf; replanting stays on the shelf. Digging the plant out on
  the shelf closes the window.
- State is module-level in `useGardenPip` (the browser allows one such window), so the window outlives the
  panel: collapsing Insights or changing page keeps it. Theme is passed as a getter, not a computed, for the
  same reason. The button closes it again.

## Seeds that drift
Plants flagged `drifts` (dandelion) get `Spots.seeds` read from the near-white pixels of their seed heads. The
`seed` creature (both themes) lets one go every few seconds, at most 3 in the air. The painted head keeps a
couple of gaps but never empties, so it does not look bare.

## Open
- A single pot on its own (picture-in-picture, a corner widget) can look plain next to the full shelf. Decide
  later: a bit of scenery in `single.ts` (sill, saucer, light), or more ambient life around one plant.
- Sound (idle / focus background): hook cues where the scene already has events — pour start, water landing,
  grown sparkle, dig — plus ambient per creature. Keep audio out of the paint code.
