# Requests from Monuments (Stage 2)

Nothing here blocks Monuments; each item has a local workaround in place.
They are things other owners, or the orchestrator at the merge, should know.

## 1. The gallery filter test pins the word "light" to one entry (Interface)

`tests/e2e/gallery.e2e.test.ts` (the last assertions of "lists every
generator…") types `light` into the gallery filter and expects the visible
entries to be exactly `['gen.lighthouse']`. The filter matches a scenario's
name, so a fixture named for its rule, `R-L01.lighthouse`, makes the test
fail; so will any later scenario with "light" in its name (`L07.window-light`,
`L09.lighthouse-beam`).

- **Workaround:** the R-L01 fixture file is `scenarios/rules/R-L01.lighthouse.scenario.ts`
  as the convention asks, but its scenario `name` is just `R-L01`.
  `npm run shots -- 'R-L01*'` still finds it.
- **Request:** make the test filter on a word nothing else will use, or
  assert `toContain('gen.lighthouse')`. Then rename the scenario to
  `R-L01.lighthouse`.

## 2. Features that two owners draw: `cap`, `window`, `door`, `gallery` (Houses)

The vocabulary shares these types between towers and lighthouses (mine) and
houses and windmills (Houses), but discovery allows one part per feature
type. To stay clear of that, the tower and lighthouse generators draw their
own caps, slit windows, doors and galleries directly (`src/parts/monuments/
caps.ts`, `openings.ts`; plain modules, not `*.part.ts`) and do **not** call
the part registry for them. Any other feature found on a tower, lighthouse,
arch or marble structure (a `collar` from J12, a `foundation` from J24, a
`railing` from J19) is passed to the registry at its standard frame.

- So Houses is free to register `cap` (for `mill-cap`), `window`, `door`
  and `gallery` parts; they will not be asked to draw mine.
- **Door and window rules.** J13 gives a tower or lighthouse a main `door`
  only if no rule before it (J06) put one on that structure, and spiral
  `window/slit` features only if the structure has no `window` yet. If J06
  and J09 cover towers and lighthouses, the towers will show whatever those
  rules decide (drawn as tower doors and slit windows); if they do not, J13
  fills in. If J09 puts a window on every tower facade cell the spiral is
  lost: J09 should skip `tower` and `lighthouse` structures.
- **Flower boxes and laundry (Dressing).** Tower slit windows own `window`
  sockets like any other window. A flower box would be too wide for one;
  D09 may want to skip features whose variant is `slit`.

## 3. Chapel and steeple (Houses)

R-T01 draws a belfry and spire on every tower whose role is `steeple`. It
expects R-H01 to set that role on the tower (CONTRACTS section 8, item 6).
If no rule has claimed the tower, R-T01 itself makes a tower of height ≥ 3
touching a house of 2+ cells a steeple, on R-H01's own test, so the pair
reads correctly either way.

## 4. A railing on an arch deck (Ground, J19)

Arch decks carry their own stone parapet on every side that drops away. The
arch generator therefore skips a `railing` feature placed on such a side of
an arch cell, and lets the registry draw one anywhere else on the deck.
Marble has no parapet of its own: a terrace relies on J19 for its
balustrade.

## 5. The hump of a stone bridge and floors laid on it (Ground, J21)

"Slightly humped deck" (R-A01) is drawn as a hump in the parapet and
cornice line only; the walking surface stays at the cell's top, so a path
or cobbles laid on a bridge, and people crossing it, stay on the grid.

## 6. What the structure hash does not cover (Stage 0 / Logic)

`hashStructure` covers features, tags and six face neighbours, which is all
the monument generators read. Two things are pinned by J15 as feature
params for that reason and need no change: the depth of a pier (it reaches
past the neighbourhood) and the shape of an opening that spans several
cells. No widening of the hash is asked for.

## 7. `bollard` is shared with docks (Ground, J23)

R-M05 puts `bollard` features (with their `mooring` sockets) on quay walls.
As with caps and doors, the marble generator draws those itself and does not
ask the registry, so Ground is free to register a `bollard` part for docks.

## 8. Sockets waiting for their owners (Animation, Dressing)

Declared and placed by Monuments, with nothing drawn on them yet:
`lantern` in a lighthouse's lantern room (L09's beam); `bell` in a belfry and
`clock-hands` on each clock face (L29; the faces show fixed hands until
then); `telescope` on an observatory dome (L29); `flag-mount` on every tower
cap and lighthouse gallery (D13); `bridge-end` on a stone bridge's end posts
(D20); `arch-crown` under every arch (D06); `statue-base` on a plinth (D19);
`seat` on grand steps; `mooring` on quay bollards; `perch` on free pillar
tops, turret battlements, dovecotes and galleries.

## 9. A timing test that fails under load (Logic)

`src/terrain/terrain.test.ts` ("every required feature on 200 seeds") runs
for 2 s alone but passed the default 5 s timeout twice during full
`npm run check` runs while other worktrees were busy. It needs an explicit
timeout. Nothing in Monuments touches it.

## 10. Fix pass after art review 1: seams that need the other side

- **Castle stone (Ground, G3).** Castle roles (keep, gatehouse, quay wall) are
  now drawn in `PATTERN.stone` with `rampColor('marble', color)` (the stone
  ramp), trim and quoins in `PALETTE.stoneShade`, string courses 0.05 high and
  0.03 proud, and a corbel table under an oversailing parapet (0.06 out, a
  0.11 kerb, merlons 0.24 wide and 0.15 high centred on the cell lines and
  cell middles, so the solid is as wide as the gap). A castle turret takes the
  palette index of the marble or wall block it touches (index 0 beside a wall
  on a cell edge). The curtain wall already uses `rampColor('wall', color)` on
  the same ramp with `PATTERN.stone`; if G3 gives it merlons 0.24 wide on a
  0.11 kerb the three will match. The values are in `src/style/monuments.ts`.
- **Stilt houses (Houses, H7; Ground).** The supports layer draws four timber
  piles under a house tagged `plank-walls`, or under any house with a dock in
  its own or a side column. To match the pier it reads `dockColors` from
  `src/gen/dock/wood.ts`, `tube` from `src/parts/ground/kit.ts` and `DOCK`
  from `src/style/dock.ts` (read only). If those move, the import in
  `src/gen/support/supports.gen.ts` moves with them.
- **Doors (Houses, H6, J26).** A loggia or sky-bridge deck still needs its
  door from the house side. The arch deck, its balustrade and the covered
  gallery now run 0.1 past the cell line into the house wall, so a door at
  deck level in that wall will meet them.
- **Keep windows and the stair door.** R-M03 emits `window/arched` features
  and R-M04 a `door/plain` on marble; the marble generator draws those itself
  (rules whose id starts `R-M`), and passes any other owner's window or door
  on marble to the part registry as before.
