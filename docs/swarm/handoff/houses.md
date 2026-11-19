# Houses handoff (branch `swarm/houses`)

## State
Art review 1 (`docs/swarm/art-review-1.md`, Houses section): all must-fix
notes on the house side are done and committed.

- H1 big roofs: ridge and hip caps (`ridgeCaps` in `src/gen/roof/roof.ts`),
  tile tone bands, J10 rewritten (cross gable, dormers, roof lights).
- H2 chapel: buttresses (`buttress` in `house.gen.ts`), lancets, porch
  (in `door.part.ts`, variant `double` when the role is chapel), rose, cross.
- H3 flues: `chimney.against` makes a brick breast on the taller wall.
- H4 terrace: rule `J05.terrace-edges` emits `coping`; no parapet there.
- H5 trails: `trail.part.ts`, lawn's ink group, vertex-colour fade.
- H6 loggia door: `houseFacts.roofDoorAt` + J26; housing in `rooftop.ts`.
- Role props: `R-H99.role-props.rule.ts` + `role-prop.part.ts`; greenhouse
  plants are drawn by the generator behind the glass.

Nothing is half-done. Not started: the would-be-nice list (ladder fixing,
battered foundation, lead flashing on the collar, window rhythm on long walls).

## Waiting on other owners (written up in `docs/swarm/requests/houses.md` §5)
- Ground: player fence edge pieces on a house roof still stand on the cell
  line, 0.07 outside the wall (G4). J19 railings are already inset.
- Monuments: timber stilts under `plank-walls` houses (M6/H7).
- Stage 3: awnings, flower boxes and sails come from stand-in rules in
  `scenarios/houses/standins.ts` until D07, D09 and L03 exist.

## Gotchas
- The generator may read only what `hashStructure` covers: no edge pieces,
  no diagonal neighbours, no other structure's features. Pin anything else on
  the house with a rule (that is why `coping` exists).
- A door whose cell is ABOVE the house's top cell is a roof door (J26).
- Trails lie at y = 0.005, under any floor, or they z-fight the path into ink scribbles.
- J05 runs at 965 (before J04) and `J05.terrace-edges` at 805 (after J19).
- `window`, `door`, `balcony`, `portico` parts draw on a wall plane (origin
  on the wall, +Z out); `onWall` in `house.gen.ts` supplies it.
- The bash sandbox refuses heredocs mixed with other commands: write files
  with the Write tool, edit with short python scripts.
- `tests/e2e/interface.e2e.test.ts` (touch gestures) fails differently on
  each run when the machine is loaded; it failed before any Houses change.
- Check a fix in its fixture (`npm run shots -- '<rule id>*'`), then in
  `everything` (25 cameras, includes dusk and night).
