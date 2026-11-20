# disc1-fill: sockets for the life builder

From the fill builder (branch `swarm/disc1-fill`). I add no actors, behaviours
or life rules. Where my props are places things could happen, they declare
sockets, so the life builder can find them with
`socketsOfType(facts, type)` (`src/resolve/facts/plan-index.fact.ts`) on the
dressing plan, or `dressing.sockets`, without touching my files.

All sockets are declared in the dressing stage (decoration and urban rules),
so a life rule sees them in `ctx.dressing.sockets`. Each has `owner` = the
prop's id; its frame comes from the prop part's anchor of the same name
(`+Z` = the way a person there faces), else the slot.

## Types

- `seat` (existing): a person can sit here; `+Z` = the way they face.
- `activity` (new, `src/vocab/fill.vocab.ts`): a person stands here and does
  something. `name` says what; `+Z` faces the work.

## What I emit (`type` / `name`, the rule, what it is for)

| Socket | Rule (prop) | Use |
|---|---|---|
| `seat` / `seat-0`…`seat-3` | U15 village green (`ring-bench` round a tree) | sit under the tree, facing out |
| `seat` / `seat-0`, `seat-1` | U14 burgage plots (`bench`), U16 shops in the wall (`niche-bench`), U23 belvedere (`pergola`, `bench`) | sit |
| `seat` / `seat` | D38 rope swing (`swing/rope`) | a child swings out over the river |
| `activity` / `dance` | U15 village green (`maypole`) | the maypole's foot; dancers circle at radius about 0.9 |
| `activity` / `fetch-water` | U16 (`wall-fountain`), U21 castle bailey (`well`) | fill a pail at the spout or well |
| `activity` / `vend` | U16 (`wall-booth`), D37 market cross (`market-cross`) | a vendor behind the counter / on the cross's step |
| `activity` / `browse` | U16 (`wall-booth`) | a customer in front of the booth |
| `activity` / `hang-washing` | U14 (`washing-pole`), U17 drying green (`drying-line`) | peg out washing |
| `activity` / `basket` | U17 (`basket/washing`), U18 orchard (`basket/apples`) | put washing or fruit in |
| `activity` / `pick` | U18 orchard (`ladder`) | a picker at the foot of the ladder into the tree |
| `activity` / `ford`, `ford-far` | U22 ford (`stepping-stones`) | the two ends of a stepping-stone crossing |

## The ford and the walking graph

The stepping stones are a prop over water. The walking graph
(`src/resolve/nav.ts`, the life builder's now) does not know about them: to
let residents cross, it needs a link between the two `activity`/`ford`
sockets' cells at cost about 3 (like grass), drawn as hopping. I do not edit
nav. If you add the link, read the sockets of name `ford` in pairs: both
carry the same `owner` prop id.

## For the structures builder (marble, FX-01)

U16 (shops in the wall) puts booths, storeroom doors and niche benches
against blank marble walls as props that draw their own arch a few
centimetres proud of the wall, because `src/gen/marble/marble.gen.ts` draws
a wall flush with the cell line and cannot leave a recess. Two things on
your side would make it better:

1. **FX-01**: the owner's example (`disc1-marble-stair`, the platform beside
   the great stair) is still role `keep`, with arrow slits on every other
   ground-storey cell, so U16 leaves it alone (keeps stay castles). Once
   the platform is a podium with a blank wall, U16 dresses it with no
   change. U16 skips roles `keep`, `gatehouse`, `quay-wall`, `temple`,
   `plinth`; any new role you add for a podium is dressed.
2. **A real recess** (optional): a feature on the wall cell, e.g.
   `'recess'` with `cell` + `dir` and `variant: 'arch'`, that the marble
   generator draws as an arched opening 0.5 wide, 0.66 to the crown, 0.18
   deep (the wall face set back inside the arch, a soffit and two reveals).
   U16 would then emit the feature in the shape stage (it would become a
   joinery rule) and its props would stand in the recess with `inset`
   0.18. Until then, the props are the look.

## For the structures builder (R-P01, tree species)

RC-04 orchard: `src/rules/urban/orchards.fact.ts` exports `orchards(facts)`,
which reads only the shape-stage base (kinds, terrain, floors), so a roles
rule may call it. To make orchard trees fruit trees, R-P01 needs one line
before its grove line in `treeSpecies`:

    if (orchards(f).byTree.has(cell)) return 'fruit-tree';

(and the import). U18 already dresses the orchard (mown rows, ladders,
apple baskets, beehives); with the line, the cypresses and bushes in a
planted grid become apple and pear trees.

## For the life builder: the walking graph (`src/resolve/nav.ts`)

Props I added, and how the graph's `FOOTPRINTS` table should treat them (an
unlisted type is a post: clutter in the middle of a cell). I could not edit
the table, so:

- Flat things underfoot are anchored at a **corner slot** (the graph
  ignores corners) and re-centred by their part: `sward`, `paving`,
  `bleaching-sheet`. Nothing needed.
- Runs and ways through: `hedge/wild` is a hedge (already `RUN`); a
  `field-gate` is a gate in a hedge or fence and should be `WAY` (now it
  only steers).
- Wide things that should be `BULK`: `wall-booth`, `store-door`,
  `niche-bench`, `stable`, `hay`, `compost`, `drying-line` (it spans two
  cells along +X), `pergola`, `market-cross` (on a plinth: no effect),
  `stepping-stones` (in water: no effect until the ford link).
- Small solid things (`POST`, the default, is right): `milestone`,
  `wayside-shrine`, `maypole`, `fruit-tree`, `citrus-pot`, `guardian`,
  `basket`, `practice-dummy`, `archery-butt`, `village-sign`, `ring-bench`
  (round a tree, on the tree's cell).
- Links I would like: across a ford (`ford` to `ford-far`, cost about 3,
  hop animation), and up to a belvedere (U23) by a derived stair if you
  want residents on top (the terrace is 2+ storeys up; a stair prop against
  one side, walkable, would do).

## For the structures builder: DC-07 trough and mounting block

Not built. The trigger is a 1 × 1 or 2 × 1 marble block one storey tall by
an inn, smithy or gatehouse door; a one-storey marble block is 0.8 tall,
twice a person, so no prop can turn it into a trough (0.15 tall) or a
three-step mounting block. It needs a marble role (e.g. `trough`,
`mounting-block`) that the marble generator draws low (a trough is a stone
basin 0.2 tall with water; a mounting block three steps 0.06 each). Once a
role exists, a decoration rule can add the water and a 'fetch-water'
socket.

## Dropped items

LF-01 to LF-05 were dropped from my list before I started them; nothing of
them is on my branch.

## Shipped

Branch `swarm/disc1-fill`: FX-03 (fingerposts), FX-04 + U13 country lanes,
U14 burgage plots, U15 village green, U16 shops in the wall, U17 drying
green, U18 orchard, D39 stair guardians (renumbered from D35: the seasons builder's festival lights took D35), U19 stair forecourt, U20 quay
apron, D36 wayside shrine, U21 castle bailey, D37 market cross, D38 rope
swing, U22 ford, U23 belvedere garden. The sockets in the table above are
all live; each fixture under `scenarios/rules/` checks its own.
