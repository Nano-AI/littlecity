# Monuments handoff

Branch `swarm/monuments`. Brief: `docs/swarm/art-review-1.md`, section "Monuments".

## Done (art review 1, must fix)
- M1 castle walls: keep, gatehouse, quay wall in coursed stone with string courses,
  quoins, corbel table, seeded darker stones, slits and glazed top-storey windows,
  a door at the head of grand steps. `src/gen/marble/marble.gen.ts`,
  `src/rules/roles/R-M03.castle.ts`.
- M2 battlements: merlons on cell lines, solid corners, inner-corner post;
  gatehouse blocks embattled.
- M3 abutments: arch ends run 0.1 into house walls, 0.5 into round towers, with
  imposts. M4 raking buttress (`src/gen/arch/rake.ts`). M5 voussoir rings, coping,
  warmer arch stone (`MONUMENTS.archTint`).
- M6 timber piles under `plank-walls` houses or houses beside a dock
  (`timberLegs` in `src/gen/support/supports.gen.ts`).
- M7 clock dials use `PATTERN.glow`; keep windows use `glass`.

## Bandstand as a pavilion (2026-11-20, branch `swarm/pavilion`)
- R-M11 is drawn as a park pavilion by two generators sharing one layout
  (`src/gen/marble/pavilion.ts`): the marble draws plinth, rail, entablature,
  roof, drum and lantern; each pillar draws the columns standing in its own cell.
  The rule claims each pillar's role slot and pins a `pavilion-bay` feature on it
  carrying the footprint (mask, x0, z0) and the ground under it, because a pillar
  may only read its own hash. Change the layout in `pavilionLayout` only: both
  sides call it, and they must agree.
- 2 × 2: regular octagon. One-wide plans (1 × 4, L, T, S): half-octagon ends,
  equal-pitch hipped roof built as a per-cell fan (`roofFan`). Stack 3+: raised
  plinth, columns +0.3 per storey (capped), a glazed clerestory drum and an
  upper tier. The open bay faces `bandstand:<side>` (path, else plaza).
- Fragile: a pillar under a bandstand with no column in its cell would draw
  nothing (no footprint does that today; `pavilion.test.ts` checks every one).
  Damage is per structure: pillars topple their own columns, the marble loses its
  roof; with only the pillars wrecked the roof still stands over them (as a temple's).

## Not done
- Would-be-nice list: temple triglyphs and tympanum ornament, more seeded variety
  on towers, pillar entasis on generated pillars. Skipped on instruction.
- Chipped corners / uneven courses on stone: only the seeded darker stones exist.

## Next
- Nothing in progress. If a second review comes, start with the temple.

## Gotchas
- `npm run check` has not been fully green in one run since the fix pass: at load
  average 15 to 20 the timing tests fail (`tests/e2e/interface.e2e.test.ts` "phone:
  touch", `src/gen/terrain/terrain.test.ts` "quick enough"). Each passes run alone
  (`-t "phone: touch"`). Typecheck, lint and all other tests pass. Retry when idle.
- Big combined shell commands get killed (exit 137); run tsc, eslint, vitest apart.
- One part per feature type: tower, lighthouse, marble and arch generators draw
  their own cap, window, door, gallery, bollard and never ask the registry.
- A generator may read only what the structure hash covers; J15 pins pier depth
  and opening shape as feature params for that reason.
- Scenario name `R-L01` (not `R-L01.lighthouse`): the gallery e2e filter test.
- `src/parts/monuments/monuments.test.ts` draws every monument in every fixture;
  it catches doubled faces and missing socket frames fast.
- Seams and requests for other owners: `docs/swarm/requests/monuments.md`.
