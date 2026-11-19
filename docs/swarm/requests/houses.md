# Notes and requests from Houses (Stage 2)

Nothing here blocks anyone. Section 1 is the only place I touched files I do
not own; sections 2 and 3 are the seams other owners should know about.

## 1. Three files outside my paths that I had to change

Each of these pinned "no real rules exist yet", so each broke the moment a
real house rule did. The changes are the smallest that keep what the file
was testing.

| File | Was | Now | Why |
|---|---|---|---|
| `src/scenario/scenario.test.ts` ("a failed check names the scenario…") | `checkScenario(s)` must throw `role at (10, 1, 10): expected cottage, got none` | must throw any `[check-test] …` failure | R-H15 gives every house the cottage role, so that exact message can never come back. The test still shows that `checkScenario` resolves with the discovered rules, not the demo ones. |
| `src/scenario/scenario.test.ts` ("a rule fixture is a scenario with an expect()") | `checkScenario(fixture)`: demo rules **plus** the discovered ones | `resolveScenario(fixture, { rules: [] })`, then its `expect()` | The demo smoke rule makes one actor per chimney-top socket in a cell with no key; with a real chimney on the same cell that is two candidates on one anchor, which the engine rejects. The test is about the fixture pattern, so it now runs on the demo rules alone. |
| `scenarios/examples/pipeline-demo.scenario.ts` | its scenario-local rules read every window, door and chimney socket; its joinery ran last | they read only the sockets their own rule made; its joinery runs first | Real windows, doors and chimneys now exist on the same houses. Running first keeps the plain feature ids its `expect()` names. It still shows what it was written to show. |

Request: bless these, or tell me the preferred shape and I will redo them.
Monuments and Ground may have hit the same two tests.

## 2. Things I shipped that sit on another owner's seam

- **Awning, hanging sign, flower box** (`src/parts/openings/*.part.ts`) are
  prop parts, and **windmill sails** is an actor part. The rules that emit
  them are Stage 3's: D07 and D09 (Dressing), L03 (Animation). So that
  houses look finished today, `scenarios/houses/standins.ts` exports
  `houseDressing`: three scenario-local rules (`X-D07.shop-dressing`,
  `X-D09.flower-boxes`, `X-L03.sails`) written to the catalogue. Every house
  scenario lists them in `rules`. **In the real app shops have no awnings,
  windows no flower boxes and mills no sails until those three rules exist
  in `src/rules`.** Each stand-in can be moved there as it is (rename the id);
  or add `houseDressing` to the `everything` scenario for Gate 2.
- The sails take `windmill-sails.size` (added in `src/vocab/houses.vocab.ts`):
  sail length from the hub, 0.78 for a one-cell mill, +0.22 per further cell.
  The hub socket's +Z runs along the windshaft, out of the cap, tipped up by
  0.1 rad; the wheel lies in the socket's XY plane and turns about Z.
- **R-H01 sets the tower's role to `steeple`** (CONTRACTS section 8 describes
  exactly this). Monuments: read `plan.roles` for it; do not claim the role
  again.
- **`cap/mill-cap` is drawn by the windmill generator**, not by a `cap` part
  (the cap has to fit the tower's neck), and the generator fills the
  `mill-hub` anchor itself. A `cap` part never sees a windmill.
- **`collar` (J12) is a feature of the house**, at the tower's lowest cell.
  The house generator draws it: a stone block the width of the cell from the
  wall top to just above the roof line, with a trim lip. A tower drawn
  inside it needs no base of its own on that cell.
- **`ladder`** (R-H04 uses it, so does R-D02): the house generator draws a
  plain timber ladder itself unless a `ladder` feature part is registered, in
  which case it calls that part on the wall plane. So Ground can add
  `ladder.part.ts` without a clash.
- **J06 gives a main door to houses and windmills only.** Towers and
  lighthouses are left to their owner. If Monuments wants J06 to cover them,
  it is one line (the kind test in `J06.main-door.rule.ts`), and the door
  part will draw on any wall plane it is given.

## 3. Conventions other generators can rely on

- **Wall-plane frames.** `window`, `door`, `balcony` and `portico` parts draw
  on a wall plane: origin on the wall surface at the storey's floor, +X to
  the viewer's right, +Y up, +Z out. The house generator passes
  `faceFrame(cell, dir)` moved 0.07 in (`HOUSE.inset`); the windmill passes a
  frame on its leaning round wall. A tower that wants `window/slit` features
  drawn passes the frame of its own wall to `placeFeatures` the same way.
- **Personality.** `personalityOf(seed, colour, role, cells)` in
  `src/style/houses.ts` is what a structure decides once: window family, roof
  colour (never close to the wall colour), trim, accent, door look, storey
  bands, timbered gables, weatherboarded upper storeys, thatch. Rules and
  parts both call it, so J09's "a window from the structure's family" and the
  shutters' colour cannot disagree. A Dressing rule that wants a prop to
  match its house can call it too.
- **J01, J02 and J03 have no rule file.** They are how the generator draws
  (base trim only where a cell stands on something; one outline, one wall
  ink group; each structure keeps its own walls and roof). Their fixtures are
  `scenarios/rules/J01…J03`, and the geometry is tested in
  `src/gen/house/house.test.ts`. J03's ridge offset is the `roof.lift` J04
  gives each roof.
- **J08's steps are set by the door rules** (`door.steps`, 5 per storey of
  drop, one storey at most); the J08 rule file emits the trails.
- **J05 runs before J04** (priority 965, not 950), because it decides a
  region is a terrace before J04 would give it a pitched roof. It is the one
  place I left the `1000 − n × 10` convention; nothing of another owner's
  runs between 960 and 970.

## 4. What I read beyond the obvious

The house generator reads only what `hashStructure` covers. Two notes for
whoever widens or narrows that hash:

- it reads the **kind** of each side neighbour (a `stairs` block beside a
  terrace leaves the parapet open there; any solid block makes that side a
  party wall with no eave) and the terrain height of the side columns. It
  does not read diagonal neighbours, which the hash does not cover;
- trail features (J08) are drawn on ground cells outside the structure. They
  are features of the house, so they are in its hash; the terrain height of
  those cells is implied by the feature's cell.
