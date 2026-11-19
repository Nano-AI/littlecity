# Dressing handoff (branch `swarm/dressing`)

Brief: decoration (D) and urban-fill (U) rules plus their prop parts. Order set by the orchestrator:
tier 1, then U01, U02, U08, U04, U05, U06, U09–U12, then D03, D04, D06, D08, D15, D10, D11, then the
rest of D. Commit after every rule. No sub-agents. `yaoderek/bloom-s-monkey-city-builder` is merged
up to its commit ad31e81 (merge commit 6510524) and the full `npm run check` was green there
(1089 tests). Dressing costs about 10 ms of the 30 ms budget on bench-2000 (D01 2.5 ms is the most).

## Done (rule in `src/rules/`, fixture in `scenarios/rules/`, part in `src/parts/props/`)
D01 D02 D03 D04 D05 D06 D07 D08 D09 D10 D11 D13 D13-T D15 D20 D24, U01 U02 U03 U04 U05 U06 U07 U08,
U12 (centre half). Shared fixtures: `U06.town-edge` also covers U05; `D06.hanging-lanterns` also
covers D11; `D15.dock-goods` also covers D08. Show town: `scenarios/gallery/dressing-town`.
Stand-ins for D07/D09 are gone everywhere (`houseDressing` now holds only the L03 sails).

## Next
- The rest of D in catalogue order: D12 D14 D17 D18 D19 D21 D22 D23 D25–D28 D30–D34. None started.
  Sockets waiting: `statue-base` (D19), `roof-ridge` (D12), `chimney-top` (D14), `seat` on steps.
- NOT to build here: U09 (vista-end feature on a facade), U10 (corner entrance, oriel), U11 (civic
  hall role), the edge half of U12 (thatch, timber). All need house-generator features or a house
  personality change (Houses' files); written up in `docs/swarm/requests/dressing.md` section 2b.
- Known look debts: espaliers read a little like small palms; the pier pennant's staff is thin;
  street trees are plain lollipops; a laundry line may cross above a public stair.

## How things fit (read before adding a rule)
- `src/rules/decoration/clearways.fact.ts`: `free(cell, pos)` is the one test for "may a prop stand
  here" (doors, stairs, path lines, retaining walls, shape-stage claims). Always use it.
- `src/rules/urban/land-use.fact.ts` decides what each leftover IS (front garden > field > back
  yard > pocket park); urban rules only dress its lists. `plots.ts` has `plotOf`, `placer`, `emit`.
- Facts exist so that EARLIER rules leave room for later ones: `bankWalls` (U07), `townEdge` (U06),
  `streetEnds` (D03 benches at a view) are all read by D01 or clearways.
- Densities are rolled with `lucky(seed, RULE, cell, key, DRESSING.x)` in `find()` (live style
  values), never the engine's `chance`. Seed by the candidate's own cell: stability is tested in
  `src/rules/decoration/dressing.test.ts`.
- Frames: a prop at an edge slot with `face: opposite(d)` has +X toward side `(d + 1) % 4`; the cell
  line is at z = −0.15; a house wall is 0.07 behind it. Flat-tone kit normals (TONE) are world
  directions: anchor those props with `face: 2`, or use `localTone(face)`.
- Priority = 1000 − 10 × catalogue number; `about` must contain "Reads: … Claims: …" (tested).
- Several parts may live in one `*.part.ts` (named exports). Every prop type needs a line in
  `CASES` in `src/parts/props/props.test.ts`.
- Houses' `R-H99.role-props` also dresses doors (decoration stage, priority 895); D11 defers to it.

## Gotchas
- Full `npm run check` takes 6 min. `tests/e2e/interface.e2e.test.ts` "one-finger drag" is flaky
  under load (fails on the untouched base, passes alone). Per-rule commits are gated with
  `tsc`, `eslint .` and `vitest run --project unit` (about 40 s).
- `tools/inspect.mjs` was changed to flush stdout (see `docs/swarm/requests/dressing.md`).
- Do not do O(props) work inside `apply()`: it runs per candidate (D11 cost 4 ms on bench-2000 that way).
