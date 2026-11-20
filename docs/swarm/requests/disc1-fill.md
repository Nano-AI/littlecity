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

| Socket | Rule | Use |
|---|---|---|
| `seat` / `seat-0`…`seat-3` | U-green (ring bench round the green's tree) | sit under the tree, facing out |
| `activity` / `dance` | U-green (maypole) | the maypole's foot; dancers circle at radius 0.9 |
| `activity` / `fetch-water` | U-wall shops (wall fountain), D horse trough, U-bailey well | stand at the spout or trough, fill a pail, water a horse |
| `activity` / `vend` | U-wall shops (arched booth), U market cross | a vendor stands behind the counter / sits on the steps |
| `activity` / `browse` | U-wall shops (booth) | a customer stands in front of the booth |
| `activity` / `hang-washing` | U-drying green (each line), U-burgage plot washing pole | peg out washing |
| `line-anchor` (existing) | U-drying green | each end of a washing line |
| `activity` / `pick` | U-orchard (ladder foot) | a picker climbs or stands at the ladder |
| `activity` / `basket` | U-orchard (basket) | drop fruit in the basket |
| `activity` / `ford` | U-ford (each bank end) | the two ends of a stepping-stone crossing |

The final list is below under "Shipped" once each item is committed.

## The ford and the walking graph

The stepping stones are a prop over water. The walking graph
(`src/resolve/nav.ts`, the life builder's now) does not know about them: to
let residents cross, it needs a link between the two `activity`/`ford`
sockets' cells at cost about 3 (like grass), drawn as hopping. I do not edit
nav. If you add the link, read the sockets of name `ford` in pairs: both
carry the same `owner` prop id.

## Dropped items

LF-01 to LF-05 were dropped from my list before I started them; nothing of
them is on my branch.

## Shipped

(filled in as items are committed)
