# Ground handoff (art review 1 fix pass)

Branch `swarm/ground`, main merged. Work order: `docs/swarm/art-review-1.md`,
section "Ground", must-fix notes in order, then seams against real buildings.
No forks. Commit after each note. Finish with `npm run check` green.

## State
- **G1 trees: done** (`8f00f9a`). `src/gen/tree/species.ts`.
- **G2 stairs: done.** Lighter tread slabs with a nosing, uneven and worn
  treads by seed, sides against a wall run `STAIRS.into` into it, closed.
- **G3 curtain wall: done.** Batter, corbel course, parapet band, merlons
  wider than gaps, slits; stone tint from the tower it touches (tag
  `stone:N` pinned by R-E02).
- **G4 iron railing: done.** Thin flat-toned bars, six a cell, lighter iron
  (`FENCE.iron*`); on a house roof edge J20 pins `run-inset` per edge and
  `buildRun` moves the line 0.07 inward (corners move on both axes). J19
  skips cells on a house roof (the house draws a parapet) and doors or
  stair heads on bare terrain.
- **Next:** G5 plaza motif (`src/gen/floor/plaza.gen.ts`, function `motif`),
  then seams against real buildings, then `npm run check`, then report.

## What each remaining note needs
- G5: rings in `PALETTE.plaza` and `stoneShade` with a thin `brick` course,
  radial joints, accent no wider than 0.1. No red ring, no yellow disc.

## Tricks and gotchas
- **Flat tones** (`src/parts/ground/kit.ts`): a lump whose vertices all carry
  `TONE.lit` / `TONE.shade` draws as one flat tone. Two tones meet where two
  round surfaces cross, so the boundary is a curve; lit and shade are 32°
  apart, which also gives a faint pen line. `toneAt(t)` on ONE smooth surface
  gives a soft boundary with no line (pine skirts). TONE normals are world
  directions: only under translation and uniform scale, never rotation.
- **Crowns**: light parts use `PATTERN.none`, shade parts `PATTERN.leaves`
  (the review wants marks in the shade only). Do not cut the underside of a
  core lump (`facing`/`cut`): the hole shows from the default camera.
  Outlines need 16 sides on a core; budgets are in `tree.test.ts` (max 620).
- **Generators may read only what the structure hash covers** (own cells, six
  neighbours, side-column terrain, role, tags, features). Anything else: a
  joinery rule pins a feature (`floor-link`, `run-end`).
- House walls stand 0.07 inside the cell; marble faces are on the cell line.
- Scripted patches: write a python file under `/tmp` and run it; compound
  shell commands with heredocs are refused in this sandbox.
- `npm run shots -- <name>` takes one pattern per call; shots land in
  `.context/shots/`. The machine is loaded: e2e tests can time out; rerun.
- Never edit other owners' files; seams go in `docs/swarm/requests/ground.md`.
