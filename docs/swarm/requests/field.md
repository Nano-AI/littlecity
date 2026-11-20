# Field: changes outside my own files

- **`src/core/kinds.ts` (frozen):** `FloorKind` gains `'field'`, appended to `FLOOR_KINDS`
  and `isFloorKind`. Nothing else. Saves need no format change: floors are stored as
  `FLOOR_KINDS.indexOf`, so a field is byte 3 (never written before); old saves decode as
  they did, and a town with no field encodes byte for byte as before (tested in
  `src/rules/roles/field.test.ts`).
- `src/resolve/nav.ts`: a field cell's `NavSurface` is `'garden'` (`NavSurface` is in the
  frozen `plan.ts`; this avoids touching it). Same cost and floor height as a garden.
- `src/resolve/structures.ts`: field cells never join across a terrain step (a court must be
  flat): each level is a field of its own.
- `src/resolve/engine/hash.ts`, `src/resolve/facts/occupancy.fact.ts`: `'field'` appended to
  their kind code lists.
- People (`src/parts/people/pose.ts`, `extras.ts`, `src/life/people/people.system.ts`):
  ten sport poses appended; `racket` and `mallet` tools appended; `toolOf` gives them to a
  person lingering with the errand tag `field:racket` / `field:mallet` (three lines).
- `src/life/town/index.ts`: `fieldChain()` added to `allChains()` (before market day).
- `src/ui/pieces.ts`, `src/ui/icons.ts`: the Field piece (Ground drawer, after Plaza) and icon.
- Test lists: `townmaker.test.ts` (ROLES and PENDING), `guide.test.ts` (ALL),
  `coplanar.test.ts` (scans `field-courts` too), `gallery/specimens.ts` (a field specimen),
  `tests/e2e/interface.e2e.test.ts` and `held-length.e2e.test.ts` (Field in the Ground drawer).
