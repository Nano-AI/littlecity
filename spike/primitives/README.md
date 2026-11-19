# Primitive assets spike (throwaway)

A single-file Three.js mockup that answers one question: **can code-built 3D
primitives look like a hand-drawn isometric illustration, and feel alive?**
Answer so far: yes. See `shots/`.

This is a spike. It has no game logic, no tests and no build step. Nothing here
is meant to be kept as product code; it exists to prove the look and to give the
rule-logic planning something concrete to point at.

## Run it

```sh
cd spike/primitives && python3 -m http.server 8765
# open http://localhost:8765/
```

Three.js 0.170 loads from the jsDelivr CDN through an importmap, so it needs a
network connection. Drag to orbit, right-drag to pan, scroll to zoom. The
"whole island / primitives / stacking" buttons jump between views.

## What's in it

- **Grid:** 1 cell wide, one storey `H = 0.8` tall, ground at `G = 0.3`. Every
  vertical piece is a multiple of `H`, so pieces stack flush.
- **Primitives** (factory functions in `index.html`): `house` (stackable floors,
  optional roof), `stoneWall`, `fence`, `pillar`, `arch`, `stairs`, `tree`,
  `cypress`, `bush`, `windmill`, `lighthouse`, `lamp`, `magicBlock`, plus
  props: `person`, `boat`, `rowboat`, `bench`, `flowerBed`, `flagPole`, `gull`.
- **Motion:** windmill sails, walkers, chimney smoke, boats, swaying trees,
  lighthouse beam, drifting water.

## How the look is made

1. **Flat illustration shading.** A custom shader gives each surface 3–4 stepped
   tones from one fixed light direction. There are no real lights.
2. **Automatic ink lines.** The scene renders three times per frame:
   colour + depth, then a per-mesh ID + normal pass, then a full-screen
   composite that draws an ink line wherever depth jumps, the surface creases,
   or the mesh ID changes. New pieces get outlines with no per-asset line work.
3. **Paper.** Cream background, grain and slight line wobble are added in the
   composite.

## What this means for the rule logic

- **Seams follow mesh IDs.** Two parts with different IDs get an ink line
  between them; parts that share an ID (or one merged geometry) read as one
  surface. So "merge these neighbours" is mostly "give them one ID". That is the
  mechanism for joined roofs, long pillars and solid masses.
- **In this snapshot every piece is hand-placed and blind to its neighbours.**
  Two stacked pillars still show two bases and two capitals. There is no cell
  map and no rules yet.

## Known gaps in this snapshot

- **Performance is unmeasured and the build style won't scale.** One house is
  about 50 meshes; the scene is about 1,210 meshes and about 2,500 draw calls
  per frame. A real game needs each block's parts merged or instanced, with the
  ink ID carried per part. The 20 fps counter came from a browser with no
  graphics card and says nothing about real speed.
- Line wobble is too strong and reads as jitter.
- Paper grain is too faint to see.
- All trees are identical.
- Overlapping path strips show seams at junctions.
- Detail density is well below the reference art; open grass looks bare.

A second round is in progress on these (neighbour-aware merging for pillars,
walls, fences, arches and a new marble block; calmer lines; varied trees; merged
paths; visible grain).

## Design decisions from the planning chat

- **Pure toy.** No money, no goals. Place pieces and watch the town live.
- **One catalogue of primitives.** The player can place any primitive directly.
  A **magic block** is a block that picks a primitive for itself from its
  surroundings, and keeps adapting as neighbours change. Directly placed pieces
  never change.
- **Everything moves.** Motion is a core requirement, not polish.
- **Verticality.** Anything stacks on anything; supports grow under overhangs.
- **Square grid, Three.js, runs in the browser.**
- **Proposed rule approach (not yet approved):** a 3D cell grid; each primitive
  has a "fits when" rule over its 6 neighbours plus ground/water/air context;
  a magic block takes the best-scoring primitive, with ties broken by a stable
  per-cell hash; edits re-check only nearby magic blocks, bottom-up, with an
  iteration cap; a separate joinery pass decorates the seams between cells
  (joined roofs, railings, stairs, pillars under overhangs).
- **Open question:** when a magic block has already resolved and something is
  built on top, may it change again, or does it lock?
