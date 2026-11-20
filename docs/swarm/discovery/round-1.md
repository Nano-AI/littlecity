# Discovery round 1 — what real towns have that Little City does not (yet)

Explorer: discovery-1, 2026-11-19. Branch `swarm/discovery-1`.
Towns: `scenarios/discovery/round-1/` (render any with `npm run shots -- disc1-<name>`).
Evidence: `docs/swarm/discovery/round-1/*.jpg` (named in each proposal).

## Overall impression

The town reads beautifully at a glance. The grown towns
(`gt6-overview.jpg`, `grown-a-town.jpg`) look like real places, and the lagoon
stilt village (`lagoon-stilts.jpg`) is a delight. But once you look closely,
three things stop it reading as a *real* town.

1. **Everything is a shop or an inn.** A grown town of 83 houses has 44 shops.
   A 24-house harbour has 8 inns and no shop at all, because its warehouses on
   the quay all qualify as inns. A hill town of 25 houses has 14 inns. Real
   towns have a high street, a few inns at the places travellers arrive, and
   streets of plain houses. The game has no budget and no ranking of streets,
   so every street is a high street.
2. **Marble cannot be anything but a castle.** The owner's own example is
   exactly this: build a temple podium with a great stair, and the podium
   grows battlements and arrow slits, a garrison marches round it, and a
   knight trots across the forum (`marble-precinct-keep.jpg`). A stepped
   theatre gets the same treatment (`theatre-as-keep.jpg`), and so does a
   flight of stair ledges (`inhabited-viaduct.jpg`, lower right). A 1×1 obelisk
   is drawn as stacked boxes, and a big podium is a blank slab you cannot reach.
3. **Open ground is still mostly blank.** Fenced land behind a row of houses
   becomes a sheep paddock instead of back gardens; a walled yard beside a
   chapel becomes herb beds instead of a churchyard; the inside of a castle
   is lawn; an orchard planted in a grid becomes a "grove"; hillside terraces
   are bare grass bands; the strip between the harbour street and the quay is
   grass. The leftover rules (U01–U08) work on small patches. Large open
   ground, and ground that belongs to a *particular* building (church,
   castle, farm, row), has nothing.

The work of the town is also almost invisible: no smithy, mill race,
warehouse, barn or school. And there are no "earned" events beyond ships
and soldiers: no weddings, no market day, nothing to watch at the theatre.

The strongest proposals below take pieces players already build and give
them their real-world meaning (podium, churchyard, warehouse, watermill,
orchard, burgage plots). Most are a rule plus a prop or two.

## Towns built for this round

| Scenario | Island | What it is | Blocks |
|---|---|---|---|
| `disc1-harbour` | hand-made bay, bluff, rise | quay and warehouses, harbour square, breakwater with a light, chapel on the bluff, a lone jetty, an empty plot | 233 |
| `disc1-hill-town` | hand-made 6-level terraces + a cliff crag | switchback street, houses backed against each terrace, summit church, gardens on the slope | 188 |
| `disc1-castle-village` | flat with a 2-high crag, a pond | walled castle on the crag, ramp to the gate, inn and forge by the road, a village green, a chapel yard, fenced fields with gaps, a mill | 145 |
| `disc1-river-market` | flat with a bending river | bridge into a double market square, river quay, a house where a mill belongs, a ford, a second bridge, a half-settled far bank | 197 |
| `disc1-marble-stair` | flat by the sea | the owner's example: a big marble stair up to a temple podium with plinths, a free colonnade, a stoa, an obelisk, a stepped theatre, a blank podium, houses leaving awkward gaps | 823 |
| `disc1-lagoon` | ring island round a lagoon with an islet | stilt houses on a boardwalk, a fish market on docks, an Auto stack in the water, a channel with a pier and a lighthouse | 125 |
| `disc1-farms` | flat with a hill and a pond | a five-building hamlet at a crossroads, a farmstead with a barn, fenced fields (one with a gap), a grid orchard, a windmill and wheat, a lane to nowhere | 66 (+169 floor) |
| `disc1-vertical-pile` | flat | towers joined by high arches, houses standing on a viaduct, a floating house, a windmill on a tower, a lighthouse on a house, stair ledges, a platform on pillars | 139 |
| `disc1-auto-sprawl` | flat with a sea edge and a knoll | Auto blocks clicked in random clusters, Auto lines into the sea, scribbled paths | 138 |
| `disc1-long-street` | flat | one long street with ragged setbacks and gaps, plots fenced with gaps, a back lane that peters out, a church at a T junction | 76 |
| `disc1-grown-a` | generator 2, seed 23 | a grown town (river, castle, temple, harbour) | 381 |
| `disc1-grown-b` | generator 2, seed 64 | a grown town on a hilly island | 341 |

Also used as evidence: `grown-town-6` (existing).

Every town was rendered from four quarters (`q-se`, `q-ne`, `q-nw`, `q-sw`),
at dusk (`dusk-se`, `dusk-nw`), and in close-ups, and I read its `inspect`
output. The garrison round the marble podium was also checked as a sequence
(`node src/life/testing/sequence.mjs disc1-marble-stair --warm 4000 --frames 6 --every 2500`).

## Top fifteen (ranked by delight × how often it shows ÷ cost)

| # | Id | Proposal | Group |
|---|---|---|---|
| 1 | FX-01 | Podium, not keep: marble that carries a temple, a grand stair or a plaza loses its battlements and garrison | fault / role |
| 2 | FX-02 | Role budgets: inns only where travellers arrive, shops only on the high street; everything else is a dwelling | fault / role |
| 3 | RC-01 | Churchyard: a walled or fenced yard beside a chapel holds headstones, a yew and a lychgate | recognition |
| 4 | RC-02 | Warehouse: a big house on the quay gets loading doors and a hoist, and dockers carry cargo when a ship is in | recognition |
| 5 | UF-01 | Burgage plots: fenced land behind a row of houses is split into one back garden per house | urban fill |
| 6 | RC-03 | Watermill: a house on a river bank gets a turning wheel and a mill race | recognition |
| 7 | RC-04 | Orchard: trees planted on a 2-cell grid become fruit trees with ladders and baskets | recognition |
| 8 | UF-02 | Village green: grass faced by 4+ houses gets a maypole, a mown sward and a big tree with a ring bench | urban fill |
| 9 | UF-03 | Shops in the podium wall: a long blank marble wall facing ground gets arched booths, a wall fountain and ivy | urban fill |
| 10 | RC-05 | Inhabited bridge: houses on a bridge or viaduct deck become bridge shops on brackets | recognition |
| 11 | LF-01 | A wedding at the chapel: bells, confetti and a procession to the square | life |
| 12 | LF-02 | Market day: extra stalls, carts arriving from the edge of town, a busker | life |
| 13 | FX-03 | Fingerposts in clusters: 7 posts in a 4 × 2 patch on wide streets | fault |
| 14 | UF-04 | Country lanes: hedgerows, field gates and milestones instead of street lamps | urban fill / fault |
| 15 | RC-06 | Smithy: a one-storey house against a short tower becomes a forge with a glowing hearth | recognition |

---

## 1. Recognition roles

"This combination is obviously a ___." Ranked within the group.

### RC-01 ★ Churchyard
- **Why:** almost every parish church in Europe stands in its own burial
  ground; a walled yard beside a church is unmistakably a churchyard.
- **Trigger:** a region of garden floor, or of bare grass (a landUse field,
  leftover or courtyard), of 2–40 cells, with a cell side-adjacent to a chapel
  (R-H01) or its steeple, or one path cell away from the chapel's main door;
  its perimeter, apart from the chapel itself, is ≥ 60% placed wall or fence
  pieces (edge or cell).
- **Must not:** a windmill within 2 (that is wheat); a region that also
  touches a house that is not the chapel on 2+ sides (that is the priest's
  garden); a region on a roof.
- **Appears:** rows of small headstones facing east with a seeded tilt, one or
  two taller crosses, a clipped dark yew (the cypress model, darker) in a
  corner, mown paths between the rows. A **lychgate** (a small roofed gate
  with a bench) stands where a path crosses the wall (the J20 opening). Life:
  now and then by day a resident stands at a grave with flowers (an L22
  destination, 'grave').
- **Sits:** before R-G01 (herb garden, walled-garden flowers) and U02
  (walled garden) for these regions.
- **How often:** most towns with a chapel. Players fence round churches
  instinctively. In all three of my chapel towns the yard became herb beds or
  an espalier garden.
- **Cost:** a rule and 3 props (headstone, cross, lychgate).
- **Evidence:** `disc1-harbour` camera `chapel` (`churchyard-herb-beds.jpg`);
  `disc1-long-street` camera `church` (`chapel-hip-roof.jpg`, the walled yard on
  the left).

### RC-02 ★ Warehouse (and the dockers)
- **Why:** the buildings on a working quay are stores, not inns. Their tall
  stacked loading doors and the hoist beam on the gable are the harbour's
  signature.
- **Trigger:** a house structure of ≥ 6 cells and ≥ 2 storeys whose
  ground-storey facade faces a quay (R-D01), a quay wall (R-M05) or a dock
  cell within 2, with water within 4.
- **Must not:** a house that faces a plaza within 1 (that is the harbour inn
  or a shop); a footprint of 1 (a townhouse).
- **Appears:** a column of loading doors, one per storey, on the facade
  facing the water; a hoist beam with a rope and pulley at the eaves above
  them; crates and sacks at the door; no flower boxes; a painted name band.
  Life: while a ship is berthed (L38–L40 ship-call), 2–3 dockers carry crates
  between the ship's berth and the warehouse door, and the hoist rope raises
  a bale now and then.
- **Sits:** before R-H06 inn (priority above 9940).
- **How often:** every harbour town. `disc1-harbour` has 8 "inns" on its quay
  and no shop at all.
- **Cost:** a rule, a door variant, the hoist prop, and a job for L23.
- **Evidence:** `disc1-harbour` `q-se` (`harbour-overview.jpg`: the four big houses
  along the left quay); `inspect disc1-harbour` lists #21, #39, #47, #64 and #85 as
  inns.

### RC-03 ★ Watermill
- **Why:** a river through a town always has a mill. It is the reason most
  river towns exist.
- **Trigger:** a house structure with a ground-storey facade facing open water
  within 1, where that water is a river: the generator's river mask, or a
  water column with land within 3 on both sides across it (a channel 1–3
  wide).
- **Must not:** the sea or a lagoon (sheltered water with no opposite bank
  within 3: those stay boathouses); a house of 1 cell (too small for a
  wheel); two watermills within 8 of each other.
- **Appears:** an undershot wheel on the water-side facade, turning (an L
  motion beside L03 sails); a short timber leat or weir across the channel
  beside it, with a white foam line; sacks and a cart at the land door. A
  miller job (L23) walks between the mill and the nearest bakery shop.
- **Sits:** before R-H05 boathouse and R-H06 inn.
- **How often:** about 60–80% of generator-2 islands have a river.
- **Cost:** a rule, a wheel part, a weir prop and a motion behaviour.
- **Evidence:** `disc1-river-market` camera `bend`: the house at (24,1,21)
  became a plank-walled boathouse (`river-market-overview.jpg`, centre right).

### RC-04 ★ Orchard
- **Why:** trees planted on a regular grid are an orchard. Nobody plants a
  wild grove in rows.
- **Trigger:** 6+ trees, each with another tree exactly 2 cells away along x
  or z, and no tree at distance 1 along x or z; at least 4 of them form a
  2 × 2 lattice (spacing 2); all standing on grass or garden.
- **Must not:** trees on a plaza (planter trees) or on sand.
- **Appears:** fruit trees (R-P01's fruit-tree, with apples or pears by seed),
  a ladder against one tree in four, a basket under another, a few fallen
  fruits, mown grass between the rows, and a beehive on one edge. The orchard
  is an L22 destination ('pick fruit').
- **Sits:** before R-P01's "grove tree" branch (5+ touching trees).
- **How often:** some towns. Grids are the easiest thing to click.
- **Cost:** a rule and 2 small props.
- **Evidence:** `disc1-farms` `q-se` (`farms-overview.jpg`, left: a 5 × 5 grid drawn
  as a wild grove of cypress, round trees and bushes with a hammock).

### RC-05 ★ Inhabited bridge (Ponte Vecchio)
- **Why:** houses and shops lining a bridge deck (Ponte Vecchio, old London
  Bridge, Pulteney Bridge) are one of the most loved urban forms there is,
  and players already build them.
- **Trigger:** a house structure whose lowest cells all stand on the top of an
  arch run (R-A01 stone bridge, R-A06 viaduct or R-A02 sky bridge), where
  the run's deck holds a floor or meets a street at one end or both.
- **Must not:** a house that blocks the whole deck width with no free deck
  cell beside it (then it is a gate house: see RC-17).
- **Appears:** the houses get shopfronts facing the deck and their backs
  oversail the parapet on timber brackets (J27 jettied room); the deck
  between them is paved as a street; small bridge-shop signs. At night the
  lit windows are doubled as reflections on the water below.
- **Sits:** before R-H07 / R-H15 for those houses.
- **How often:** some towns. Every vertical builder tries it.
- **Cost:** a rule; reuses the bracket and shopfront parts.
- **Evidence:** `disc1-vertical-pile` camera `court-nw` (`inhabited-viaduct.jpg`:
  two cottages standing on the viaduct like strangers).

### RC-06 ★ Smithy
- **Why:** every village had a forge, and its look is iconic: a squat
  chimney, an open front, an anvil, sparks.
- **Trigger:** a house structure of 1 storey and footprint 1–3 touching
  (side) a tower structure of height 1–2.
- **Must not:** a tower of height ≥ 3 (chapel, R-H01); the house is on water.
- **Appears:** the tower becomes a broad forge chimney with a sooty top and
  heavy smoke (L02 dense); the house gets an open front with an anvil, a
  quench barrel, a horseshoe sign and a hitching rail with a trough. At dusk
  and night the hearth glows orange, and now and then sparks rise. If the
  town has a rider (L37), the horse sometimes stands at the smithy's rail.
- **Sits:** before R-T07 watchtower (for the tower) and R-H15 cottage.
- **How often:** some. A low tower beside a cottage is a common "chimney"
  gesture.
- **Cost:** a rule, 3 props and a glow.
- **Evidence:** `disc1-castle-village` camera `gate` (`castle-bailey.jpg`, lower
  left: a 2-high tower beside a 1-storey house became a watchtower and a
  cottage).

### RC-07 Theatre
- **Why:** a stepped half-bowl of seats facing a level floor is a theatre,
  from Epidaurus to every Roman town.
- **Trigger:** a marble structure that R-M04 cuts into 3+ rows of steps, 4+
  wide, whose lowest row faces a plaza or bare ground of ≥ 4 cells (the
  stage) and whose top row leads nowhere (no platform, door or path at the
  top). Optional wings: rows that also step down at both ends along the
  other axis.
- **Must not:** steps that climb to a platform, door or floor (those are grand
  steps).
- **Appears:** the steps drawn as stone benches; a stage floor with a low
  painted backdrop frame and two masks; braziers at the stage corners. Life:
  at dusk on some evenings 2–3 actors gesture on the stage and residents
  fill the seat sockets that R-M04 already makes.
- **Sits:** before R-M03 keep (see FX-01); keeps R-M04's step cutting.
- **How often:** rare, but people will build it once they know about it.
- **Cost:** a rule, 2 props and a small event.
- **Evidence:** `disc1-marble-stair` camera `theatre` (`theatre-as-keep.jpg`:
  crenellated, with a garrison marching round it).

### RC-08 Obelisk or victory column
- **Why:** a tall thin monument on a square is a classic landmark and a
  vista-stopper.
- **Trigger:** a marble structure with a footprint of 1 × 1, 3+ tall, whose
  ground cell stands on a plaza or has plaza on 2+ sides, with nothing on
  top.
- **Must not:** a 1×1 marble stack that touches any other block (it is a pier
  or a buttress); 1–2 tall (that is R-M06 plinth).
- **Appears:** by seed, either a tapering obelisk with a gilt pyramidion, or
  (4+ tall) a fluted column with a statue on top; a stepped base. The
  obelisk acts as a sundial: its shadow falls on hour marks painted into
  the plaza paving.
- **Sits:** before R-M07 terrace.
- **How often:** some.
- **Cost:** a rule and 2 parts.
- **Evidence:** `disc1-marble-stair` `q-nw` (`marble-podium-obelisk.jpg`: the
  4-high 1×1 on the forum drawn as four stacked boxes).

### RC-09 Barn and farmstead
- **Why:** a long low building beside fields is a barn. It should never read as
  a manor house with dormers and a portico.
- **Trigger:** a house structure of 1 storey, footprint ≥ 6, with no facade
  facing a street or plaza within 1, and a garden region of ≥ 6 cells or a
  landUse field within 4. If a cottage stands within 4 → the pair is a
  farmstead.
- **Must not:** within 6 of a square.
- **Appears:** big double doors on the long side and a hayloft door in the
  gable; a half-hipped roof with no chimney; hay bales, a cart. For a
  farmstead, the ground between barn and house is drawn as a packed-earth
  yard with a muck heap and chickens (L34 chickens, already drawn).
- **Sits:** before R-H09 manor (fixes FX-06).
- **How often:** some.
- **Cost:** a rule and a door/roof variant.
- **Evidence:** `disc1-farms` `q-se` (`farms-overview.jpg`, right: the red-roofed
  4×3 barn became a manor).

### RC-10 Bathing raft
- **Why:** a small platform moored offshore is where children swim and dive
  all summer.
- **Trigger:** a dock structure of 1–4 cells that touches no land and no
  other dock, with open water on all sides.
- **Must not:** within 1 of a stilt house (that is its landing).
- **Appears:** a ladder, a springboard on one edge and a towel. Life: by day
  1–3 children (L28) swim round it and jump off the board (with splash
  rings, L06).
- **Sits:** before R-D04 jetty.
- **How often:** some. Players click Auto onto the sea and get exactly this
  lone dock.
- **Cost:** a rule, a prop and a swimmer pose.
- **Evidence:** `disc1-auto-sprawl` `q-se` (`auto-sprawl.jpg` and the overview:
  a lone pair of Auto docks out at sea); `disc1-harbour` lone jetty at
  (28,0,34).

### RC-11 Breakwater (mole)
- **Why:** a stone arm out into the sea protecting the harbour is a mole. It
  has a parapet on the sea side, a walk on top, and waves bursting against it.
- **Trigger:** a marble structure at y = 0 over water, in a straight run of
  ≥ 4, one end touching land, a quay or a quay wall, with open water on both
  long sides along ≥ 3 cells.
- **Must not:** a run with land along one side (that is a quay wall).
- **Appears:** a parapet on the seaward side, a walk on top with bollards,
  and now and then foam bursts over the seaward edge (L06). Fishers sit along
  it (seat sockets). If a lighthouse stands at the end, it keeps its role.
- **Sits:** before R-M05 quay wall.
- **How often:** some harbour towns.
- **Cost:** a rule and a splash effect.
- **Evidence:** `disc1-harbour` camera `breakwater`, `q-se` (`harbour-overview.jpg`,
  bottom: the breakwater is a flat slab with bollards).

### RC-12 Market cross (or butter cross)
- **Why:** the market's centre is marked by a cross or a small roofed shelter.
  Vendors sit on its steps.
- **Trigger:** a plinth (R-M06) on a plaza with ≥ 2 stalls within 3; or a
  placed pillar 1–2 tall on such a plaza.
- **Must not:** any fountain within 2 (the fountain is then the centre).
- **Appears:** a stepped base with a tall shaft and a cross or finial. For a
  pillar: a small hexagonal roof on posts (a butter cross). A vendor sits on
  the steps with a basket.
- **Sits:** before D19 statue on that plinth.
- **How often:** some.
- **Cost:** a rule and a part.
- **Evidence:** `disc1-river-market` camera `market` (`market-square.jpg`: a
  generic statue among the stalls).

### RC-13 Stoa (market colonnade)
- **Why:** a long portico on the side of a square is a stoa or market hall
  with shops at the back.
- **Trigger:** an R-M01 temple whose roof footprint is ≥ 3 : 1 long to wide,
  with a long side facing a plaza within 1.
- **Must not:** a footprint of 6 cells or fewer (that stays a temple).
- **Appears:** a single-pitch roof sloping away from the square instead of
  pediments; small shop booths (stall goods) in the back bays; residents
  stand under it out of the sun.
- **Sits:** after R-M01 detects the pillars, before its pediment variant.
- **How often:** rare.
- **Cost:** a rule and a roof variant.
- **Evidence:** `disc1-marble-stair` camera `forum` (`marble-platform-top.jpg`,
  left: the blue-roofed temple on the forum's edge).

### RC-14 Bandstand (or rotunda)
- **Why:** a small open pavilion on a green or square, where a band plays on
  summer evenings.
- **Trigger:** an R-M01 temple (marble resting on pillars) whose roof is ≤ 4
  cells, standing on a plaza or garden region of ≥ 9 cells, or on bare grass
  ≥ 4 cells from any house.
- **Must not:** on a podium of more than 4 cells (a temple stays a temple).
- **Appears:** a round or octagonal dome roof, a railing between the pillars.
  At dusk on some evenings 3 musicians play inside, and residents gather and
  sit on the grass round it.
- **Sits:** before R-M01.
- **How often:** rare.
- **Cost:** a rule, a roof part and a small event.
- **Evidence:** `disc1-vertical-pile` camera `platform` (a slab on 4 pillars,
  read as a temple).

### RC-15 Colonnade, pergola or ruin
- **Why:** a row of free-standing pillars is either a covered walk or an
  ancient ruin. It is never just a row of pillars.
- **Trigger:** a straight run of ≥ 4 placed pillar stacks, each 1–2 tall,
  spaced 1 apart (adjacent) or 2 apart, with nothing on top.
  - Along a plaza or garden edge → a colonnade: a timber pergola with vines
    on garden, a stone architrave on plaza.
  - With no floor within 2 → a ruin: some capitals broken, ivy, a fallen drum
    on the grass.
- **Must not:** pillars carrying anything (supports, temples).
- **Appears:** as above. The pergola gets hanging lanterns at dusk.
- **Sits:** a new role for pillar structures (they have none today).
- **How often:** some.
- **Cost:** a rule and 2 parts.
- **Evidence:** `disc1-marble-stair` `q-se` (`marble-precinct-keep.jpg`, left: six
  bare pillars).

### RC-16 Cathedral (and cloister)
- **Why:** a big church with two towers is a cathedral. A court enclosed by a
  church's own buildings is a cloister.
- **Trigger:**
  - Cathedral: a chapel (R-H01) with a footprint ≥ 12 and 2+ storeys,
    touching 2 towers each ≥ 4 tall (town-wide, at most one).
  - Cloister: a courtyard (fact) of ≥ 4 cells enclosed on ≥ 3 sides by the
    chapel and houses touching the chapel.
- **Must not:** a cathedral within 8 of a keep (it stays a castle chapel).
- **Appears:**
  - Cathedral: twin west towers with spires, a rose window, flying
    buttresses (R-A03 if arches are present, else drawn pilasters), a big
    portal. The bell peal at dusk (L29) is longer.
  - Cloister: an arcaded walk round the court's inner facades, a well at the
    centre, herb beds; one cloaked figure walks it slowly.
- **Sits:** before R-H01 / D17.
- **How often:** rare. A prize for big builders.
- **Cost:** a rule and several parts.
- **Evidence:** none built; follows from RC-01 and FX-07.

### RC-17 Town gate (bridge gate)
- **Why:** a building straddling the street at the edge of town, or at a
  bridge end, is a town gate with a toll.
- **Trigger:** a house or marble structure that spans a street: a
  gateway-type arch (R-A04) with house or marble on both sides and no curtain
  wall or keep within 6; or a house standing on an arch at a bridge end.
- **Must not:** a castle within 6 (R-M02 gatehouse wins).
- **Appears:** a portcullis-less arch with a town crest, a toll booth window,
  and a lantern. A lounging toll-keeper stands at the gate by day.
- **Sits:** before R-M02 when there is no castle.
- **How often:** rare.
- **Cost:** a rule and a prop.
- **Evidence:** none built; seen in `disc1-vertical-pile` `q-se` (an arch between
  a house and a gateway).

### RC-18 Net lofts
- **Why:** tall, narrow, tarred net sheds on the beach (the Hastings net shops)
  are a fishing town's silhouette.
- **Trigger:** a tower structure of height 2–3 whose base stands on sand
  within 1 of water.
- **Must not:** touching marble or wall (castle turret); a height of 4+ (a
  lighthouse candidate).
- **Appears:** black weatherboard, a pitched cap instead of a cone, nets
  hanging from a pole, a winch. Fishers fetch nets here at dawn.
- **Sits:** before R-T07 watchtower.
- **How often:** some.
- **Cost:** a rule and a material variant.
- **Evidence:** `disc1-auto-sprawl` (Auto towers by the shore become
  watchtowers).

### RC-19 Schoolhouse
- **Why:** a town of this size always has a school, and children in a
  playground are irresistible to watch.
- **Trigger:** town-wide, at most one, in a town with ≥ 10 house structures:
  the 1-storey house of footprint 2–4 with the most bare grass or garden
  (≥ 4 cells) beside it that is enclosed by fence on at least one side,
  within 6 of a street junction.
- **Must not:** a house already holding a role other than cottage.
- **Appears:** a bell cupola on the ridge, tall windows, a hopscotch grid
  chalked on the yard. Twice a day the bell rings and the town's children
  (L28) run out to play in the yard for a minute.
- **Sits:** after the house roles, before R-H15.
- **How often:** most mid-size towns (one each).
- **Cost:** a rule, a cupola part and a schedule hook in L28.
- **Evidence:** none in the town (the role does not exist); the long street
  (`long-street-overview.jpg`) has an obvious candidate.

### RC-20 Granary on staddle stones
- **Why:** a small store raised on mushroom-shaped stones near the fields is
  a granary: it keeps the rats out.
- **Trigger:** a house structure of 1–2 cells, 1 storey, standing on
  generated supports (S-rule supports) with its floor 1 level above the
  ground, within 4 of a wheat field (R-G01).
- **Must not:** supports standing over water (stilt house).
- **Appears:** the supports become staddle stones; plank walls, a small
  ladder, sacks.
- **Sits:** before R-H15.
- **How often:** rare.
- **Cost:** a rule and a support variant.
- **Evidence:** `disc1-vertical-pile` (`vertical-overview.jpg`: the house on
  generated posts).

### RC-21 Folly tower instead of an inland lighthouse
- **Why:** a red-and-white lighthouse 10 cells from the sea is a joke. Inland
  it should be a belvedere or folly.
- **Trigger:** a lighthouse whose base is ≥ 6 cells from open water.
- **Must not:** within 6 of water.
- **Appears:** plain stone with a balcony and flag instead of the bands, no
  beam (L09 off), a telescope on the gallery.
- **Sits:** a variant of R-L01.
- **How often:** rare.
- **Cost:** a rule branch and a variant.
- **Evidence:** `disc1-vertical-pile` `q-se` (lighthouse on a house far from
  the sea, with a keeper's cottage).

---

## 2. Urban fill

### UF-01 ★ Burgage plots (back gardens behind a row)
- **Why:** the land behind a row of houses is divided into long strips, one
  per house: the oldest pattern in European towns.
- **Trigger:** a bare grass region (field, leftover or open patch) whose
  boundary is ≥ 75% placed fence or wall pieces plus the rear facades of ≥ 2
  different house structures. A rear facade is one with no main door, facing
  the region within 1.
- **Must not:** 3+ trees inside (U02 park); no house touching it (U02
  paddock).
- **Appears:** derived low fences that run each party wall out to the far
  fence, dividing the region into one plot per house. Each plot gets, by
  seed, a vegetable patch, a fruit tree at the far end, a shed or privy, a
  washing pole and a compost heap. Plots facing south get a bench. This
  extends U04 (now ≤ 6 cells, leftovers only).
- **Sits:** before U02 paddock and U04.
- **How often:** most towns where the player fences anything. `disc1-long-street`
  turned the fenced land behind six houses into a sheep paddock with a trough.
- **Cost:** a rule; reuses U04's props.
- **Evidence:** `disc1-long-street` camera `fenced` (`burgage-paddock.jpg`).

### UF-02 ★ Village green
- **Why:** the open grass that a village's houses face is its green, with a
  maypole, a big tree and often a pond.
- **Trigger:** a connected region of bare grass (wildGrass) of 9–60 cells,
  with ≥ 4 different house structures whose facades face it (faces 'ground'
  within 2, the cell in this region), and at least one street touching it.
  The region is not a leftover (leftovers are bounded; a green may be open on
  one side).
- **Must not:** within 4 of a plaza that holds a square (then it is the
  square's lawn); wheat or garden floor.
- **Appears:** lighter, mown grass with a worn edge; a maypole at the cell
  nearest the centroid, its ribbons fluttering with the wind (L04). If a tree
  stands on it: a ring bench round the tree. If water is within 2: the pond
  gets ducks (L15). One cell at the edge gets stocks or a village sign. It is
  an L22 destination; children (L28) play there.
- **Sits:** after U01–U06, which take the small enclosed patches first.
- **How often:** most villages. Players ring a patch of grass with houses all
  the time.
- **Cost:** a rule, the maypole prop and a ring bench.
- **Evidence:** `disc1-castle-village` camera `green` (`village-green.jpg`).

### UF-03 ★ Shops in the wall (tabernae, arcades and niches)
- **Why:** the owner's "weird area": the blank side of a big platform facing
  a strip of grass. Real towns hollow such walls into booths, workshops and
  fountain niches. Think of Roman tabernae under a temple podium, or the
  vaults under a city wall.
- **Trigger:** a marble facade run of ≥ 3 cells on storey 1, with a
  structure ≥ 2 tall, facing ground, a street or a plaza (faces in
  'ground' | 'street' | 'plaza' within 2), with no door and no window.
- **Must not:** a keep that keeps its role (castles stay blank and
  arrow-slit); facing water (a quay wall).
- **Appears:** along the run, one feature per 2 cells, chosen by seed and
  facing:
  - facing a street or plaza: an arched booth with a shutter and goods (a
    cobbler, a wine shop), or a wall fountain;
  - facing ground: an arched storeroom door, a bench in a niche, or ivy
    climbing 2 storeys.
  The first strip of ground in front is paved (a derived apron) where a booth
  opens onto it.
- **Sits:** after R-M roles; beside U08 nooks.
- **How often:** every town with a podium, a big terrace or grand steps. It
  answers the owner's example directly.
- **Cost:** a rule and 3–4 small parts.
- **Evidence:** `disc1-marble-stair` cameras `stair` and `under-platform`
  (`marble-stair-crenellated.jpg`, `marble-platform-top.jpg`); `gt6-overview.jpg`
  (the long blank walls of the terraced town).

### UF-04 ★ Country lanes (hedgerows, field gates and milestones instead of lamps)
- **Why:** outside the built-up area, roads are lined by hedges and walls,
  not lamps. Lamps every 4 cells across empty fields read as a suburb.
- **Trigger:** a street segment of ≥ 4 cells where no house, tower or plaza
  is within 3 of any of its cells (a rural run).
- **Must not:** a run that leads directly to a pier, a bridge or a castle
  gate (lamps stay there).
- **Appears:** no D01 lamps on the run. Instead:
  - a derived hedgerow along one side, broken by a field gate where the hedge
    meets a fence or a field;
  - a stone milestone every 8 cells;
  - at a rural junction, a wayside shrine or calvary with flowers (DC-01) in
    place of one of the lamps.
- **Sits:** before D01 street lamps (which then skip rural runs).
- **How often:** every town that reaches its edges, and every grown town's
  outer roads.
- **Cost:** a rule plus a hedge prop (U01 already draws hedges), a milestone
  and a shrine.
- **Evidence:** `disc1-farms` `q-se` (`farms-overview.jpg`: 22 lamps for 7 houses);
  `disc1-long-street` `q-se`.

### UF-05 Castle bailey
- **Why:** the ground inside a castle's curtain wall is a working yard, not
  a lawn.
- **Trigger:** bare grass or a courtyard region whose bounds are ≥ 60% curtain
  wall (R-E02 crenellated), castle turrets, a gatehouse or a keep.
- **Must not:** garden floor inside (that stays the castle garden).
- **Appears:** packed-earth ground; a well; a lean-to stable against the
  curtain wall with a horse's head looking out; a practice dummy and an
  archery butt; hay and a cart. Life: the garrison (L36) drills here at dawn
  before its patrol, and the rider's horse is stabled here instead of
  "tethered by the gate".
- **Sits:** before U02 and D17.
- **How often:** every castle (grown towns build one).
- **Cost:** a rule, 4 props and a small change to L36 and L37.
- **Evidence:** `disc1-castle-village` camera `gate` (`castle-bailey.jpg`);
  `grown-a-town.jpg` (lower right).

### UF-06 Lynchets and terrace fields
- **Why:** hillside terraces near a town are always worked: olive or vine
  terraces in the south, strip fields with dry-stone lips in the north.
- **Trigger:** a band of bare grass cells on one terrain level, ≤ 4 deep
  between a 1+ step down and a 1+ step up (or the island edge), ≥ 8 cells
  long, with distToStructure ≥ 2 and some house structure within 8.
- **Must not:** within 2 of a street (verges are U05's), or on rock tops.
- **Appears:** a dry-stone wall along the terrace lip (it replaces the raw
  earth edge); by seed and island character, either olive trees or vine
  rows every 3 cells (on a level ≥ 3), or alternate strips of hay and
  vegetables. Sheep (L34) graze the upper ones.
- **Sits:** after U07 retaining walls (which keep the street-side steps).
- **How often:** most hilly or steep generator-2 islands.
- **Cost:** a rule and 2–3 props.
- **Evidence:** `disc1-grown-b` `overview` (`grown-b-empty-terraces.jpg`: bare
  terraces below the town); `disc1-hill-town` `q-nw`.

### UF-07 Vineyard or allotments on a garden strip
- **Why:** a long thin garden on a slope is a vineyard. On flat ground near a
  row it is allotments. It is never a park lawn.
- **Trigger:** a garden region with long : short ≥ 3 : 1 and short side ≤ 3:
  - its cells beside a terrain step, or on terrain level ≥ 3 → vineyard;
  - otherwise, with 3+ houses within 4 → allotments.
- **Must not:** within 2 of a windmill (wheat); in a courtyard (herb garden).
- **Appears:**
  - vineyard: vine rows on posts along the long axis, a stone hut at one
    end, baskets;
  - allotments: strips divided crosswise every 2–3 cells, each with its own
    crop, a shed and a water butt.
  A gardener job (L23) works there.
- **Sits:** before R-G01's park-lawn branch.
- **How often:** some.
- **Cost:** a rule and a vine-row prop.
- **Evidence:** `disc1-hill-town` `q-nw` (`hillside-park-strips.jpg`: two 3-wide
  strips on the slope drawn as hedged park lawns).

### UF-08 Ford and stepping stones
- **Why:** where a path runs into a stream on one side and out on the other,
  people wade it. A desire line deserves a crossing.
- **Trigger:** two path dead ends facing each other across 1–2 cells of open
  water, in line (same x or same z), on river water (as in RC-03), not
  sheltered sea.
- **Must not:** an arch already spans within 2 cells.
- **Appears:** a row of flat stepping stones (or, if the water is 2 wide, a
  cobbled ford with a white ripple line). The walking graph gets a link at
  cost 3 (like grass), so residents use it and are drawn hopping.
- **Sits:** beside D03 (the dead-end bench stays on one side only).
- **How often:** some generator-2 islands.
- **Cost:** a rule, a prop and a walking-graph link (touches L24 routes).
- **Evidence:** `disc1-river-market` camera `ford` (`ford.jpg`: the path frays into
  sand and stops).

### UF-09 Quay apron
- **Why:** between a harbour street and its quay, the ground is always paved:
  it is the working quay.
- **Trigger:** bare grass or sand cells lying between a street and a quay
  (R-D01) or quay wall, within 2 of both.
- **Must not:** a beach with no dock within 2.
- **Appears:** a derived cobbled apron flush with the street, bollards on the
  water edge, net-drying racks, a few barrels; a fish auction spot when the
  fishing boat returns (LF-07).
- **Sits:** after D24 wild ground, which no longer grows there.
- **How often:** every harbour.
- **Cost:** a rule.
- **Evidence:** `disc1-harbour` cameras `quay-west` and `quay-east`
  (`harbour-backlane.jpg`, top right: a grass strip between the quay and the
  street).

### UF-10 Forecourt at the foot of grand steps
- **Why:** a monumental stair never ends in grass: it lands on a paved
  forecourt, usually with a processional way.
- **Trigger:** the cells that grand steps (R-M04) descend onto, the full
  width of the flight and 2 deep, if they are bare ground.
- **Must not:** water or another structure there.
- **Appears:** a derived paved apron matching the flight's width; a pair of
  lamps or urns at its outer corners; if a path lies within 4, a paved strip
  joining the apron to it.
- **Sits:** with DC-03 (lions at the head of the stair).
- **How often:** some (every grand stair).
- **Cost:** a rule.
- **Evidence:** `disc1-marble-stair` `q-se` (`marble-precinct-keep.jpg`: the east
  side stair ends in the grass).

### UF-11 Belvedere garden on a bare podium
- **Why:** a big raised platform with nothing on it becomes a terrace garden
  or a belvedere in any real town.
- **Trigger:** an R-M07 terrace with ≥ 9 walkable top cells, top level ≥ 2
  above the ground, no floor and no piece on its top.
- **Must not:** a keep, a quay wall, or a roof terrace on a house.
- **Appears:** potted citrus trees in a grid, gravel paths, a balustrade
  round the edge (J19 style), a pergola or a small fountain at the centre. A
  derived external stair (a prop, walkable) climbs one side from the nearest
  street or ground, so residents can reach it.
- **Sits:** after R-M07.
- **How often:** some.
- **Cost:** a rule, 2 props and a derived walkable stair (touches nav).
- **Evidence:** `disc1-marble-stair` `q-nw` (`marble-podium-obelisk.jpg`, bottom
  right: a 6 × 6 × 2 blank slab).

### UF-12 Drying green
- **Why:** before back yards were walled, washing was laid out on a common
  green behind the cottages.
- **Trigger:** bare grass of 6–20 cells touching the rear (doorless) facades
  of ≥ 3 house structures, not touching a street.
- **Must not:** fenced (that is UF-01), or larger than 20 cells.
- **Appears:** 2–3 washing lines on posts with garments that flutter (L04),
  sheets spread on the grass, a basket and a peg bag; a resident pegs out
  washing in the morning.
- **Sits:** after U04 (which takes up to 6 cells).
- **How often:** some.
- **Cost:** a rule; reuses the laundry-line prop.
- **Evidence:** `disc1-harbour` camera `backlane` (`harbour-backlane.jpg`: the
  grass between the two rows).

### UF-13 Desire-line shortcuts
- **Why:** where two paths come close across grass, feet wear a diagonal
  track.
- **Trigger:** two path cells of different streets (or of one street ≥ 8 apart
  along it) within 3 cells of each other across bare grass only.
- **Must not:** across garden, a fenced edge, or a step of 2.
- **Appears:** a worn dirt trail (the J08 trail drawing), walkable at cost 2.
  Residents take it.
- **Sits:** beside J08.
- **How often:** most towns.
- **Cost:** a rule and a walking-graph link.
- **Evidence:** `disc1-farms` `hamlet` and `disc1-harbour` `q-se` (roads that
  come within 2 of each other across grass).

### UF-14 Tilting yard (the lists)
- **Why:** a long fenced field near a castle is a tournament ground.
- **Trigger:** grass ≥ 3 × 8, with fences or walls along both long sides
  (gaps allowed), within 6 of a keep or gatehouse.
- **Must not:** fully enclosed with no gap and no castle (U02 paddock).
- **Appears:** a timber tilt barrier down the middle, two striped pavilion
  tents at the ends, pennants on poles. Life: sometimes the rider (L37) and a
  second rider joust, and a crowd watches from the fence.
- **Sits:** before U02.
- **How often:** rare.
- **Cost:** a rule, 3 props and an event.
- **Evidence:** `disc1-castle-village` camera `fields` (fence lines with a gap,
  read as nothing).

---

## 3. Decoration

### DC-01 Wayside shrine and calvary
- **Why:** a rural crossroads carries a cross or a small shrine with flowers,
  a place to rest.
- **Trigger:** a street junction with 3+ branches and no house within 4.
- **Must not:** a plaza within 4.
- **Appears:** by seed, a stone calvary on a stepped base, a niche shrine on a
  post with a little roof, or a big tree with a bench. Fresh flowers. One
  fingerpost is still allowed beside it.
- **Sits:** before D26 fingerpost at that junction.
- **How often:** some.
- **Cost:** a rule and 2 props.
- **Evidence:** `disc1-farms` `q-se`.

### DC-02 Cellar doors and split-level backs
- **Why:** a house whose back stands over a drop gets a cellar door and a
  balcony at the lower level. Hill towns are full of them.
- **Trigger:** a house facade on storey 1 whose drop (facades fact) is
  exactly 1 and which faces ground or a street on the lower level.
- **Must not:** a cliff house (R-H12).
- **Appears:** a low arched cellar door at the lower level with two steps and
  barrels; a small balcony on storey 2 on that side (p = 0.5).
- **Sits:** after J07 and J24 foundations.
- **How often:** most hilly towns.
- **Cost:** a rule and a door variant.
- **Evidence:** `disc1-hill-town` camera `terraces` (`hill-inn-row.jpg`).

### DC-03 Guardians at the head of the stair
- **Why:** monumental stairs are flanked: lions, sphinxes, urns, lamps.
- **Trigger:** grand steps (R-M04) 3+ wide, at the top row's two outer cells
  and the bottom row's two outer cells.
- **Must not:** narrower flights.
- **Appears:** a pair of lion statues (or urns, by seed) at the top; a pair
  of tall lamps at the bottom.
- **Sits:** beside D19.
- **How often:** some.
- **Cost:** a rule and a lion prop.
- **Evidence:** `disc1-marble-stair` camera `stair` (`marble-stair-crenellated.jpg`).

### DC-04 Ghost signs and painted gables
- **Why:** a tall blank gable wall facing a street or square carries a
  painted advertisement or a trained espalier.
- **Trigger:** a house facade on storey ≥ 2 with no window (J09 left it blank
  because a neighbour was missing or erased) and that faces a street or
  plaza within 3.
- **Must not:** a facade with a party wall (touching).
- **Appears:** by seed, a faded painted sign ("TEA", "SOAP", "BREAD", a
  painted pictogram), a sundial, or an espalier pear on the wall.
- **Sits:** after J09.
- **How often:** some. Every gappy row.
- **Cost:** a rule and decals.
- **Evidence:** `disc1-long-street` `q-se` (`long-street-overview.jpg`: rows with
  missing neighbours).

### DC-05 Fish weirs in the lagoon
- **Why:** sheltered shallow water near a fishing village holds wattle fish
  traps and posts with nets.
- **Trigger:** shelteredWater cells with sides ≥ 3, ≥ 12 such cells in one
  body, with ≥ 2 stilt houses (R-H04) within 6.
- **Must not:** in a boat lane (the sea-lanes fact).
- **Appears:** V-shaped wattle fences on stakes in the water, net-drying
  poles on the boardwalk edges, an eel basket. A fisher wades the weir at
  dawn.
- **Sits:** beside D24's reeds and lily pads.
- **How often:** some (lagoons and coves).
- **Cost:** a rule and 2 props.
- **Evidence:** `disc1-lagoon` camera `stilts` (`lagoon-stilts.jpg`).

### DC-06 Rope swing from a riverside willow
- **Why:** a willow over a river always has a rope swing.
- **Trigger:** a willow (R-P01) within 1 of river water (as in RC-03), p = 0.4.
- **Must not:** a willow beside the sea.
- **Appears:** a rope with a stick seat; children (L28) swing by day.
- **Sits:** beside D32.
- **How often:** some.
- **Cost:** a rule and a prop.
- **Evidence:** `disc1-grown-a` `town` (`grown-a-town.jpg`: willows along the river).

### DC-07 Horse trough and mounting block
- **Why:** a small stone block by an inn or a smithy door is a mounting block
  or a trough. Better than an unexplained cube.
- **Trigger:** a 1 × 1 or 2 × 1 marble structure 1 tall on bare ground or a
  path verge, within 2 of an inn, smithy or gatehouse door.
- **Must not:** on a plaza (R-M06 plinth).
- **Appears:** a trough with water, or a three-step mounting block.
- **Sits:** before R-M07 terrace.
- **How often:** some.
- **Cost:** a rule and 2 props.
- **Evidence:** `disc1-harbour` camera `sea-wall` (`blank-marble-box.jpg`).

### DC-08 Notice board and town crier spot
- **Why:** a square with a town hall has a notice board, and at noon the crier.
- **Trigger:** a town hall (U11) facing a square: one notice board on the
  square's edge cell nearest its door.
- **Must not:** a second town hall.
- **Appears:** a board with pinned papers. Life: at noon a crier with a bell
  stands on the step and residents gather briefly.
- **Sits:** after U11-F.
- **How often:** most towns with a square.
- **Cost:** a rule, a prop and a small event.
- **Evidence:** `disc1-harbour` camera `square` (`square-motif-offset.jpg`).

---

## 4. Life and events

### LF-01 ★ A wedding at the chapel
- **Why:** the most joyful event a town has, and it needs only a chapel and
  people.
- **Trigger:** a chapel (R-H01) whose main door connects by the walking graph
  to a plaza or street within 12. At most once per in-game day (seeded), by
  day.
- **Must not:** at night; while a ship call's crowd is gathered.
- **Appears:** the bells peal (L29); 6–10 residents gather on the path outside
  the door; a couple (white dress, dark coat) comes out; petals burst; the
  procession walks to the nearest square, where bunting appears for the rest
  of the day (D04 lines on that square). Children run ahead.
- **Sits:** beside the ship-call event in the event scheduler.
- **How often:** most towns.
- **Cost:** a behaviour, 2 actor looks and a petal particle.
- **Evidence:** every chapel town (`chapel-hip-roof.jpg`, `churchyard-herb-beds.jpg`).

### LF-02 ★ Market day
- **Why:** the square comes alive once a day: country carts, extra stalls,
  noise.
- **Trigger:** a plaza region with a square (3 × 3) and ≥ 2 stalls; daily in
  the morning (seeded day of week, so not every day).
- **Must not:** a square with no free cells.
- **Appears:** temporary stalls pop up (F05 pop-in) on free plaza cells, up to
  one per 6 cells; 2–3 carts drawn by a donkey arrive from the town edge
  (U06 dead ends or a dock) and leave at noon; crowd weights shift to the
  square (L22); a juggler or fiddler busks; pigeons (L12) increase. At
  noon the stalls fold away (F04 puff).
- **Sits:** with L22 day plans.
- **How often:** most towns with a square.
- **Cost:** a behaviour, a cart actor and a busker pose.
- **Evidence:** `disc1-river-market` camera `market` (`market-square.jpg`).

### LF-03 Ferry
- **Why:** where a river or channel is too wide to ford and there is no
  bridge, a ferry crosses on a rope.
- **Trigger:** two path dead ends or docks facing each other across 2–6 cells
  of open water (river or channel), with no arch spanning within 6.
- **Must not:** if UF-08 applies (1–2 cells of river water), use the ford.
- **Appears:** a flat punt with a ferryman hauling along a rope stretched
  between two posts; residents queue and ride across (a walking-graph link
  with a wait).
- **Sits:** beside L20 rower.
- **How often:** some generator-2 islands.
- **Cost:** a behaviour, a punt actor and a nav link.
- **Evidence:** `disc1-lagoon` camera `channel`; `disc1-river-market` camera `ford`.

### LF-04 Shepherd and flock
- **Why:** sheep that stay put are scenery. Sheep driven along the street at
  dawn are an event.
- **Trigger:** a paddock (U02) and wild grazing grass (L34) both exist,
  connected by streets.
- **Must not:** no paddock.
- **Appears:** at dawn a shepherd with a dog drives the paddock's animals
  along the streets to the wild grass, and back at dusk; residents step
  aside; the dog circles.
- **Sits:** with L34 grazers and U02.
- **How often:** some.
- **Cost:** a behaviour and a dog actor.
- **Evidence:** `disc1-long-street` camera `fenced` (`burgage-paddock.jpg`).

### LF-05 Night watchman
- **Why:** the lamplighter lights the town; the watchman walks it at night
  with a lantern and calls the hours.
- **Trigger:** a town with ≥ 12 house structures and no garrison.
- **Must not:** a garrison exists (its sentries do this).
- **Appears:** at night one figure with a lantern on a pole walks the street
  network in route order; a tiny "speech squiggle" on the hour; his lantern
  lights the cobbles round him.
- **Sits:** beside L08 and L25.
- **How often:** most towns.
- **Cost:** a behaviour.
- **Evidence:** any dusk shot (`harbour-overview.jpg`).

### LF-06 Children swimming and skimming stones
- **Why:** a beach by a town is used.
- **Trigger:** a sand beach run of ≥ 4 cells within 8 of a house.
- **Must not:** within 2 of a dock with a ship berthed.
- **Appears:** by day 1–3 children (L28) at the water's edge skim stones (a
  skipping ring trail, L06) or paddle; with RC-10 they swim to the raft.
- **Sits:** with L28.
- **How often:** most towns.
- **Cost:** a behaviour.
- **Evidence:** `disc1-long-street` `q-se`, `disc1-auto-sprawl` `q-se`.

### LF-07 The catch comes in
- **Why:** when the fishing boat returns, a small crowd haggles at the fish
  stall and the gulls go wild.
- **Trigger:** the L18 fishing boat moors at dusk and a fish stall (R-S01) or
  a quay apron (UF-09) is within 6 of its berth.
- **Must not:** no fish stall or apron.
- **Appears:** the fisher carries baskets to the stall; 3–5 residents gather;
  gulls (L11) land on the stall roof; the cats (L33) appear.
- **Sits:** after L18.
- **How often:** most harbour towns.
- **Cost:** a behaviour.
- **Evidence:** `disc1-harbour` camera `square`.

### LF-08 Punts in the lagoon
- **Why:** a stilt village moves by boat between houses.
- **Trigger:** shelteredWater of ≥ 30 cells with ≥ 3 stilt houses.
- **Must not:** none.
- **Appears:** a punter poles a flat boat slowly between stilt-house docks,
  stopping at each; residents of stilt houses use it as a route.
- **Sits:** beside L17 and L20.
- **How often:** some.
- **Cost:** a behaviour; reuses the rowboat with a pole pose.
- **Evidence:** `disc1-lagoon` camera `stilts` (`lagoon-stilts.jpg`).

### LF-09 Garrison drill and the changing of the guard at the gate
- **Why:** the garrison marches; it should also drill and present arms.
- **Trigger:** UF-05 bailey exists.
- **Must not:** none.
- **Appears:** at dawn the troop drills in the bailey (turns, presents pikes)
  before its patrol; the changing of the guard at the gate swaps two
  sentries with a little ceremony.
- **Sits:** extends L36.
- **How often:** every castle.
- **Cost:** a behaviour extension.
- **Evidence:** `disc1-castle-village` camera `gate` (`castle-bailey.jpg`).

---

## 5. New primitives

The tray is small by design. I propose only two pieces, both because many
recognitions above need them and no rule can produce them.

### NP-01 Hedge (an edge piece, alongside fence and wall)
- **Why:** in the countryside the hedge is the main boundary. Players reach
  for it to make fields, parks and mazes. U01 already draws derived hedges,
  so the look exists.
- **Rules it enables:** paddocks and fields read as countryside (UF-04
  hedgerows become placeable); a garden enclosed by hedges in a spiral or
  zigzag pattern of ≥ 12 edges becomes a maze with a statue at the centre
  (a recognition); a hedge round a house front makes a front garden.
- **Cost:** a new `EdgeKind` ('hedge') in the save format, J20 runs, an R-E01
  style, and the tray. This touches the engine.

### NP-02 Water (a placeable shallow-water floor)
- **Why:** terrain cannot be edited, so players cannot make a moat, a mill
  pond, a canal, a garden pool or a duck pond where they want one. Water is
  half of urban delight.
- **Rules it enables:** a moat (water round a curtain wall: a drawbridge on
  the gateway), a canal with a lock where it meets the sea, a mill race (with
  RC-03), a reflecting pool in front of a temple, lily ponds in parks, a
  village duck pond (with UF-02).
- **Cost:** a new floor kind with render, nav (not walkable) and boat rules
  (no boats). This touches the engine and is the biggest item here.

---

## 6. Faults

Ranked by how often they show times how bad they look.

### FX-01 ★ Temple podiums, grand stairs, theatres and stair ledges become castle keeps with a garrison
- **Where:**
  - `disc1-marble-stair` cameras `q-se`, `stair`, `theatre`
    (`marble-precinct-keep.jpg`, `marble-stair-crenellated.jpg`,
    `theatre-as-keep.jpg`);
  - `disc1-vertical-pile` `court-nw` (`inhabited-viaduct.jpg`, lower right:
    5 marble ledges with stairs drawn as a keep).
- **What is wrong:** the temple's podium has battlements and arrow slits; a
  garrison of 4 marches round it, a knight trots across the forum, and a
  second garrison patrols the theatre.
- **Cause (from inspect):** the great stair and the platform are one marble
  structure (#1, 572 cells, same colour), so R-M03's "mostly a flight of
  steps" test fails and it becomes a keep; L36 and L37 then follow any keep.
  The theatre (#641, 36 cells) is a keep for the same reason.
- **Fix:** RC-07 and a new "podium" branch ahead of R-M03. A marble
  structure carrying a temple (R-M01), or with R-M04 steps cut into it, or
  with a floor or plinth on ≥ 25% of its top, and no tower, wall or gateway
  touching it, is a podium: a moulded base and cornice, a balustrade on the
  top edge, no battlements, no garrison. UF-03 then furnishes its walls.

### FX-02 ★ Inn and shop glut
- **Where:**

  | Town | Houses | Inns | Shops |
  |---|---|---|---|
  | `disc1-harbour` | 24 | 8 | 0 |
  | `disc1-hill-town` | 25 | 14 | 4 |
  | `disc1-river-market` | 18 | 7 | 0 |
  | `disc1-long-street` | 30 | 0 | 19 |
  | `disc1-grown-a` | 68 | 1 | 35 |
  | `disc1-grown-b` | 83 | 1 | 44 |

  Images: `hill-inn-row.jpg`, `harbour-overview.jpg`, `grown-a-town.jpg`.
- **What is wrong:** a whole terrace of inns; a quay of inns; every
  two-storey house on any street is a shop, so no street is residential and
  the high street does not stand out.
- **Cause:** R-H06 (6+ cells, 2+ storeys, a facade on a street or plaza) and
  R-H07 (2+ storeys on a street) have no town-wide limit and no idea which
  street matters.
- **Fix:**
  - Rank streets. The high street is the street region touching the main
    square, or else the longest; streets within 4 of a square also count.
  - Shops: on ranked streets and plazas only, at most 1 per 3 house
    structures town-wide, picked by distance to the square. Everywhere else a
    two-storey house is a dwelling (cottage or townhouse with doorstep
    dressing).
  - Inns: at most one per square, one per quay (RC-02 takes the rest), one
    per bridge end and one per castle gate, the largest candidate each. A
    town always gets at least one inn and one bakery.

### FX-03 ★ Fingerposts in clusters
- **Where:**
  - `grown-town-6` `town` (`gt6-harbour-fingerposts.jpg`: white crosses all over
    the harbour plaza);
  - `disc1-grown-a` camera `fingerposts` (`fingerpost-cluster.jpg`).
  - Counts: 27 in grown-town-6, 38 in disc1-grown-a, 22 in disc1-grown-b. In
    grown-a, 7 stand in the 4 × 2 patch (18–21, 6–7).
- **What is wrong:** they read as clutter (white sticks), not as signposts.
- **Cause:** D26 treats every path cell with 3+ path neighbours as a
  junction; a 2-wide street, or a path running beside a plaza, makes nearly
  every cell a junction.
- **Fix:** merge junction cells within 3 of each other into one junction (keep
  the one with the most distinct branch directions); require ≥ 6 cells
  between posts; skip junctions on a plaza edge.

### FX-04 Street lamps through empty countryside
- **Where:** `disc1-farms` `q-se` (`farms-overview.jpg`: 22 lamps, 7 houses);
  `disc1-long-street`; `disc1-auto-sprawl`.
- **What is wrong:** suburban lighting along field lanes.
- **Cause:** D01 lights every street of ≥ `lampStreet` cells regardless of
  frontage.
- **Fix:** UF-04.

### FX-05 Chapel with a square footprint gets a pyramid roof, and a path over a chapel makes a roof terrace
- **Where:**
  - `disc1-long-street` camera `church` (`chapel-hip-roof.jpg`: a 3 × 3
    chapel reads as a village hall);
  - `disc1-castle-village` camera `chapel` (`chapel-roof-terrace.jpg`: a
    path laid across the chapel roof turned it into a flat terrace with a
    parasol and deck chair).
- **What is wrong:** the church loses its silhouette.
- **Cause:** J04 roof-type's "path leads onto it → flat terrace" and "else
  hip" apply because the chapel role names no roof; J05 then furnishes it.
- **Fix:** the chapel names its roof: a gable along the axis away from the
  steeple; a square footprint gets a cross gable (a transept). Chapels
  never get a flat terrace; a path that runs onto the roof is ignored.

### FX-06 A barn becomes a manor
- **Where:** `disc1-farms` `q-se` (`farms-overview.jpg`, right).
- **What is wrong:** a one-storey 4 × 3 farm building gets a hip roof,
  dormers, two chimneys and a portico.
- **Cause:** R-H09 needs only footprint ≥ 10, whatever the storeys.
- **Fix:** RC-09 barn before R-H09. Require 2+ storeys for a manor.

### FX-07 Churchyards and walled gardens beside chapels become herb beds and espalier gardens
- **Where:** `disc1-harbour` `chapel` (`churchyard-herb-beds.jpg`);
  `disc1-long-street` `church`.
- **What is wrong:** it misses the obvious reading.
- **Cause:** R-G01's courtyard → herb beds, and U02's walled garden, have no
  chapel branch.
- **Fix:** RC-01.

### FX-08 The plaza's radial motif ignores the fountain
- **Where:** `disc1-harbour` camera `square` (`square-motif-offset.jpg`).
- **What is wrong:** on an 11 × 5 square the red radial circle sits in the
  western 5 × 5 while the tiered fountain stands 3 cells east of it, so the
  square has two centres.
- **Cause:** J22 centres the motif on the region's first largest square;
  R-F01 does not tell it where the fountain is.
- **Fix:** if a tiered fountain stands on the plaza, centre the motif on it
  when the motif fits there; otherwise omit the motif.

### FX-09 Blank, unreachable marble boxes
- **Where:**
  - `disc1-harbour` camera `sea-wall` (`blank-marble-box.jpg`: a 2-cell
    1-tall marble on the beach, role terrace, drawn as a featureless box);
  - `disc1-marble-stair` `q-nw` (a 6 × 6 × 2 podium);
  - `disc1-marble-stair` forum (a 4-high obelisk drawn as stacked boxes).
- **What is wrong:** they read as concrete blocks, and no one can stand on
  their tops.
- **Cause:** R-M07 terrace is the default for any marble with no other role;
  nothing furnishes a terrace that no path or stair reaches.
- **Fix:** RC-08, DC-07, UF-11; and a terrace 1 tall beside a path could
  simply take the J17-style carved step so it is walkable.

### FX-10 Watchtower spam in Auto towns
- **Where:** `disc1-auto-sprawl` `middle` (`auto-sprawl.jpg`: 10 watchtowers
  among 45 houses).
- **What is wrong:** every Auto stack of 3+ with a free run becomes a
  round tower (K4), so a clicked cluster bristles with cone roofs. It is
  charming once, noise after that.
- **Cause:** K4 tower is "a free run of 3+" with no regard to neighbours.
- **Fix:** an Auto stack of 3+ whose base is side by side with an Auto or
  house cell resolves to a house (it merges into a townhouse), unless no
  other tower stands within 4. This keeps the occasional tower and turns
  clusters into tall houses.

### FX-11 Garrison and rider for any keep
- **Where:** `disc1-marble-stair` (2 garrisons and a rider for a temple
  precinct with no walls); see the sequence
  `.context/shots/seq/disc1-marble-stair-patrol.png`.
- **What is wrong:** soldiers patrol temples and theatres.
- **Cause:** L36 counts a keep alone as a castle.
- **Fix:** follows from FX-01. Also require a keep alone to have a gateway,
  a turret or curtain wall within 4 before it gets a rider (L37).

### FX-12 Seven-cell boathouses and empty lagoon shores
- **Where:** `disc1-river-market` `bend` (`river-market-overview.jpg`: an
  8-cell, 2-storey house on the river bank became a plank-walled boathouse);
  `disc1-lagoon` (6 boathouses).
- **What is wrong:** a two-storey 2 × 2 house as a boathouse misreads; on
  rivers it is a mill (RC-03), and in a stilt village the boathouse rule takes
  most of the stilt row's ends.
- **Cause:** R-H05 accepts footprints up to 4 and 2 storeys at any water.
- **Fix:** RC-03 first on rivers; R-H05 for 1-storey houses only, or 2
  storeys with footprint ≤ 2.

---

## Appendix: counts and how to reproduce

```
npm run shots -- disc1-<name>            # all cameras, by day (q-*, close-ups, dusk-*)
npm run inspect -- disc1-<name>          # roles, props, actors, rules
```

Prop tallies used above (from `inspect`):

| Town | Fingerposts | D01 lamps | Inns | Shops | House structures | Retaining-wall props |
|---|---|---|---|---|---|---|
| harbour | 1 | 20 | 8 | 0 | 24 | 6 |
| hill-town | 1 | 23 | 14 | 4 | 25 | 8 |
| castle-village | 3 | 17 | 1 | 2 | 18 | 0 |
| river-market | 1 | 26 | 7 | 0 | 18 | 4 |
| marble-stair | 0 | 9 | 0 | 0 | 4 | 0 |
| lagoon | 1 | 14 | 1 | 0 | 23 | 1 |
| farms | 1 | 22 | 0 | 1 | 7 | 0 |
| vertical-pile | 1 | 9 | 1 | 0 | 10 | 0 |
| auto-sprawl | 0 | 14 | 1 | 7 | 45 | 0 |
| long-street | 1 | 13 | 0 | 19 | 30 | 0 |
| grown-a | 38 | 37 | 1 | 35 | 68 | 6 |
| grown-b | 22 | 34 | 1 | 44 | 83 | 67 |
| grown-town-6 | 27 | 39 | 1 | 19 | 40 | 61 |

(House structures counts every house structure in `inspect`, including
stilt houses and roles other than cottages.)
