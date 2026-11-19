# Core facts

What rule authors can ask about the town. Each is a lazy `defineFact`:
call it with the facts object (`streets(ctx.facts)`); it is computed on first
use and cached for that resolve. All read only the shape-stage base (world,
terrain, resolved kinds, structures, supports), so roles and joinery rules
may use them, except `townRoles` and the `plan-index` facts, which read the
finished shape and serve decoration, urban and life rules only.

Conventions: distances are **4-connected column steps** (a diagonal is 2).
"Standable" means a person can stand in the cell: it lies on a walkable top
(the terrain top of a land column, or the top of a solid block) and holds no
solid block (a tree, stall, fence or floor is fine). "Open water" is a column
of terrain height 0 with no block at sea level (a dock covers it). Lists are
in ascending cell or id order, so iteration is deterministic. Tunables
(`facadeReach` 3, `courtyardMax` 16, `alleyMin` 2, the sun direction) live in
`src/style/facts.ts`.

| Fact (file) | Meaning |
|---|---|
| `cellInfo` (`cell.fact.ts`) | `at(cell)`: terrain height, water column, in terrain, resolved and placed kind, block structure, floor and floor structure, solid, `openFaces` (sides whose neighbour is not solid), `sunnyFaces`, `skyOpen` (no solid block anywhere above), `walkableTop`, `standable`, `aboveGround` (y − terrain height), and the three distances below. `topSolid(x, z)`: highest solid block level in a column, or −1. |
| `distToWater` (`distance.fact.ts`) | Per column, steps to the nearest open-water column. `.at(x, z)`; `NONE` (0xffff) off the map or with no source. |
| `distToFloor` | Steps to the nearest column holding any floor (path, plaza, garden) at any level. |
| `distToPath` | Steps to the nearest column holding a path cell. |
| `distToStructure` | Steps to the nearest column holding any block (trees included). |
| `sunnySide` (`sun.fact.ts`) | The sides facing the fixed light (dot > 0): E and S; `best` is S; `isSunny(dir)`. |
| `structureInfo` (`structure.fact.ts`) | Per block structure (not floor regions or edge-only runs): `minY`, `maxY`, `storeys` (= height for towers, lighthouses, pillars, windmills), `footprint` (distinct columns), `footprintByLevel`, `groundFootprint` (columns on its lowest level), bounding `box`, and `touches`: every block structure sharing a face, with the `sides` it touches and whether it sits `above` or `below`. |
| `facades` (`facades.fact.ts`) | One per exposed side of one cell of a house, tower, lighthouse, marble or windmill structure (exposed: the neighbour is not terrain, not a solid block, not the same structure). Fields: `storey` (1 = lowest level of the structure), `faces` = the **first thing met** stepping straight out within 3 cells: `street`, `plaza`, `garden`, `water`, `cliff` (terrain rising in front), `structure`, `ground` (bare terrain top), or `open` (nothing: air over a drop or a roof below); `dist` = steps to it. Per-category steps `street`, `plaza`, `garden`, `water`, `cliff`, `ground` (the first step each is met before the view is blocked; a stepped cell in mid-air counts as whatever surface lies straight below it). `other` and `gap` = the structure met and the empty cells between (0 = touching, e.g. a windmill). `cliffRise`, `touching` (a non-solid piece right outside), `edge` (an edge piece on that side), `drop` (levels down to the surface right outside), `alley` (the cell outside is an alley cell), `sunny`. `at(cell, dir)`, `byStructure`. Solid blocks and terrain block the view; trees and other pieces do not. |
| `roofRegions` (`roofs.fact.ts`) | Per house, tower, lighthouse, marble or windmill structure: its top cells (the cell above is not the same structure) split into 4-connected patches at one level. `index` (Feature.region) orders by level, then lowest cell. `width` (x), `depth` (z), `longAxis` (null if square), `rectangular`, `againstTaller` (sides where the same structure rises higher: lean-to), `pierced` (cells under another structure's solid block, e.g. a tower rising through), `floors` and `pieces` lying on the roof, `stairsOnto` (stairs blocks beside it climbing onto it). `byCell`. |
| `streets` (`streets.fact.ts`) | Path regions (= path structures). Cells connect side by side at one level, or one level apart when both lie on terrain (a path up a terrace). `length` (cells), `junctions` (3+ path neighbours), `deadEnds` (≤ 1; a lone cell is one), `segments` (maximal straight runs of 2+ along x or z, in order), `links` (each cell's neighbours with their side). `byCell`, `byId`, `totalLength`. |
| `plazas` (`plazas.fact.ts`) | Plaza regions: `area`, `box`, `edgeCells`, `largestSquare` (largest k × k at one level), `square` (contains a full 3 × 3). |
| `gardens` (`gardens.fact.ts`) | Garden regions, same fields, plus `byWater` (open water beside one of its cells). |
| `courtyards` (`courtyards.fact.ts`) | Up to 16 connected ground cells (on the terrain top, no solid block, no fence or wall piece; trees, fountains, stalls, stairs and floors allowed) at one level, enclosed on every side by solid blocks, fence or wall pieces (cell or edge) or a cliff (terrain 2+ up or down). A step of 1, water or the map edge leaks. `empty` = cells with nothing in them. |
| `alleys` (`alleys.fact.ts`) | Runs of 2+ standable cells in a line, each with a structure block (solid or windmill) on both sides across the run and not boxed in along it. `axis` 'x' = runs east–west (blocks N and S). `sides` = distinct structures on the N/W side, then the S/E side. |
| `waterfront` (`waterfront.fact.ts`) | Standable cells on a land column's top or on a dock deck, with open water in a side neighbour; `sides` gives which. |
| `shelteredWater` (`sheltered-water.fact.ts`) | Sea-level cells `(x, 0, z)` of open water with land or a dock on 2+ of the four sides; `sides` = how many. |
| `wildGrass` (`grass.fact.ts`) | Bare grass: the terrain-top cell of a grass (not sand) column, with no block and no floor in it. |
| `leftovers` (`leftovers.fact.ts`) | Connected bare-grass patches (side by side, or one terrain step apart, not across an edge piece) bounded on every side by blocks (`structure`, or `fence` / `wall` cell pieces), floors, edge pieces, a cliff (2+ levels) or water. Touching sand or the map edge makes it open, so not a leftover. `bounds`, and the `streets`, `plazas` and block `structures` it touches. |
| `verges` (`verges.fact.ts`) | Bare grass cells with a path cell beside them (same level, or one terrain step). `dirs`, `streets`, and `fenced` (an edge piece stands between it and every street beside it). |
| `occupancy` (`occupancy.fact.ts`) | Dense arrays indexed by CellKey for hot loops: `kind` (0 = none, else `KIND_CODES` index + 1), `flags` (`SOLID`, `TERRAIN`, `BULKY` = solid or building block), `floor` (`FLOOR_CODES`), `structure` (block structure id or −1). |
| `townFacts` (`town.fact.ts`) | `structuresByKind`, `cellsByKind`, `floorCells`, `blocks`, `topLevel`, `tallest` (the block structure reaching highest: its top level, ties lowest id), `tallestByKind` (most storeys per kind), `highestWalkable` (highest standable cell on terrain or a solid block top), `streetLength` (path cells). Rules reading it are town-wide. |
| `townRoles` (`town.fact.ts`) | Structures per role. Reads the finished shape: dressing-stage rules only. |
| `socketsByType`, `featuresByType`, `socketsById` (`plan-index.fact.ts`) | Indexes over the finished shape plan (Stage 0); dressing-stage rules only. |

Population is not a fact: it depends on the device's resident cap and is
L21's to compute.

Cost on the 2,000-block reference town (Node, each computed once per
resolve): facades 1.5 ms (including alleys and occupancy), roofRegions,
structureInfo, courtyards, townFacts about 0.6 ms each, the rest under
0.5 ms. All together about 7 ms, so a shape-stage rule should read only
what it needs.

Helpers that are not facts, for fact authors: `lib.ts` (solidity, walkable
tops, distance fields, largest square) and `regions.ts` (floor-region
connectivity).
