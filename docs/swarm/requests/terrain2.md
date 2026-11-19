# Terrain 2: the second island generator (2026-11-19)

Design section 6, "Terrain, second generation". Branch `swarm/terrain2`.
This page records the changes to frozen files and what other owners now
need to do.

## 1. Frozen files changed (allowed by the orchestrator)

- `src/core/world.ts`: one optional field, `World.terrainGen?: 1 | 2`. Absent
  means generator 1. Generator 1 worlds never carry the field
  (`emptyWorld(seed)` and `initialWorld(seed, t)` leave it out), so every
  existing world, test town and fixture is the same object as before.
  `applyEdit` spreads the world, so the field rides through every edit and
  undo step. Nothing else in the file changed.
- `src/scenario/scenario.ts`: `ScenarioDef.terrainGen?: 1 | 2`, read only
  with `terrain: 'generated'`; default 1. The built world records 2 when
  asked. `TerrainBuilder.set` still clamps hand-made heights to 6.

## 2. How old towns keep their island

- `generateTerrain(seed, gen = 1)`: gen 1 is the old generator, untouched
  (its helpers moved to `src/terrain/noise.ts` verbatim; a digest of ten
  seeds' heights, materials and starting trees taken before the change is
  pinned in `src/terrain/terrain.test.ts`). Gen 2 is `src/terrain/terrain2.ts`.
- `terrainOf(world)` regenerates the island a world stands on. The app uses
  it for autosaved towns, share links and town files; new islands and the
  dice use `NEW_ISLAND_GEN` (2). `?seed=<n>&gen=1` opens a generator-1
  island (the e2e tests that open `?seed=` are pinned this way).
- Share codec version 3 = version 2 plus one byte after the seed (the
  generator). Only a town on generator 2 is written as version 3; a town on
  generator 1 encodes byte for byte as before (version 1, or 2 with styles),
  and every old link and file decodes as before. Town files say
  `"littleCity": 3` for those towns.
- Pinned to generator 1 (explicit `terrainGen: 1`): `everything`,
  `grown-town-*`, `logic/island`, `look-generated*`, the gallery's layer
  specimens, and the townmaker tests.

## 3. Grow a town (`src/townmaker`): what it still has to learn

Today it never throws on generator-2 islands and every edit is legal
(`tests/terrain2-town.test.ts`, 40 seeds of every character: 106 to 435
blocks, against 300+ on generator 1). It does not know about rivers or
steep ground yet:

- **Bridging rivers.** A river can split the island (about a third of
  islands with rivers). Streets on two banks stay unjoined. It should find
  straight crossings of 2 to 5 river columns between low banks and lay a
  stone bridge (arch blocks at y = 0, `R-A01` fires on river water exactly
  as on the sea; see `scenarios/terrain2/look-terrain2-river-town.scenario.ts`
  for a finder), and route streets over it.
- **River banks.** Mills (a windmill or mill house by the water), quays and
  quay walls, boathouses, stilt houses and willows all suit a river bank;
  river columns are open water at height 0 with grass banks (sand only near
  the mouth). Reed beds in the sheltered water of a river.
- **Steep islands.** Heights reach 10, with faces of 2 to 6 levels and
  narrow shelves. The town belongs on the plain by the shore (there is
  always 60+ columns of flat low ground); the castle, lighthouse, lookout and
  observatory belong on shelves and summits, reached by stairs up the faces
  (grand steps). Rock-topped ground is ordinary ground for building.
- **Archipelagos.** Two or three landmasses: one town per landmass, or
  bridges where the channel is narrow enough; docks and piers between them.

## 4. Notes for other owners

- **Logic (`src/resolve/kinds.ts`, K3 lighthouse):** "open water within 4
  columns" counts a river, so an Auto column of 4+ beside a river becomes a
  lighthouse. Probably it should want the sea (open water connected to the
  map border by a wide way); left as it is.
- **Look (shaders, not touched):** rock tops are drawn with `PATTERN.rock`
  on top faces (the existing blotchy flat with cracks), split from the grass
  along a wandering contour in the mesh, with mossy and dry vertex colours
  near the border. A softer blend (grass ticks thinning into stone) would
  need the grass pattern to accept a second "distance from rock" channel.
- **Animation / boats:** the sea lane already circles the outside of split
  islands and lagoons (rays from the map edge stop at the first land);
  checked on 12 islands of every character. The rower and the fishing boat
  route through any open water, rivers included.
