# Contract changes, notes and requests from People (Stage 3)

## 1. Changes to frozen files

### `src/resolve/plan.ts`: the walking graph (granted in the brief)

Nothing else used these types. `nodes`, `links`, `nodeAt` keep their meaning.

- `NavSurface`: `'steps'` removed (carved steps are a link, not a surface); `'trail'` added (J08).
- `NavNode` gains `rot?` (a stairs cell: the way its flight climbs) and `passage?` (a gate cell or ground arch: crossed along this direction only).
- `NavLink`: `via` is now the exported `NavVia`; for `'stairs'` and `'steps'`, `a` is the lower end; interior links gain `doorA`, `doorB` (indices into `doors`). `cost` is extra to half of each end's node cost.
- New `NavDoor` (a door feature or a derived roof hatch: structure, cell, dir, the node outside, socket id, main, hatch, drop) and `NavRun` (a single-file stretch with its links and open ends).
- `NavGraph` gains `linkStart` / `linkOf` (adjacency), `doors`, `doorsOf`, `part` (connected part per node), `partFloors` (floor cells per part), `runs`, `runOf`. `EMPTY_NAV` has them all.

`hashDressing` still reads only `nodes` and `links`, so it needed no change.

### `src/resolve/engine/run.test.ts`: one assertion

"the walking graph is built before the life rules" pinned an empty graph
(`{ nodes: [], links: [] }`). It now checks that life rules receive a graph
with node and link arrays. The stage order it was written to pin is unchanged.

## 2. New vocabulary (`src/vocab/people.vocab.ts`)

Actors: `resident/child`, `resident/indoors`; `figure` (gallery only, one variant per pose).
Sockets: `haunt-square|shop|cafe|bench|pier|garden|fountain|viewpoint|visit|night|stoop|play`, `workplace`, `queue-point`, `arrival`, `way-out`.
Signal events (`src/life/people/home.ts`): `residentHome`, `lampReached`, `bellRung`.

The lamplighter's round lives in `L23.jobs.rule.ts`, not in an `L08` file,
so it cannot collide with the Animation owner's L08. **For Animation:** on
`lampReached` light the lamp whose prop id is `lamp`; lamps with no
`workplace` socket naming them (none reachable on foot, or no residents)
never get the event and need the timer.

## 3. Requests

- **Look: the ground-shade picture while things move.** With walkers on
  `bench-2000` the frame rate measured 56.7–59.5 fps on a loaded machine
  against 60.0 with nobody moving; update plus render CPU is 0.3–0.4 ms. The
  difference is the height picture, redrawn every other frame whenever any
  slot moved (23 draw calls a frame instead of 12). One walker costs the same
  as sixty, and smoke or a gull will trigger it too. It also made two tests
  of `tests/e2e/interface.e2e.test.ts` time out (that file leaves about 25
  app pages open, all rendering), until the crowd was drawn 15 times a
  second instead of every frame (`PERSON.drawRate`). Asked: redraw it less
  often for movers than for edits (every fourth frame would be invisible
  under people 0.46 tall), or redraw only the dynamic pool over the cached
  static picture.
- **Houses: a roof hatch.** A terrace no door opens onto is reached through
  the building; the graph derives the hatch (lowest terrace cell) and people
  rise out of the roof there, but nothing is drawn. A `door/hatch` feature
  on that cell with a small trapdoor would finish it.
- **Houses: J06 doors over the sea.** On `bench-2000` the houses along the
  island's edge get their main door on the seaward side (their other sides
  touch neighbours), so nobody can leave them. L21 now keeps such residents
  indoors without spending the cap, but a door onto a party wall's alley or
  a stoop would be a kinder choice than a door onto open water.
- **Dressing: seats.** See `src/life/people/README.md`, "For other owners".
  A `seat` socket's frame should sit at seat height with +Z the way the
  sitter faces. Benches whose seat socket lies in a cell that is not on the
  walking graph (inside a tree's cell, say) are skipped.

## 4. For Animation

- `homeCensus(signals)` and `residentHome` for L07 (README, same section).
- Pop-in or any pass that shows every plan instance will un-hide the
  `resident` stand-ins; the people system hides them again each frame, so
  nothing is needed, but do not animate them.

## 5. After integration with Dressing and Animation

- **Props in walkable cells (for Dressing).** Decoration props are not
  blocks, so the walking graph now reads them from the dressing draft
  (`FOOTPRINTS` in `src/resolve/nav.ts`): `garden-fence`, `hedge`,
  `retaining-wall` and `espalier` at an edge slot cut that side
  (`garden-fence/gate` and `hedge/gap` are ways through); a lamp, signpost,
  boulder or shrub at an edge slot is walked round; a bench, café table,
  street tree, goods stack, cart, kiosk, grazer, flower bed, net rack,
  trough, shed, woodpile or wall fountain makes its side or its cell a last
  resort (never a cut). Corner slots, socket props and line props are
  ignored. **A new prop type is treated as a small post**; add it to the
  table if it is a run or something wide. Asked: a front garden or hedge
  ring always needs its gate or gap, or the household inside is stranded.
- **`NavNode.clutter` and `NavLink.post`** are new optional fields in
  `src/resolve/plan.ts`; `NAV.clutter` and `PEOPLE.laneWide` in the style.
- **Animation's lamp system has one new export**, `deferLamp(stage, propId,
  seconds)` in `src/life/dusk/lamps.system.ts`: a lamp on the lamplighter's
  round stays dark until that many seconds into the evening unless
  `lightLamp` comes first. In a scene HELD at dusk the lamps ahead of the
  lamplighter are therefore still dark; held at night everything is lit.
- **Which lamps are on the round:** lamp posts wherever they stand (streets,
  squares, bridge parapets, pier ends), the ten nearest the biggest square
  that can be walked between. Hanging lanterns and door lanterns are not:
  they light on Animation's timer, as does every post beyond the ten.
- **Window lights** now follow who is home through `setOccupied`.
