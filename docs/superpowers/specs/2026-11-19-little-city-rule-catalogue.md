# Little City — rule catalogue (v1)

Companion to the [design](2026-11-19-little-city-design.md). Read that first;
sections 5, 8, 9 and 10 define the terms and the rule engine used here.

Kind rules (K1–K5) and support rules (S1–S4) are in the design, sections 8
and 9. This file lists everything layered on top.

## How to read a rule

`ID · tier · Name` — **when** → **then**.

- **Tier 1** = core, needed for the town to read correctly. **Tier 2** = rich.
  **Tier 3** = delight. Tiers set build order, not importance to the feel.
- `p=0.6` is a seeded chance per candidate (design section 5). No `p` means
  always.
- "First match wins" lists are in priority order.
- **Town-wide** marks a rule that depends on the whole town (tallest, counts),
  so a far-away edit may change its result.
- Every number is a default that lives in the style file.
- IDs are stable labels. Gaps in the numbering are intentional.
- **Height** of a tower means the number of cells in that tower structure.
- "Pillar" in a rule means a placed pillar block. Generated supports never
  count.

Terms used below, on top of the design's glossary:

- **Storey n**: a structure's nth level counting from its lowest cell (1 =
  ground storey).
- **Faces X within n**: stepping straight out from a facade, X is the first
  thing met within n cells.
- **Gap**: the count of empty cells between two facing facades.
- **Supported cell / walkable top / square / alley / courtyard / sheltered
  water**: as defined under Facts in the design.

---

## R — Roles

Each structure gets exactly one role. The role selects part variants, roof
type and which later rules apply.

### Houses (first match wins)

- **R-H01 · 1 · Chapel** — house structure of 2+ cells touching (side or
  directly below) a tower of height ≥ 3 → pointed windows, a rose
  window on the gable end farthest from the tower, double door, roof finial.
  The tower gets R-T01.
- **R-H02 · 2 · Keeper's cottage** — touches a lighthouse → white walls with
  red trim regardless of stored colour ramp position, red roof.
- **R-H03 · 2 · Mill house** — touches a windmill → flour sacks and a cart by
  the door.
- **R-H04 · 1 · Stilt house** — every lowest cell stands over water (on a
  dock or generated stilts) → plank walls, ladder down to the water, fishing
  rod socket on the water side.
- **R-H05 · 2 · Boathouse** — a footprint of 4 cells or fewer and at most 2
  storeys; ground storey at `y ≤ 1` and a facade faces water within 1, or
  touches a dock → wide double doors on the water side, slipway, net on the
  wall. (A bigger house on the shore can be a town hall, inn or manor.)
- **R-H06 · 2 · Inn** — 6+ cells, 2+ storeys, ground-storey facade faces a
  street or plaza within 1 → inn sign on a bracket, lantern by the door,
  stable-style door.
- **R-H07 · 1 · Shop** — ground-storey facade faces a plaza within 1; or
  faces a street within 1 and the structure has 2+ storeys → shopfront
  window, awning (colour from seed), hanging sign. The shop type is a seeded
  pick from {bakery, café, books, flowers, fish, tailor, cheese, toys}, with
  fish allowed only within 6 cells of a dock. A café with 2+ free floor
  cells in front also gets tables (D08).
- **R-H09 · 2 · Manor** — footprint ≥ 10 cells or total ≥ 16 cells → hip
  roof, dormers, two chimneys, portico with two small columns at the door.
- **R-H10 · 1 · Townhouse** — footprint exactly 1 cell and 3+ storeys →
  stepped gable, balcony on each upper storey p=0.5.
- **R-H11 · 1 · Row house** — footprint 1–2 cells, sharing side walls with
  houses of a different colour on two opposite sides → eaves aligned with
  the row, chimney on a party wall. (Its door is placed by J06 like any
  other, which already faces a row onto its street.)
- **R-H12 · 2 · Cliff house** — a facade abuts terrain rising ≥ 2 above its
  floor → no windows on that side, stone ground storey, balcony on the
  opposite side.
- **R-H13 · 2 · Greenhouse** — 1 storey, footprint ≤ 2, garden floor on 3+
  sides → glass walls and roof, plants visible inside.
- **R-H14 · 3 · Lookout cottage** — stands on the highest terrain level with
  no other structure within 3 → weathervane, a telescope on a tripod outside.
- **R-H15 · 1 · Cottage** — default → gable roof, chimney p=0.7.

### Towers (first match wins)

- **R-T01 · 1 · Steeple** — paired by R-H01 → spire, open belfry with a bell.
- **R-T02 · 2 · Castle turret** — touches marble or wall pieces on 2+ sides
  → crenellated top, arrow slits, banner.
- **R-T03 · 2 · Clock tower** — height ≥ 4 and base within 2 cells of a
  square → clock faces on all four sides showing game time, pyramid roof.
- **R-T04 · 3 · Observatory** — stands on the highest terrain level, height
  ≥ 4, no water within 4 → dome with a slit and a telescope; the dome turns
  slowly at night.
- **R-T05 · 3 · Dovecote** — height exactly 3 and garden within 2 → rows
  of dove holes, perches. Doves by L15.
- **R-T06 · 2 · Campanile** — tallest tower in town and ≥ 6 tall
  (town-wide) → open belfry, bell rings at dusk (L29).
- **R-T07 · 1 · Watchtower** — default → cone roof, small windows spiralling
  a quarter turn per storey, flag p=0.5.

### Lighthouse

- **R-L01 · 1 · Lighthouse** — always → red and white bands per storey,
  gallery rail and lantern room on top, beam (L09). ≥ 6 tall adds a second
  gallery halfway up.

### Marble (first match wins)

- **R-M01 · 2 · Temple** — a marble structure resting on 4+ placed pillar
  shafts, each ≥ 2 tall, in a row or rectangle → pediment on the short ends, frieze
  band, steps at the base of the pillars.
- **R-M02 · 2 · Gatehouse** — marble touching one end of a gateway arch
  (R-A04) whose other end also touches marble or a wall → portcullis in the
  arch, lanterns either side.
- **R-M09 · 2 · Theatre** (discovery 1, RC-07) — marble whose columns are
  tiers of seats facing one way: R-M04's shape cuts 2+ rows of it (3+ tiers
  with the uncut top row), 4+ wide; 3 of every 4 columns stand one level
  above or below a neighbouring column; the top row leads nowhere (nothing
  on it, lower behind it); 4+ open level cells (plaza or bare ground) lie
  within 2 in front of the lowest row; nothing of a castle touches it (as
  R-M08) → the steps drawn as deep stone benches (two to a cell), a stone
  balustrade where the top drops 2+; R-H98 stands a painted backdrop with
  two masks at the back of the stage and a brazier at each end. Not: a
  flight up to a platform (R-M04, R-M08). Priority 5977.
- **R-M08 · 2 · Podium** (discovery 1, FX-01) — marble 2+ tall with a 2 × 2
  in its footprint that carries a temple (one of R-M01's pillars stands on
  it), or has R-M04's steps cut into it, climbing to its top level, without
  being mostly stair (steps up to the foot of a tower are a keep's), or has a
  floor, plinth, pillar, fountain, stall or tree on a quarter or more of its
  open top; and no wall piece or wall edge, gateway arch, castle turret,
  gatehouse or keep touching it → no battlements and no garrison: marble
  (not castle stone), flat pilasters on every second cell line, a stone
  balustrade on every top edge that drops 2+ (J19 then leaves those edges).
  With a castle piece touching it the same mass is a keep with a stair.
  Priority 5975.
- **R-M03 · 2 · Keep** — ≥ 3 tall and footprint ≥ 2 × 2, and not mostly a
  flight of steps (R-M04), a podium (R-M08) or a theatre (R-M09) →
  battlements on exposed top edges, arrow slits. Only an embattled keep
  counts as a castle for the garrison and the rider (L36, L37).
- **R-M04 · 2 · Grand steps** — marble forming 3+ rows each one level higher
  than the last, 2+ wide → broad steps; people may sit (seat sockets).
- **R-M05 · 2 · Quay wall** — at `y ≤ 1` next to water → mooring rings,
  bollards, a narrow stair down to the water every 6 cells.
- **R-M06 · 3 · Plinth** — a single marble cell, 1 tall, on a plaza, nothing
  on top → statue or sundial (D19).
- **R-M07 · 1 · Terrace** — default; exposed walkable top → paving pattern;
  balustrade on drop edges via J19.

### Arches (first match wins)

- **R-A01 · 1 · Stone bridge** — valid span with water below → slightly
  humped deck, parapets, a lamp at each end (D20).
- **R-A02 · 2 · Sky bridge** — valid span at `y ≥ 2` anchored on houses at
  both ends → covered timber gallery with windows in the anchors' colour;
  doors into both houses (J26).
- **R-A03 · 2 · Flying buttress** — hanging run anchored to a tower, marble
  or chapel → buttress with a small pinnacle.
- **R-A04 · 1 · Gateway** — an arch standing on a walkable top (cell below
  solid) with a floor in its own cell → lantern hanging in the arch; joins
  wall runs on either side.
- **R-A05 · 2 · Loggia** — hanging run anchored to a house → open balcony
  with balustrade and a door from the house.
- **R-A06 · 1 · Viaduct** — default; 2+ tiers or a run of 3+ → continuous
  cornice and parapet (as in the spike).

### Docks (first match wins)

- **R-D01 · 2 · Quay** — 4+ dock cells running along the shoreline →
  bollards, crates; a hoist crane if 8+.
- **R-D02 · 1 · Pier** — straight run of 3+ leading away from land → ladder
  and lamp at the end, fishing seat socket.
- **R-D03 · 2 · Boardwalk** — a run touching land at both ends → rope
  railings both sides.
- **R-D04 · 1 · Jetty** — default.

### Other pieces

- **R-W01 · 1 · Windmill** — always → tapered body, cap and four sails on the
  top block. On top of a tower or house stack: adds a gallery (J25). Garden
  floor ≥ 4 cells within 2 turns that garden to wheat (R-G01).
- **R-P01 · 1 · Tree species** (first match) — on sand within 1 of water →
  palm; within 1 of water → willow; terrain level ≥ 4 → pine; on or beside
  plaza → clipped round tree in a planter; on garden floor → fruit tree;
  part of 5+ touching trees → grove tree with undergrowth; otherwise the
  spike's seeded mix of round, cypress and bush.
- **R-F01 · 1 · Fountain** (first match) — in a square → tiered fountain with
  jets; in a courtyard → well with a bucket; on garden → birdbath; otherwise
  a small basin.
- **R-S01 · 1 · Stall** (first match) — within 3 of a dock → fish stall; on
  garden → flower stall; otherwise market stall with a striped awning and
  goods chosen by seed.
- **R-G01 · 1 · Garden** (first match, per garden region) — within 2 of a
  windmill and ≥ 4 cells → wheat; in a courtyard → clipped herb beds; next to
  water → reeds and irises; ≥ 9 cells → park lawn with a hedge border; next
  to a house → vegetable rows and flower beds mixed by seed.
- **R-E01 · 1 · Fence style** (first match) — on a dock or bridge deck → rope
  and post; on a roof terrace → iron railing; on marble → stone balustrade;
  otherwise white picket.
- **R-E02 · 1 · Wall style** (first match) — touching marble or a tower →
  crenellated curtain wall, 1 storey tall (people cannot walk on it); around a
  garden → low stone wall with creepers p=0.4; otherwise the spike's low
  wall.

---

## J — Joinery

How pieces meet. Joinery decides geometry and produces sockets.

- **J01 · 1 · Stack trim** — a structure has base trim only on its lowest
  cells and a roof only where a cell is sky-open.
- **J02 · 1 · Merge** — cells of one structure share no interior walls; eaves
  and wall surfaces run continuously.
- **J03 · 1 · Party walls** — touching houses of different colours keep
  separate walls and roofs; their ridge heights differ by a seeded offset so
  a row has rhythm.
- **J04 · 1 · Roof type** (per roof region, first match) — the role names one
  → use it; a path, plaza or stairs leads onto it → flat terrace; region is
  1 deep against a taller wall of the same structure → lean-to; ≤ 2 wide →
  gable with the ridge along the long axis; otherwise hip.
- **J05 · 2 · Roof terrace** — a flat-eligible region of 2+ cells beside a
  taller part of the same structure, p=0.35 → terrace with parapet, door from
  the taller part, parasol and pots (D28).
- **J06 · 1 · Main door** — one per structure on the ground storey. Score
  each facade cell: faces a street within 1 (+5), a plaza within 1 (+4), a
  floor within 3 (+3), open ground (+1), water, a cliff or an alley (−3).
  Highest wins; ties by seed.
- **J07 · 1 · Extra doors** — any storey whose floor level meets a walkable
  surface outside (terrace, deck, marble top, higher terrain, a stair head)
  gets a door there.
- **J08 · 1 · Stoop and trail** — a door above the ground outside gets steps;
  a door 2–3 cells from a floor and not next to one gets a worn dirt trail to
  it (walkable, derived).
- **J09 · 1 · Windows** — each facade cell without a door: none if another
  block touches it; p=0.5 on alley sides; otherwise one window from the
  structure's family. Shops get a bay window on an upper storey p=0.2.
- **J10 · 2 · Dormers** — gable or hip roof with a straight run of 2+ cells,
  p=0.3 → one dormer per 2 cells.
- **J11 · 1 · Chimneys** — one per 3 roof cells (minimum per role), on the
  ridge nearest a party wall. If a taller wall stands within 1 cell, it
  becomes a tall flue rising past that wall's eave.
- **J12 · 1 · Tower through roof** — a tower rising out of a house roof gets
  a collar where they meet; the roof wraps around it.
- **J13 · 1 · Tower body** — base trim only at the bottom, a band course
  every 2 storeys, cap by role.
- **J14 · 1 · Pillar** — a stack is one shaft with one base and one capital
  (spike). Under a block the capital flares; in water it stands on a stone
  footing.
- **J15 · 1 · Arch direction and continuity** — the axis an arch spans
  (first match): it is in a run of 2+ arches → along the run; it has solid,
  wall or arch neighbours on both sides along one axis → that axis; a floor
  in its cell continues into a neighbouring floor → across that floor; else
  x. Its **passage** is the other axis. No cornice between tiers; cornice and
  parapet run through neighbouring arches (spike). Runs meeting at a right
  angle share a corner pier.
- **J16 · 1 · Marble mass** — only exposed faces are emitted; top edges are
  bevelled; flush with terrain of the same height.
- **J17 · 1 · Terrain steps** — a path cell beside a path cell exactly one
  terrain level higher → carved stone steps between them (derived, walkable).
- **J18 · 1 · Stairs** — side-by-side flights with the same `rot` merge into
  one wide flight; flights continuing diagonally merge with a landing every
  3; open sides with a drop ≥ 2 get a rail; a side against a wall gets none.
- **J19 · 1 · Edge railing** — a walkable edge with a drop ≥ 2 that is next
  to a floor, a door or a stair head gets a railing in the style of R-E01.
  Skipped where the player placed an edge piece.
- **J20 · 1 · Fence and wall runs** — cell and edge pieces of one kind join
  into runs: posts at corners and ends, no end post where a run meets a
  structure. A cell piece standing on a path, or an edge piece between two
  path cells, becomes a gate (fence) or an arched opening (wall) that people
  can walk through.
- **J21 · 1 · Floors** — paths have rounded ends and filleted corners
  (spike); a path meeting a plaza gets a flush kerb; a path at a door
  widens; on a dock, planks follow the run; on a bridge deck, cobbles.
- **J22 · 2 · Plaza paving** — pattern aligned to the region's bounding box,
  border course at the edges; a region containing 5 × 5 gets a radial centre
  motif.
- **J23 · 1 · Dock body** — planks along the run, stilts at corners and every
  2 cells, cross-bracing on outer edges.
- **J24 · 1 · Foundation** — a structure whose ground cells sit over lower
  terrain on some side gets a stone plinth down to that ground; against a
  cliff it has no base trim on that side.
- **J25 · 2 · Raised windmill** — a windmill on a tower or house stack gets a
  timber gallery under the cap.
- **J26 · 1 · Bridge doors** — where a walkable arch deck meets a house wall,
  the house gets a door at deck level.
- **J27 · 2 · Jettied room** — a house cell carried on brackets (S2) gets
  half-timber patterning.
- **J28 · 1 · Shoreline** — foam line where land meets water; a short plank
  ramp where a dock meets a beach.
- **J29 · 2 · Vault door** (discovery 1, FX-09) — a terrace (R-M07) or podium
  (R-M08) 2+ storeys tall on 9+ columns with a 2 × 2 among them and no door → one
  stone-framed door into its vaults, in the middle of its longest
  ground-storey wall run of 3+ cells standing on level ground with open
  ground, a path or a plaza at its foot and marble above; the run with a
  path or plaza nearest in front of it (within 5) wins. Not: a wall one cell
  thick, a run with steps cut into it, a wall against a bank or a block.

---

## D — Decoration

Props claimed onto slots and sockets. Higher in the list = higher priority
when two rules want the same slot, unless a rule says otherwise.

### Streets and squares

- **D01 · 1 · Street lamps** — a street of length ≥ 4 gets a lamp at each
  dead end and junction, then every 4th cell, alternating sides, on the edge
  slot away from doors. New lamps arrive by F05.
- **D02 · 1 · Square lamps** — at the corners of a square; a square containing
  5 × 5 with no fountain gets a four-arm lamp at the centre.
- **D03 · 2 · Benches** — one per 4 edge cells of a plaza, facing in; at a
  street dead end that faces water or a drop, p=0.7.
- **D04 · 2 · Bunting** — a straight street segment ≥ 3 with structures
  within 1 on both sides at storey 2+, p=0.5 → zigzag bunting between the
  facades. Always on a square that has a stall.
- **D05 · 1 · Laundry lines** — two different house structures with facing
  facades across a gap of 1–3 cells; on a storey ≥ 2 (or storey 1 if both
  are single-storey and the gap is 1); both facade cells have windows; the
  line between them is empty air; p=0.6 per facing pair of cells → a line
  with 3–6 garments. At most 2 lines per 3 cells of alley. Never over a
  plaza (D04 wins there).
- **D06 · 2 · Hanging lanterns** — an alley ≥ 2 long, p=0.4; always under a
  gateway (R-A04).
- **D07 · 1 · Shop dressing** — awning and sign for R-H06 and R-H07.
- **D08 · 2 · Café tables** — a café-type shop (R-H07) with 2+ free floor
  cells in front → up to 4 tables with parasols on those cells.
- **D26 · 3 · Fingerpost** — a junction with 3+ branches, p=0.5 → signpost
  with pictogram arms.
- **D27 · 3 · Post** — a house facing a street p=0.3 → mailbox; one postbox
  per street of length ≥ 10.
- **D33 · 3 · Hand pump** — total street length ≥ 8 and no fountain in town
  (town-wide) → a pump at the busiest junction.

### Houses

- **D09 · 1 · Flower boxes** — under a window: p=0.5 on sunny sides, p=0.2
  otherwise; never on storey 4+.
- **D10 · 2 · Creepers** — a facade facing a garden or courtyard p=0.4; cliff
  house ground storey; grows from the ground, at most 2 storeys.
- **D11 · 2 · Doorstep** — doormat always; pair of potted plants p=0.4;
  barrel p=0.2; a bicycle p=0.1 if the door faces a street; a lantern if it
  faces a street.
- **D12 · 2 · Weathervane** — on the ridge end of a house structure that is
  taller than every other house structure within 6 cells (rooster, ship or
  arrow by seed).
- **D14 · 3 · Roof life** — chimney pots; birdhouse p=0.1; one stork nest on
  the tallest chimney once the town has 12+ house structures (town-wide).
- **D28 · 2 · Terrace furniture** — parasol, deck chair, pots on roof
  terraces.
- **D30 · 3 · Stair pots** — stairs along a wall, p=0.3 → flower pots on the
  wall side of some steps.

### Flags

- **D13 · 1 · Flags** — watchtower p=0.5 (from R-T07); turret banner; every
  lighthouse gallery; pier end p=0.5; a flagpole on a square containing
  4 × 4 with no fountain. The tallest structure in town always flies one
  (town-wide).

### Water's edge

- **D15 · 2 · Dock goods** — per quay cell away from the walking line: crates
  or barrels p=0.5, coiled rope p=0.3; lobster pots; nets on drying racks
  once a dock structure has 4+ cells.
- **D20 · 1 · Bridge lamps** — both ends of a stone bridge; a lantern under a
  sky bridge.
- **D23 · 2 · Lighthouse base** — fog bell; rocks at the base if on the
  waterfront.
- **D24 · 1 · Wild ground** — grass tufts and wildflowers, denser the farther
  from any structure and trimmed near floors; boulders at cliff feet;
  driftwood, shells and starfish on sand; reeds and lily pads in sheltered
  water.

### Gardens, courts, monuments

- **D17 · 2 · Courtyard** — a courtyard of 4+ cells with nothing placed in
  it → cobbles and one tree or well at the centre.
- **D18 · 2 · Garden things** — scarecrow in wheat or vegetables ≥ 6 cells;
  beehives p=0.3; wheelbarrow; trellis against a neighbouring wall.
- **D19 · 3 · Statue** — on a plinth (R-M06): figure, sundial or urn by seed.
- **D21 · 2 · Castle dressing** — banners on curtain walls, torch brackets at
  a gatehouse, a cannon on a quay wall p=0.15.
- **D22 · 3 · Temple braziers** — at the foot of temple steps.
- **D25 · 2 · Mill yard** — sacks, cart, ladder at a windmill's base.
- **D31 · 3 · Viewpoint** — the highest walkable point reachable by a floor
  gets a bench and a coin telescope (town-wide).
- **D32 · 3 · Under the trees** — a swing on a courtyard or garden tree
  p=0.2; a hammock between two trees 2 apart p=0.3; a picnic blanket in a
  park.
- **D34 · 3 · Lost kite** — one kite snagged in the tallest tree, p=0.1 per
  town (town-wide).

---

## L — Life

Actors and motion. All read the signals in the design, section 13.

### Wind, light and water

- **L02 · 1 · Chimney smoke** — every chimney puffs; puffs lean with the
  wind; denser at dawn and dusk.
- **L03 · 1 · Sails** — windmill sails turn at a speed set by local wind; the
  cap slowly yaws to face it. Weathervanes turn likewise.
- **L04 · 1 · Cloth** — laundry, flags, bunting and awnings flutter with the
  local gust, so a gust visibly crosses the town.
- **L05 · 2 · Trees** — sway with wind; a leaf falls now and then; petals
  from fruit trees.
- **L06 · 1 · Water** — drifting stroke lines (spike), foam at the shore,
  rings around stilts, pillars and boats. Tier 3: a fish jumps now and then;
  lily pads bob.
- **L07 · 1 · Windows through the night** — windows light one by one over
  20 seconds at dusk in seeded order, only where a resident is home; shop
  windows light first and go dark when the shop shuts. Then the town goes to
  bed: through the first half of the night houses put their lights out one
  at a time (upstairs last), until only about one house in six still has a
  window lit, plus inns, the lighthouse, the castle gate and street lamps.
  A few of the late windows change through the night (one goes out, another
  comes on for a while). In a lit window a resident's silhouette sometimes
  crosses, pauses, or draws a curtain: dark shapes against the warm pane,
  never more than a few in view at once. Before dawn the bakery lights
  first.
- **L08 · 1 · Lamplighter** — at dusk one resident walks each street in route
  order; each lamp lights as they reach it. Lamps they cannot reach light on
  their own a few seconds apart. All lamps go out at dawn.
- **L09 · 1 · Lighthouse beam** — sweeps at night; a soft glow on the water.
- **L10 · 2 · Night dressing** — bunting and lanterns glow on squares;
  stars and a moon on the paper; rarely, a shooting star. (Fireflies were
  removed at Derek's request, 2026-11-19: do not add them back.)
- **L31 · 3 · Clouds** — ink-drawn clouds drift over the paper with the wind
  and drag soft shadows across the island.

### Birds

- **L11 · 1 · Gulls** — count = clamp(1 + waterfront dock cells ÷ 4, 1, 8).
  Circle over water near docks, perch on bollards, ridges and the lighthouse
  rail, follow the fishing boat.
- **L12 · 1 · Pigeons** — per plaza region: flock = clamp(cells ÷ 3, 0, 12).
  Peck on the ground; burst into flight when a person walks through or a
  block lands within 3 cells; settle again after 5 seconds; perch on statues
  and fountains.
- **L13 · 1 · Swifts** — if any tower or lighthouse has height ≥ 5, or total
  street length ≥ 20 → clamp(total street length ÷ 8, 3, 9) swifts loop
  around the tallest structures, most active at dusk (town-wide).
- **L14 · 2 · Sparrows** — one per 6 cells on streets of length ≥ 6; hop
  along the street, perch on fences and laundry lines.
- **L15 · 3 · Characters** — doves at a dovecote; a stork on its nest; an owl
  at night on the observatory or tallest tree; a duck with ducklings in
  sheltered water; a crow on the scarecrow.
- **L16 · 1 · Scatter** — any bird within 3 cells of a landing block takes
  off.

### Boats

- **L17 · 1 · Moored rowboats** — see "Boats and ships" below: any dock space that fits one gets one; they bob and tug on the line in gusts.
- **L18 · 2 · Fishing boat** — see "Boats and ships" below: any dock that fits it; leaves at dawn, loops offshore, returns at dusk trailing gulls.
- **L19 · 1 · Sailboats** — see "Boats and ships" below: one or two always, more with more dock; each sails a loop round the island through open water; the sail flips sides with the wind.
- **L20 · 3 · Rower** — see "Boats and ships" below: with two or more docks, a rowboat crosses between two of them now and then.

### Boats and ships (rewritten at Derek's request, 2026-11-19)

Derek's words: "It shouldn't be tied to some specific board condition. If
there's open available port space, it just spawns in. I just want boats."
So there are no thresholds, counts or prerequisites. **Docks bring boats,
and what comes is whatever fits the water beside them.** This replaces the
earlier conditions in L17–L20 and L38–L42 (dock counts, "a port with 12+
docks", "needs a lighthouse", "piers 10 apart").

- **Fit is the only test.** A vessel may use a stretch of dock (or quay
  wall) if its hull physically fits in the open water alongside and it can
  sail or row in from the edge of the map without touching anything. A
  single dock cell fits a rowboat; two or three fit a sailing dinghy or the
  fishing boat; about four fit a cog; about six a galley; about seven a
  galleon. River docks take rowboats, the rower and the barge. The lengths
  are simply the hulls' sizes, not rules.
- **Every dock gets used.** Free dock space fills up over the first minute
  or two: small boats moor at the short and shallow places straight away,
  and bigger ships call at any stretch they fit, the biggest that fits most
  often, with the others taking turns so a long quay sees galleons, galleys
  and cogs. A long quay with a ship in still has its small boats on the
  rest of it. More dock means more boats, up to a cap that keeps the water
  from looking crowded (and lower on phones).
- **The sea is never empty.** Even an island with no dock has a sailboat or
  two looping it and, now and then, a tall ship passing far out. No
  lighthouse is needed for anything; a lighthouse just makes passing ships
  a little more frequent.
- **Rivers.** Any dock on a river brings the barge: it runs between river
  docks if there are two or more, or between the one dock and the river
  mouth.
- **Nothing ever vanishes.** When the player removes a dock, fills the
  water, or blocks a lane, the boats affected cast off and sail or row away
  to the edge of the map (or to another free berth). They never shrink,
  pop or fade in view. If something is built on the very water a boat is
  floating in, the boat is nudged aside to the nearest free water first.
  Only a boat with no water left to float in at all may be removed, and
  then with the removal puff used for erased pieces, not a shrink. A boat
  shut into an enclosed pool stays there as a resident until a way opens.
- **Arrivals are still events.** Big ships sail in under shortening sail,
  moor, unload, draw a crowd, stay the night with lanterns lit, and leave;
  small boats give way to them.
- **More dock, more big ships, at the same time** (Derek, 2026-11-19: "I'm
  building hella docks and there's still only one big boat"). Every stretch
  of dock a big ship fits is a berth, and berths fill: a harbour with room
  for four galleons has several moored at once, with others arriving and
  leaving. A very long quay holds several ships end to end. The only limits
  are physical (hulls must not overlap, and two ships must not be under way
  in the same lane at once: the second waits offshore or holds at its berth)
  and a generous cap for performance (about 8 big ships on desktop, 4 on a
  phone), never a rule like "one at a time".

Rule ids stay as they are for the code's sake: L17 moored rowboats, L18
fishing boat, L19 sailboats, L20 rower, L38 galleon, L39 cog, L40 galley,
L41 river barge, L42 passing sails.

### People

- **L21 · 1 · Population** — each house structure houses ceil(cells ÷ 2)
  residents, until the town cap (60 desktop, 30 phone) is reached, filled in
  `seq` order. Each resident has a seeded look and a home.
- **L22 · 1 · Day plans** — by day a resident picks a destination by seeded
  weights (square, shop, café table, bench, pier, garden, fountain,
  viewpoint, another house), walks there, lingers 5–20 seconds with a
  matching pose, and picks again.
- **L23 · 2 · Jobs** — one worker per role structure: baker at the shop door
  at dawn; shopkeeper sweeping; miller carrying sacks between windmill and
  mill house; keeper climbing the lighthouse at dusk; fisher on the pier
  end; gardener watering; stall vendor behind the stall; guard pacing a keep
  or curtain wall; bell ringer at dusk.
- **L24 · 1 · Routes** — A* over the walking graph (design section 13).
  Cost per cell: path or plaza 1, dock or deck 1.5, grass 3. Interiors cost
  1 second per storey. People queue at single-file links.
- **L25 · 1 · Dusk** — residents walk home at dusk; their windows light when
  they arrive (L07). At night at most 10% are out: a stargazer at the
  viewpoint, a night fisher.
- **L26 · 2 · Reactions** — a block landing within 4 cells: stop, turn and
  look, a small hop p=0.3. A strong gust: hand to hat. Two people meeting on
  a street: stop for a squiggle chat bubble p=0.2.
- **L27 · 1 · Displaced** — if a resident's cell is built over they hop to
  the nearest walkable cell. If their home is erased they walk off the map
  edge of the nearest floor, or fade if there is none. New homes fill by
  residents arriving on foot from the nearest dock or beach.
- **L28 · 3 · Children** — 15% of residents are small and run. When windy
  they fly kites from the viewpoint or a square; they chase pigeons.
- **L32 · 2 · Stranded** — a resident whose home links to no floor stays
  within 2 cells of the door: sits on the step, tends a pot.

### Castle life (Derek's request, 2026-11-19)

- **L36 · 2 · Garrison** — a castle (a keep with battlements, or a curtain
  wall of 8+ cells with a gatehouse or turret; a podium or theatre is never
  one, FX-11) → a troop of 4–6 soldiers in matching tabards
  and helmets, with pikes, who march in step in a column of twos on a patrol
  round the outside of the walls (or round the keep if there are no walls),
  following walkable ground. They halt and face front at the gate for a few
  seconds each lap, change the guard at dawn and dusk, and go inside at
  night leaving two sentries with torches at the gate. Residents step aside
  for them. Troop size grows with the castle: 4 for a small one, 6 for a keep
  with walls.
- **L37 · 2 · Rider** — the same castle, if a street leads from its gate →
  one mounted rider (a horse with a rider in the garrison's colours and a
  pennant on a lance) who leaves by the gate a few times a day, trots a loop
  along the streets to the square and back, and walks the horse through
  crowds. The horse stands tethered by the gate between rides, flicking its
  tail.

### Animals and small motion

- **L29 · 2 · Mechanisms** — fountain jets; clock hands; bells swing at dusk;
  shop signs swing in gusts; doors open as people pass through.
- **L33 · 3 · Cats** — one per 5 house structures, at most 6: nap on sunny
  roofs, wall tops and doorsteps; move at dusk; sit watching a fish stall or
  pigeons.
- **L34 · 3 · Grazers** — wild grass ≥ 30 cells at least 4 cells from any
  structure → 2–5 sheep grazing and hopping between terraces. Chickens in a
  vegetable garden beside a cottage.
- **L35 · 3 · Insects** — butterflies over gardens by day; bees near hives
  and flower boxes.
- **L30 · 3 · Far balloon** — rarely, a hot-air balloon drifts across the
  paper far behind the island.

---

## U — Urban fill

Rules that make leftover and in-between space into something, the way real
towns do. This part is a seed: discovery passes (design section 21) are
expected to at least double it. New terms: a **leftover** is a connected
patch of bare grass cells bounded on every side by structures, floors,
fences, walls, cliffs or water. A **verge** is a bare grass cell beside a
street cell.

- **U01 · 2 · Pocket park** — a leftover of 2–12 cells touching a street or
  plaza → a bench, one or two flowerbeds or shrubs, a low hedge on its open
  sides.
- **U02 · 2 · Paddock or walled garden** — grass of 6+ cells fully enclosed
  by player-placed fences or walls: with 3+ trees inside → a park with
  benches and a worn loop track; enclosed by walls → a walled garden with
  beds and espalier trees; otherwise → a paddock with 2–4 grazing animals
  and a trough.
- **U03 · 1 · Front garden** — exactly one grass cell between a house's main
  door and a street → a derived picket fence along the street edge with a
  gate at the door, flowers either side of a short walk.
- **U04 · 2 · Back yards** — a leftover of up to 6 cells behind row houses
  (facing no street) → divided per house by low fences; sheds, vegetable
  patches, washing poles.
- **U05 · 2 · Street trees** — a straight street segment of 6+ with verge
  cells along one side → a small derived tree every 3rd verge cell (a prop,
  not a block).
- **U06 · 2 · Town edge** — a street dead end facing wild grass → the paving
  frays into a dirt trail for 2–3 cells with a signpost; outward-facing rear
  walls on the town's edge get woodpiles and vegetable plots p=0.4.
- **U07 · 1 · Retaining wall** — a terrain step of 1+ beside a street or
  plaza → a stone retaining wall face with drain holes and creepers in place
  of raw earth.
- **U08 · 2 · Nooks** — an empty ground cell under a deck or bridge, or
  beside a stair or grand steps, enclosed on 2+ sides → by seed: stacked
  crates and barrels, a small kiosk, a wall fountain, a cart, a sleeping
  cat.
- **U09 · 2 · Vista end** — a straight street of 5+ ending at a structure's
  facade → that facade cell gets a feature: clock, statue niche, grand
  doorway or oriel window, by the structure's role.
- **U10 · 2 · Corners** — a house at a street junction with two street-facing
  sides → corner entrance with a chamfer, or a corner oriel on the upper
  storey; shops become corner shops with windows on both sides.
- **U11 · 2 · Civic hall** — a house structure with footprint ≥ 8 cells and
  a facade on a square (a role, evaluated before R-H06) → town hall: arcaded
  ground storey, balcony over the door, clock gable, flag.
- **U12 · 2 · Centre and edge** — houses within 4 cells of a square get a
  stone ground storey and richer trim; houses more than 10 cells from any
  floor get rustic variants (thatch, timber, rough stone).

---

## F — Feedback

- **F01 · 1 · Landing** — a placed piece drops 0.4 of a cell, squashes to
  0.85, overshoots to 1.08 and settles, 280 ms in all, with a dust ring.
- **F02 · 1 · Neighbour wobble** — any structure whose shape changed because
  of the edit rocks ±2° and settles in 300 ms.
- **F03 · 1 · Auto morph** — an Auto block whose resolved kind changed:
  sparkle burst and a 200 ms squash before the new shape lands.
- **F04 · 1 · Removal** — the piece shrinks and puffs away; props that lose
  their slot pop.
- **F05 · 1 · Pop-in** — newly derived props appear one after another,
  100 ms apart, each with a small bounce (a street's lamps pop up in order).
- **F06 · 2 · Sound** — a soft placement note pitched by height and timbred
  by kind; a pop on removal; quiet sea, wind and gull ambience; one bell at
  dusk.
- **F07 · 1 · Auto markers** — with the Change tool selected, Auto blocks
  show a small ✨.
- **F08 · 1 · Refusal** — an illegal action shakes the ghost (or the tool
  button on touch) and plays no landing.

---

## Counts

Roles 46 · Joinery 28 · Decoration 32 · Life 36 · Urban fill 12 ·
Feedback 8 = 162 rules here, plus 5 kind rules and 4 support rules in the
design. 80 of the 160 are tier 1. Discovery passes add to every part.
