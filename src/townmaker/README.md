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
| **Harbour town** | long coast | the waterfront is the town: a great harbour (a galleon berth, warehouses, a pier, stilt houses, a boathouse, a quay wall), then up to four more quays along the coast (each a berth of eight where the sea is wide, else six, five or four docks, with a warehouse and a fish stall), two more waterfronts (pier, stilt house, boathouse), a fish market on a little plaza, jetties; the lighthouse; housing, chapel, smithy | castle, temples, mills, fields, farms |
| **Marble city** | a broad flat site | the forum (below); the acropolis; three shrines (small temples on four pillars); after the streets, three colonnades (pillars and a marble beam along a street) and three monuments (an obelisk or victory column on a small square by a street); the folly and a folly tower; two viaducts; fine housing and courtyards; the manor | farms, fields, castle |
| **Castle town** | high ground | the castle (keep, curtain walls, four turrets, gatehouse, bailey); after the streets, a town wall round the heart (wall pieces on the free ground of a ring round the square, an arch over each street that crosses it: gateways, towers at the corners: turrets); three walled towers on the heights; watchtowers; walled gardens and lawns; smithy, chapel and churchyard, hilltop, tight housing | temples, farms |
| **Market town** | gentle ground | a square with a market cross among its stalls, town hall, inn, clock tower; after the streets, up to four more market places (a plaza by a street with a market cross and stalls); three to five housing blocks of row houses and townhouses; two courtyard blocks; a schoolhouse; a smithy; an inhabited bridge where there is a river; an orchard on the outskirts | castle, temples, farms |
| **River town** | a river | a square near the river; the riverside (barge landings far apart by water, up to ten willows along the banks, a reed bed, a boathouse, a watermill); two more watermills; two inhabited bridges; three more bridges; a mill on the bank; two orchards; a park; housing | castle, temples |
| **Farming village** | a broad plain | a small square and a village green; the chapel and churchyard; three wheat farms (windmill, fenced wheat, barn off the road, farmhouse) and three wheat fields by their windmills; three barns by their fields; three orchards; three paddocks; two greenhouses; the manor, a smithy; few cottages | housing blocks, courtyards, castle, temples |
| **Hill town** | steep ground | a square on the low ground; the hilltop (observatory or lookout cottage), the castle on a shelf, four cliff houses, a walled tower, the chapel, the acropolis, three flights of stairs, the folly and a folly tower, two viaducts, two watchtowers | farms, fields |
| **Garden town** | gentle ground | the manor and its park; three parks with bandstands; two walled gardens and two walled lawns; two greenhouses; two orchards; playing fields; a schoolhouse; a folly tower; after the streets, four flower beds; avenues of trees along nearly every outer street; the most woodland | castle, farms, temples |

The secondary character adds its own showpieces (for a castle, the castle
and a smithy; for a river, the riverside and the inhabited bridge…) after
the primary's first districts, so two towns of one character still differ.
Every town gets the shared basics where they fit: a square with its town
hall, a chapel, an inn, some shops, a lighthouse on the sea, streets.

`PROMISES` in `character.ts` lists what each character must show; the
tests and the `grown-*` scenarios check it.

## Trees

Every town is wooded (`districts/emphasis.ts`): after the cottages, woods
fill the land the town left bare (clumps by a seeded noise, so five or more
touching trees make groves), tree lines run along the streets out of town
(an avenue every other cell), and the character sets how much of each:
the most in a garden town and a hill town, the least in a harbour or marble
city. Orchards (trees two apart in rows) grow in the farming village, the
river town, the garden town, the market town's outskirts and the castle
town.

## How the planner chooses

`PLANS` in `index.ts` lists each character's districts in priority order.
Some districts need the streets laid first (a colonnade along a street, a
market place or a monument beside one, a town wall the streets cross): they
run after the streets join up (`AFTER_STREETS`). Each district is a stamp (`districts/*.ts`) that searches the whole island
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
