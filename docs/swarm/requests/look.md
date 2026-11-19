# Contract changes and notes from Look (Stage 1)

Everything here is additive: nothing was renamed or removed, and code
written against the Stage 0 contracts compiles and behaves as before.

## Changes made to frozen files

### `src/gen/mesh.ts`: three new pattern ids

```ts
PATTERN.glow = 25          // a self-lit surface (lamp glass, lanterns): unshaded by day, radiant at dusk and night
PATTERN.planksAcross = 26  // wood boards running along z; PATTERN.planks runs along x
PATTERN.beam = 27          // a shaft of light: drawn translucent and never inked; `edge` runs 0 at the source to 1 at the tip
```

Why: `MeshData` has no emissive channel and is frozen, so "this surface
shines at night" has to be a pattern (`glass` already lights up at dusk by
itself; `glow` is for lamps). Planks are drawn in world space and a pattern
id is the only way to say which way the boards run. The lighthouse beam of
design section 12 is the one translucent thing in the town; `beam` routes it
to the overlay pass.

All 24 Stage 0 pattern names are now drawn by the shader (they were names
only). `docs/swarm/ART.md` section 5 shows each.

### `src/render/api.ts`: one new optional view option

```ts
interface ViewOptions { ink?: 'auto' | 'full' | 'half' }
```

The half-resolution ink pass for phones (design section 14). Default
`'auto'`: half on a small touch screen, full elsewhere.

### `src/life/api.ts`

No change. `LifeStage` and `InstanceHandle` are implemented as written.

## How the thin spots of CONTRACTS.md section 16 turned out

- **`liftStructure` is cheap.** Static geometry is baked into one vertex pool
  per chunk, and every vertex carries a slot index into a small float texture
  of matrices. Lifting a structure re-points its vertices at a fresh slot
  (one small buffer upload, no rebuild, no extra draw call); `release()`
  points them back. A structure that changes while lifted stays lifted.
  So the landing bounce can simply be: `setTown`, then `liftStructure` for
  each new or changed structure, move it, `release()`.
- **`setParams` is cheap** (one texel). The shader reads `a` as glow (1 = lit
  as the time of day says, 0 = off) and `b` as a sway phase offset. `c` and
  `d` are free for parts. A negative `a` is reserved (the view marks its own
  ghost slots with it).
- **Props and actors are not `InstancedMesh`.** They share one vertex pool
  and one draw call, each with its own slot, so parts may differ per item
  (seeded variation) at no cost in draw calls. The whole frame is about 11
  draw calls whatever the town holds.
- **`TownView.setCamera` cuts; `orbit`, `pan` and `zoomBy` glide** toward the
  new pose over a few frames (damping runs on `signals.time.seconds`).
  `getCamera()` returns the goal pose; `screenToRay` and `worldToScreen` use
  the pose on screen.
- **`setTown(shape, null)`** leaves the previous props exactly where they
  were until `setDressing` arrives (it does not re-anchor them to the new
  shape).

## Things other owners should know

- **Generators and parts for a view** come from `registriesFor(plan)`
  (`src/render/registries.ts`): discovery, unless an override matches the
  plan. The look scenarios install one for seeds `0x100c00`–`0x100cff`
  (`scenarios/look/fixtures`), so those scenarios keep drawing the fixture
  house, tree, marble, pillar, stairs, path, plaza and lamp after the real
  ones exist. No other town is affected. A gallery entry may use the same
  hook.
- **The terrain layer reads `plan.world`** (blocks and floors standing at a
  step in the ground), to square a rounded terrace corner under them. Its
  `hash` covers that. Flat ground ignores what is built on it.
- **`PATTERN.grass` reads `edge`** as "distance from sand" when it is below
  1.5 (the terrain uses this to draw beaches). Anything else leaves `edge`
  at `EDGE_FAR` and gets plain grass.
- **`PATTERN.water` reads `edge`** as the distance to the shore (foam rings
  and a pale shallow band inside about 0.6). Leave it at `EDGE_FAR` for
  still water with no shore marks.
- **WebGL 2 is required** (Three.js 0.187 has no WebGL 1 path), so the
  colour pass and the normal-and-ink-id pass are always one pass with two
  render targets.
- New style modules: `look` and `grade` (`src/style/look.ts`), `terrain`,
  `wind`. All live, all with slider ranges for the gallery.

## Second pass (during Stage 2)

No further changes to frozen files. Things that changed for other owners:

- **Grounding.** The view draws the town from straight above into a height
  picture (only when geometry changes or something moves) and shades the
  ground from it: contact, cover under overhangs, a short cast shade, a
  darker foot on walls. `docs/swarm/ART.md` section 11 says what follows for
  geometry. Strength: `LOOK.ground` (0 switches it off). For Animation and
  People: anything that moves makes the picture redraw, at most every other
  frame; it costs one extra pass over the geometry on those frames.
- **Draw calls.** A still town is still about 11 calls a frame. A frame in
  which geometry changed or something moved adds about 10 (the height
  picture); a frame with the ghost showing adds 2.
- **`styleVersion()` is in every cache key.** A changed style value rebuilds
  every mesh on the next `setTown` or, failing that, the next `render`, and
  keeps lifted structures lifted and props on their slots (the handles life
  holds stay valid). Values in the modules `look`, `grade`, `wind` and
  `time` are read every frame and cost no rebuild.
- **`setParams`**: a negative `a` (glow) is reserved; the view marks its own
  ghost slots with it. `c` and `d` are free.
- **The ghost** is drawn from the same generators with pencil lines where
  the ink groups change. Interface need not do anything.
- **New style values**: `PALETTE.grassHigh`; `TERRAIN.levelTint`;
  `LOOK.ground`, `LOOK.seaKeep`; `GRADE.<part>Slope` and `GRADE.<part>Cast`.
  `terraceGrass(level)` in `src/style/terrain.ts` gives the terrain's grass
  colour at a level, for lawn and garden pieces that should match it.
- **New look scenarios**: `look-generated`, `look-generated-2`, `-3`, `-4`
  (the real generator, four seeds, four sides).

## Third pass (art review 1)

One additive change to a frozen file, `src/render/api.ts`:

```ts
interface ViewStats { rebuild?: { generators; layers; parts; view; structures; vertices } }
```

Where the last `setTown` / `setDressing` spent its time, in milliseconds: inside structure
generators, inside layers, inside prop and actor parts, and in the view itself. `npm run bench`
could print it; `node src/render/testing/bench.mjs [scenario ...] [--auto]` already does, on any
scenario (the standard bench's edits are not legal in `everything`).

For other owners:

- **Houses: the rebuild budget.** After one edit the view itself spends well under a
  millisecond; four fifths or more of the rebuild is inside structure generators, because a merged
  structure is regenerated whole (on `bench-2000`: 2 structures, about 10,000 vertices per edit).
  If the 8 ms budget is to hold on big merged houses, the generator has to get cheaper per cell or
  cache per cell.
- **Animation, People: actors and anything from `stage.spawn` / `spawnMesh` are kept out of the
  grounding picture.** They throw and receive no shade, and moving them every frame costs one
  small texture upload. Props and lifted structures are in it: moving one redraws it (at most every
  other frame, about ten extra draw calls on those frames). So make things that move all the time
  actors, not props.
- **The layout is built lazily**: `setTown(shape, null)` no longer builds it; the first
  `stage.socket()` or `setDressing` after an edit does.
- **Terrain**: banks are `PATTERN.rock` with `edge` = rockiness; ledges on faces of two levels or
  more stay clear of anything built at the foot (the terrain hash already covered those cells).
- **Grade**: per part of the day `Tint`, `Shade`, `Chroma`, `Contrast`, `Sea` in the `grade` style;
  `gradeColor()` in `src/render/grade.ts` is the reference arithmetic.

## Requests

None outstanding.
