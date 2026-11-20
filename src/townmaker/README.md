# Grow a town

`growTown(terrain, seed, { avoid?, character? })` (`avoid`: the characters the dice showed already) returns the ordered edits
of a whole town; `planTown` returns the same with what it decided (the
character, the districts, the square). Pure and seeded; every edit passes
`canApply` against the town grown so far (`grower.ts`).

## A town has a character

An island cannot hold every building the game knows, and a town that tries
looks like a catalogue. So each town is one kind of place, with a second
kind flavouring it. `character.ts` rolls them from the seed, weighted by
what the island offers (`islandTraits`: its largest flat square, its
highest ground, how much river, how much coast):

| Character | Leans on | Builds (in priority order) | Leaves out |
|---|---|---|---|
| **Harbour town** | long coast | the square; a great harbour (a galleon berth: eight docks in a row with open sea three wide and a clear lane out; warehouses facing it across the harbour street; a pier, stilt houses, a boathouse, a quay wall); the lighthouse; housing and a courtyard block; the chapel; a smithy; crossings over water | castle, temples, mills, fields, farms |
| **Marble city** | a broad flat site | the forum (below); the acropolis (a second temple up its grand steps, the campanile, a belvedere); the folly; fine housing and courtyards; a viaduct; a walled garden; the manor | farms, fields, castle |
| **Castle town** | high ground | a square; the castle (keep, curtain walls, four turrets, gatehouse with the road through it, its bailey); a smithy; the chapel and churchyard; the hilltop; tight housing; a watchtower; a cliff house | temples, fields, farms |
| **Market town** | gentle ground | a square with a market cross among its stalls, town hall, inn, clock tower; three housing blocks of row houses and townhouses (sky bridges, laundry alleys, roof terraces); two courtyard blocks; a schoolhouse with its yard and court; the chapel; a smithy; an inhabited bridge where there is a river | castle, temples, farms |
| **River town** | a river | a square near the river; the riverside (landings far apart by water for the barge, willows, a reed bed, a boathouse, a watermill); an inhabited bridge (shops on the arches); a mill on the bank; housing; a park; bridges wherever streets cross | castle, temples |
| **Farming village** | a broad plain | a small square; a village green between two rows of cottages (maypole); the chapel and churchyard; an outlying farmstead; barns by their fields, orchards, the windmill with its wheat and mill house, paddocks; a smithy; the manor; sparse cottages | housing blocks, courtyards, castle, temples |
| **Hill town** | steep ground | a square on the low ground; the hilltop (observatory or lookout cottage), the castle on a shelf, cliff houses, the chapel, the acropolis, the folly, viaducts and stairs up the faces | farms, fields |
| **Garden town** | gentle ground | the square; a park with a bandstand; playing fields (a football pitch, a tennis court, a bowling green); a schoolhouse; the manor and its park; a greenhouse; a walled garden; housing | castle, farms, temples |

The secondary character adds its own showpieces (for a castle, the castle
and a smithy; for a river, the riverside and the inhabited bridge…) after
the primary's first districts, so two towns of one character still differ.
Every town gets the shared basics where they fit: a square with its town
hall, a chapel, an inn, some shops, a lighthouse on the sea, streets.

`PROMISES` in `character.ts` lists what each character must show; the
tests and the `grown-*` scenarios check it.

## How the planner chooses

`PLANS` in `index.ts` lists each character's districts in priority order.
Each district is a stamp (`districts/*.ts`) that searches the whole island
for the site that suits it (flat enough, free, at the right distance from
the square, near water or high up as it needs) and claims its ground with a
margin. The first districts get the best ground; a district that finds no
good site is left out rather than squeezed in. Then streets join every
district to the square (`route.ts`: crossing water by bridges and
boardwalks, climbing faces by stairs on stepped marble), cottages fill the
streets (dense at the heart, thinning out; sparse in a farming village),
and trees go in.

## The forum

The marble city's heart (`districts/forum.ts`), composed on one axis:
a belvedere terrace; the temple on its podium (shops in the podium's walls
where the forum runs along them); a grand stair down to the forum with
guardians at its head; the forum (an obelisk or victory column on the axis,
statues on plinths flanking the stair, a bandstand, a fountain, stalls); a
stoa closing the east side; a theatre facing it from the west; the town
hall and an inn along the south. Parts beyond the podium, stair and forum
are built only where their own ground is flat and free.

## Files

`grower.ts` the running world and claims · `site.ts` reading the island ·
`frame.ts` stamps' turned frames and the search · `town.ts` districts and
rectangle helpers · `route.ts` streets, bridges, climbs · `character.ts`
characters · `index.ts` the plan and the watching order · `districts/` the
stamps.
