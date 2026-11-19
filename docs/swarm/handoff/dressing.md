# Dressing handoff (branch `swarm/dressing`)

Brief: decoration (D) and urban-fill (U) rules plus their prop parts. Orchestrator's order after
tier 1: U01, U02, U08, U04, U05, U06, U09–U12, then D03, D04, D06, D08, D15, D10, D11, then the rest.
Commit after every rule. No sub-agents. Before the final report: merge
`yaoderek/bloom-s-monkey-city-builder`, remove `houseDressing` D07/D09 stand-ins from
`scenarios/core/everything.scenario.ts` (keep the L03 sails one), `npm run check` green.

## Done (rule + fixture in `scenarios/rules/` + part)
D01 D02 D05 D07 D09 D13 D13-T D20 D24 U03 U07 (tier 1, commit fc4e17b). U01 pocket park. U02 fenced field. U08 nooks. U04 back yards.

## In progress / next
- Next: U05 street trees, U06 town edge, U12; then the D list.
- Vocabulary for ALL of these is already declared in `src/vocab/dressing.vocab.ts`; parts for
  goods-stack, wall-fountain, cart, kiosk, shed, veg-patch, washing-pole, woodpile, street-tree,
  signpost, dirt-trail, bunting, cafe-table, creeper, doorstep, rope-coil, lobster-pot, net-rack
  are NOT written yet (they draw as fallback markers until they are).
- U09, U10, U11 need house-generator features (shape stage, Houses' files): report, do not build.

## How things fit (read before adding a rule)
- `src/rules/decoration/clearways.fact.ts`: `free(cell, pos)` is the one test for "may a prop stand
  here" (doors, stairs, path lines, retaining walls, shape-stage claims). Always use it.
- `src/rules/urban/land-use.fact.ts` decides what each leftover IS (front garden > field > back
  yard > pocket park); urban rules only dress its lists. `plots.ts` has `plotOf`, `placer`, `emit`.
- Densities are rolled with `lucky(seed, RULE, cell, key, DRESSING.x)` in `find()` (live style
  values), never the engine's `chance`. Seed everything by the candidate's own cell: stability is
  tested in `src/rules/decoration/dressing.test.ts`.
- Frames: a prop at an edge slot with `face: opposite(d)` has +X toward side `(d + 1) % 4`; the cell
  line is at z = −0.15. Flat-tone kit normals (TONE) are world directions: anchor those props
  with `face: 2`, or use `localTone(face)`.
- Priority = 1000 − 10 × catalogue number, `about` must contain "Reads: … Claims: …" (tested).
- Several parts may live in one `*.part.ts` (named exports). New prop types need a line in
  `CASES` in `src/parts/props/props.test.ts`.

## Gotchas
- Full `npm run check` takes 6 min; `tests/e2e/interface.e2e.test.ts` "one-finger drag" is flaky
  under load (fails on the untouched base, passes alone). Per-rule commits are gated on
  `tsc`, lint and `vitest run --project unit` (10 s).
- `tools/inspect.mjs` was changed to flush stdout (see `docs/swarm/requests/dressing.md`).
- Bash here refuses heredoc-heavy compound commands now and then: write a patch script to /tmp
  and run it.
