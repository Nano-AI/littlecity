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
buttons under the title jump between views (whole island, primitives, stacking,
joinery, trees + paths).

## What's in it

- **Grid:** 1 cell wide, one storey `H = 0.8` tall, ground at `G = 0.3`. Every
  vertical piece is a multiple of `H`, so pieces stack flush.
- **Primitives:** house, marble block, stone wall, fence, pillar, arch, stairs,
  round tree, cypress, bush, windmill, lighthouse, lamp, magic block, plus
  props (people, boats, bench, flower bed, flag, gulls).
- **A tiny cell map** (see the `cell model` section of `index.html`):
  `put(type, i, k, level)` records a piece at a grid cell, and a build step
  reads each cell's neighbours before emitting geometry. Paths and plaza tiles
  live in a second, ground-level map.
- **Motion:** windmill sails, walkers, chimney smoke, boats, swaying trees,
  lighthouse beam, drifting water.

## How the look is made

1. **Flat illustration shading.** A custom shader gives each surface 3–4 stepped
   tones from one fixed light direction. There are no real lights.
2. **Automatic ink lines.** The scene renders three times per frame:
   colour + depth, then a per-mesh ID + normal pass, then a full-screen
   composite that draws an ink line wherever depth jumps, the surface creases,
   or the mesh ID changes. New pieces get outlines with no per-asset line work.
3. **Paper and pen.** The composite adds paper grain (after the sRGB
   conversion, or it disappears) and a small static irregularity in line
   position and weight. The time-based "line boil" is off by default.

## Joinery rules the spike already implements

These are hand-written, per-type neighbour checks. They are the first evidence
that "look at the neighbours, then draw" gives the merged look.

- **Pillar:** a vertical stack becomes one continuous shaft, with a base only on
  the bottom cell and a capital only on the top.
- **Marble block:** only faces that border a non-marble cell are emitted, so a
  cluster reads as one solid mass.
- **Arch:** no cornice between stacked tiers; the cornice and parapet run
  through neighbouring arches, so a 2×2 group reads as one viaduct.
- **Wall and fence:** segments join along a run with continuous caps and rails;
  ends and corners get posts or piers.
- **House:** a stack is one building, with base trim only at the bottom and a
  roof only on top. The roof becomes a flat terrace if something sits above.
- **Paths:** all path cells build into one mesh with rounded ends and corners.

## What this means for the rule logic

- **Seams follow mesh IDs.** Two parts with different IDs get an ink line
  between them; parts merged into one geometry read as one surface. So "merge
  these neighbours" is mostly "emit them as one mesh and skip the faces between
  them". The spike batches geometry by part, colour and pattern.
- **There are no magic-block rules yet.** Every piece type is chosen by hand in
  the scene script. The magic block is only a visual placeholder.

## Known gaps

- **Performance is unmeasured.** The scene is about 1,000 meshes and about
  2,100 draw calls per frame. The 20 fps counter came from a browser with no
  graphics card and says nothing about real speed.
- **Batching is global.** All marble in the world is one mesh. A real game would
  rebuild per area on each edit.
- **Houses are not merged.** The map drives them, but each is still about 50
  separate meshes, and side-by-side houses don't join into row houses.
- **Arches only run east–west.** Arch rotation isn't supported.
- **Walls and fences only join their own type on the same level.** They don't
  attach to houses.
- **The marble bevel is drawn in the shader,** not a real chamfer.
- Detail density is still well below the reference art; open grass looks bare.

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
