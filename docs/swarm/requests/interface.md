# Requests and notes from Interface (Stage 1)

Nothing here blocked the work; each item is worked around locally. One is a
real contract gap (1). The rest are things the other owners should know the
interface now assumes.

## 1. Contract gap: what `Block.rot` means for stairs

`src/core/world.ts` says only "quarter turns; only stairs use it". The
interface has to set it at placement (design section 7: toward the
neighbouring column one level higher, else away from the camera), so it had
to pick a meaning:

> **`rot` is the `Dir4` the flight climbs toward: 0 north (−z), 1 east (+x),
> 2 south (+z), 3 west (−x).** The low end is on the opposite side.

This is what `stairsRot()` in `src/ui/actions.ts` produces, what the Change
tool steps through (`setRot` to `(rot + 1) % 4`), and what the gallery's
stairs specimen and `scenarios/gallery/tray-pieces.scenario.ts` use.

**Asked:** write that sentence on `Block.rot` in `src/core/world.ts` and in
CONTRACTS section 4, so Logic (stair flights merging, the walking graph's
"low side to high side") and the stairs generator (Stage 2) agree with it.
If the other meaning is preferred, `stairsRot()` is the one place to change.

## 2. For Logic: what the interface leaves to `canApply`

The UI holds no placement rules. It asks `canApply` (through `game.edit`)
for every edit and shows the reason string on refusal, so these all rest on
the real rules:

- **Change tool.** It tries `setKind` for the rest of the cycle in order
  (Auto → House → Tower → Lighthouse → Arch → Dock → Auto) and applies the
  first that `canApply` accepts. "Dock only if legal there" therefore needs
  `canApply` to refuse `setKind → dock` away from open water at level 0.
- **Floors under small pieces.** Pointing a floor at a tree, fountain,
  stall, cell fence or cell wall sends `placeFloor` for that block's own
  cell; pointing at the side of an arch sends it for the arch's cell (a
  path through a gateway). `canApply` decides whether that is allowed.
- **Fences and walls on water or on a roof.** The strips of any top face
  send `placeEdge`; the centre sends `placeBlock`.
- **Out of the map** is refused by the UI itself only when there is no cell
  at all to name (above level 31); everything else goes to `canApply`.
- **Refusal reasons are shown to the player** as written, with a capital
  first letter, in a small bubble where they clicked. Short, plain reasons
  read best ("something is already there").
- **Shift-drag runs** call `canApply` per cell and skip the refused ones;
  the whole run is one `pushHistory`.
- `game.poll()` is called once per frame; a test in `src/app/game.test.ts`
  allows the staged resolver up to 20 polls to deliver dressing.

## 3. For Look: what the interface assumes of `TownView`

- **Ghost.** `setGhost` is called only when the hovered target changes, with
  `show` = the one new structure of the what-if plan (once structures merge,
  that is the whole merged house, or the whole fence run), `shimmer` = Auto
  cells whose resolved kind differs between the shown plan and the what-if
  plan, and `refuse` = the target cell with `plan` = the plan now showing.
- **Style changes.** The game's tuning panel calls `game.refresh()`, which
  resolves again and calls `setTown`. Geometry only updates if the renderer
  folds `styleVersion()` into its cache keys (CONTRACTS section 14); the
  Stage 0 stub does not, so palette sliders show nothing in the game today.
  The gallery does not depend on this: it redraws in a fresh view.
- **Postcard.** `makePostcard` calls `view.render(signals)` and copies the
  canvas in the same task, so it works without `preserveDrawingBuffer`.
- **The Change tool's wiggle** uses `stage.liftStructure(id)`, moves the
  handle for 320 ms and releases it.
- **Picking** treats every block as its whole cell, whatever it is drawn
  as. A tree's canopy that overhangs its cell is not clickable there.

## 4. For Animation (Stage 3)

- **F07 Auto markers** are done as a DOM layer over the canvas
  (`src/ui/markers.ts`), hidden for blocks that are behind something. The
  vocabulary also has an `auto-marker` actor; if a drawn-in-the-town marker
  is wanted, the DOM layer can go (`Interface.frame()` is the only caller).
- **F08 Refusal** is done in the DOM: the selected tray button shakes, the
  reason shows at the pointer, the ghost shows `refuse`. No `blockLanded` is
  emitted for a refused edit. "Shakes the ghost" itself is the renderer's.
- **Sound.** The menu's toggle stores `little-city.sound` (`on` / `off`) in
  localStorage and dispatches `window` event `lc:sound` with
  `detail: boolean`. Nothing plays yet.

## 5. Small things

- `src/style/auto.ts` declares no slider ranges, so its four numbers show as
  number boxes in the tuning panel. A third argument to `defineStyle` there
  would make them sliders.
- `tests/e2e/app.e2e.test.ts` (Stage 0) still passes unchanged against the
  real interface.
