# Little City — design

Date: 2026-11-19. Status: awaiting Derek's approval.
Build plan: [swarm master plan](../plans/2026-11-19-little-city-swarm-master.md).
Companion file: [rule catalogue](2026-11-19-little-city-rule-catalogue.md).
Reference build: `spike/primitives/` (throwaway look mockup; proves the art style).

## 1. Intent

A tiny, whimsical city-building **toy** that runs in the browser. You place
blocks on a small island; the town works out how to make them look good and
then comes alive: sails turn, laundry flaps, lamps light at dusk, people walk
real routes through whatever you built.

Why it exists: Derek loves Townscaper's "place a block and it becomes
something pretty" mechanic, but finds it creatively limiting and static. He
misses the feeling of Bloons Monkey City, where a little town moves and does
things. This is that feeling with far more to build, strong verticality, and a
hand-drawn look that is visibly its own thing.

The bar: it looks hand-drawn, is clearly not Townscaper, looks better than
Townscaper, and is the easiest possible city builder to play.

## 2. Goals, non-goals, anti-goals

**Goals**

- Pure toy: no money, no goals, no fail state, no tutorial needed.
- One catalogue of placeable pieces, plus an **Auto block** that picks a
  structural kind from its surroundings and keeps adapting.
- A deep, layered **rule system** that turns a few placed blocks into chapels,
  shops, temples, sky bridges, harbours and so on. Rule depth is the product.
  The catalogue is meant to be large and to keep growing.
- Verticality: terrain with hills and cliffs; anything stacks; supports are
  generated so nothing ever looks broken.
- Everything moves: wind, dusk cycle, birds, boats, people on real routes.
- Hand-drawn look from code only: ink lines, flat stepped tones, paper grain,
  seeded imperfection. No imported art.
- Works on Mac (mouse, trackpad) and phone (touch).
- Built by a swarm of parallel agents, so module contracts are fixed up front.
- **Open-ended.** Adding a rule, a part, a role or even a new tray piece
  after the first build is a small, local change (section 20). The first
  catalogue is a starting point; discovery passes (section 21) keep growing
  it.

**Non-goals (first version)**

- Economy, scoring, quests, unlocks.
- Flowing water, lifts, cable cars, weather, seasons, residents who decorate
  over time, the above-the-clouds setting. All later.
- Terrain editing. The island is generated and fixed.
- Accounts, a server, a shared gallery, multiplayer.
- Townscaper's irregular grid. The grid is square.
- Letting the player override derived details (roof style, which shop).
- Music. Drag-painting on touch.

**Anti-goals (these make it a failure even if it works)**

- Auto blocks that feel random: flicker, far-away edits changing things, the
  same town looking different after reload.
- A plastic, generic-3D look.
- Rules that delete or rewrite what the player placed. Rules only add derived
  things; saved data changes only through player actions.
- A tray or interface that needs explaining.
- Any `Math.random()` or wall-clock time in town logic.

## 3. Decisions so far

Derek decided:

1. Pure toy. Browser. Three.js. All art generated in code by the builders.
2. Auto block resolves only to structural kinds; always adapts until the
   player sets its kind; the Change tool cycles Auto → kinds that fit → Auto;
   hovering shows a ghost preview.
3. Blocks merge when they touch and share kind and colour. A new block copies
   the colour of the block it was placed on; on bare terrain it gets a palette
   colour; a paint tool recolours.
4. Marble block: for plazas, bigger buildings and structure.
5. Fences (and low walls) can fill a cell and can also sit on a cell edge.
6. No floating. Arches may hang as long as they are attached. Supports are
   generated, never placed.
7. Random island each time, fixed terrain with real height, medium size.
8. Free camera.
9. Animations are in scope, as rules: laundry lines between facing houses,
   flags, street lamps that appear once a street is long enough, birds tied to
   street length, a dusk cycle, a bounce when pieces land, people who follow
   routes. The boat models in the spike are bad and must be redone.
10. Rules look well beyond six neighbours and should be ambitious.
11. Phone and Mac. Bigger ideas (section 2) come later.
12. This chat owns the design doc and the delegation.

My calls (Derek has not confirmed these; each is easy to reverse):

- Sound: synthesized placement sounds and quiet ambience, mute button, no
  music. Built last.
- Saving: one autosaved town, a share link, a "new island" button, postcard
  image export.
- TypeScript, Vite, Vitest, Playwright for screenshots. No UI framework.
- Orthographic camera with free orbit, pan and zoom (as in the spike), with
  the tilt clamped so you cannot look from under the island.
- Paths, plazas and gardens are floor overlays, not blocks.
- Buildings act as vertical connectors for people (enter a door, leave by
  another door or the roof terrace).
- The tray gains five pieces Derek did not list: path, plaza, garden,
  fountain, market stall (section 6).
- Colour on bare ground: only Auto, house and tower get a varied palette
  colour there. Marble, pillars, arches and docks get their default tint, so
  a plaza built click by click still merges into one mass.
- Erasing a block also removes any floor or edge piece that was resting on
  top of it, in the same undo step. Blocks are never removed as a side
  effect.
- Town logic runs in two stages: shape first (instant), dressing (props,
  birds, people) a frame or two later, popping in.

## 4. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| 1 | **Tile lookup** (Townscaper): a hand-made piece per corner pattern, chosen by which of 8 surrounding slots are filled | Most direct art control. Needs 50+ authored pieces per style and caps how wild shapes can get. |
| 2 | **Generators plus small parts**: group blocks into structures, analyse their shape and surroundings, generate walls, roofs, arches to fit, then decorate by rules | About 25 generators and parts cover any shape. Needs deliberate imperfection or it looks computed. |
| 3 | **Per-face parts only**: each side of a block picks a part on its own | Simplest. Boxy; roofs and row houses never merge. |

**Chosen: 2.** It is the only one that keeps up with "build anything", and it
is where a large rule catalogue pays off. It borrows the corner trick from 1
for edges and railings. The spike already proves the core mechanism:
geometry that shares an ink ID draws with no seam, so "merge" means "emit as
one surface".

## 5. Glossary

- **Cell**: one grid position `(x, y, z)`, `y` up. A cell is 1 wide, 1 deep,
  `H = 0.8` tall in world units (from the spike).
- **Column**: all cells sharing `(x, z)`.
- **Block**: a player-placed piece that occupies one cell.
- **Kind**: what a block is (house, tower, …). `auto` means "decide for me".
- **Placed kind**: the kind stored in the save. **Resolved kind**: what an
  Auto block currently is. For non-Auto blocks they are the same.
- **Solid**: terrain, or a block whose resolved kind is house, tower,
  lighthouse, arch, dock, marble or pillar. Solid things can carry other
  blocks. (For Auto blocks "solid" is true regardless of what they resolve
  to, since every kind an Auto block can become is solid.)
- **Building block**: a block whose placed kind is auto, house, tower,
  lighthouse, marble or windmill.
- **Floor**: a path, plaza or garden overlay lying on a walkable top surface.
  A floor may share its cell with a tree, fountain, stall, cell fence, cell
  wall, or an arch standing on that surface, and with nothing else.
- **Carried**: a block is carried if the cell below it is solid, or if it is
  a windmill directly on a windmill.
- **Height** of a tower, lighthouse, pillar or windmill structure: its number
  of cells.
- **Edge piece**: a fence or low wall sitting on the boundary between two
  columns at some level.
- **Structure**: a group of merged blocks treated as one thing (one house,
  one marble mass, one pillar shaft).
- **Derived**: anything computed from the saved world and never saved:
  resolved kinds, structures, roofs, supports, decorations, animations.
- **Seeded chance**: a number in `[0, 1)` from a hash of the world seed, a
  rule ID and a cell. Same inputs, same number, forever.

## 6. The world

**Grid.** 48 × 48 columns, 32 levels (`y = 0 … 31`). Edits outside are
refused.

**Terrain.** Generated from a seed; never saved, never edited.

- Each column has a terrain height `h` from 0 to 6. `h = 0` is open water.
  Terrain fills cells `y < h`.
- Land covers 35–50% of the map, as one main island that never touches the
  map border (at least 5 columns of water on every side) so docks and bridges
  have room.
- Required features, checked by the generator and re-rolled if missing: a
  beach (land at `h = 1` next to water, at least 8 columns), a hill reaching
  `h ≥ 4`, at least one cliff (a height jump of 2 or more between neighbours),
  a cove (a water column with land on three sides), and at least 40% of land
  at `h = 1` or `h = 2` in flat patches of 3 × 3 or larger.
- Look: the spike's floating slab (rounded sea slab with earthy sides) with
  the island as stepped terraces. Terrace outlines are rounded, not
  stair-stepped squares. Tops are grass, beach is sand, faces with a drop of 2
  or more are rock.
- The new island starts with 6–14 tree blocks (real, removable blocks) and
  nothing else.
- The sea surface sits partway up level 0, so a beach top (`h = 1`) and a
  dock deck (a block at `y = 0` over water) are flush.

**Terrain, second generation** (Derek's request, 2026-11-19). Islands were
too alike: nearly flat with one small hill, and never a river, which left
bridges with nothing to cross. New islands use a second generator; towns
saved before it keep the island they were built on.

- **Rivers.** A river is a channel of open water (terrain height 0), one or
  two columns wide, that winds from the sea into or right across the island.
  Most islands have one (about 60%), some have two (about 20%), some none
  (about 20%). A river may split the land in two; that is what bridges are
  for. Rivers meander, widen a little at the mouth, and may have a ford-less
  pool or a small river island. Banks are grass or sand on gentle islands
  and rock walls where the river cuts through high ground (a gorge).
- **Shapes of island.** Each island rolls a character:
  - *Gentle* (about 45%): as before, low and rolling, good for big towns.
  - *Hilly* (about 30%): several hills and terraces, heights up to 6.
  - *Steep* (about 15%): a mountain or ridge with heights up to 10, big
    cliffs, narrow ledges, a little flat ground by the shore.
  - *Archipelago or lagoon* (about 10%): two or three landmasses close
    together, or a ring round sheltered water.
  Every island still has a beach, at least one sheltered landing, and enough
  flat low ground to start a town (at least 60 columns in patches of 3 × 3
  or larger); the other old requirements (land share, a hill, a cliff, a
  cove) become tendencies of the character, not rules.
- **Rock.** High and steep ground is rock: cliff faces already draw as rock
  where the drop is 2 or more; now summits, ridges and gorge walls also have
  rock tops (drawn as bare stone with a few tufts), and steep islands show
  scree at cliff feet. Rock is only how the terrain looks: it cannot be
  edited, and it can be built on like any ground.
- **Old towns.** The save and the share link record which generator made
  the island (`World.terrainGen`, 1 or 2). Generator 1 stays in the code
  unchanged, so every existing town, link, test town and guide picture loads
  on the island it was built on. New islands and the dice use generator 2.

**What is saved.**

```ts
type Kind =
  | 'house' | 'tower' | 'lighthouse' | 'arch' | 'dock'   // Auto can become these
  | 'marble' | 'pillar' | 'stairs' | 'windmill'
  | 'tree' | 'fountain' | 'stall' | 'fence' | 'wall';

interface Block {
  kind: Kind | 'auto';
  color: number;        // palette index 0–7
  rot: 0 | 1 | 2 | 3;   // quarter turns; only stairs use it
  seq: number;          // placement counter, unique, increasing
}
type FloorKind = 'path' | 'plaza' | 'garden';
type EdgeKind = 'fence' | 'wall';

interface World {
  version: 1;
  seed: number;                       // terrain + all seeded chance
  blocks: Map<CellKey, Block>;
  floors: Map<CellKey, FloorKind>;    // key = the cell the floor lies in
  edges: Map<EdgeKey, EdgeKind>;      // key = cell + side (E or S), canonical
  nextSeq: number;
}
```

Nothing else is saved. `seq` exists so a structure can keep its personality
when it grows (section 10); it is part of the world state, so town logic
stays a pure function of the save.

**Placeable pieces.**

| Piece | Stored as | Auto can become | Solid | Merges with |
|---|---|---|---|---|
| ✨ Auto | block | — | yes | per resolved kind |
| House | block | yes | yes | touching houses, same colour (sideways and up/down); also across a one-level step in the ground: a same-colour house in a side-adjacent column one level higher, standing on terrain or a solid block that is not another building (a house, tower, lighthouse or windmill). Not across two levels, not diagonally |
| Tower | block | yes | yes | same-colour tower directly above/below |
| Lighthouse | block | yes | yes | lighthouse directly above/below |
| Arch / bridge | block | yes | yes | arches in the same run or tier |
| Dock | block | yes | yes | touching docks |
| Marble | block | no | yes | touching marble, same colour |
| Pillar | block | no | yes | pillar directly above/below |
| Stairs | block | no | no | stairs beside or continuing the flight |
| Windmill | block | no | no | windmill directly above/below |
| Tree | block | no | no | — |
| Fountain | block | no | no | — |
| Market stall | block | no | no | — |
| Fence | block or edge | no | no | fence runs |
| Low wall | block or edge | no | no | wall runs |
| Path, Plaza, Garden | floor | — | — | touching floors of the same kind |

Shops, cafés, chapels, clock towers, castles, temples, gatehouses,
greenhouses, boathouses and the rest are **not** tray pieces. They are roles
the rules give to houses, towers, marble and arches (catalogue, part R). This
keeps the tray small while the list of things a town can contain is long.

Colour: every block stores a palette index. Each kind maps the index onto its
own ramp (pastel walls for houses, stone tints for marble, pillar, tower and
arch, wood stains for docks). Roof colour is derived from the structure's
seed and wall colour.

## 7. Interface

```
 ┌──────────────────────────────────────────────────────────┐
 │ ☰                                              ☀ ↶ ↷    │
 │                                                          │
 │                    (the town)                            │
 │                                                          │
 ├──────────────────────────────────────────────────────────┤
 │ [✨][house][tower][light][arch][dock][marble][pillar]    │
 │ [stairs][mill][tree][fountain][stall][fence][wall]       │
 │ [path][plaza][garden]   |  [change][paint][erase]  ● colour │
 └──────────────────────────────────────────────────────────┘
```

On a phone the tray is one row that scrolls sideways. ☰ holds new island,
share link, postcard, sound, and the dev tuning panel. ☀ cycles time of day:
running → hold day → hold dusk → hold night.

**Targeting.** The pointer picks a face of terrain, a block, or the water
surface. The target cell is the cell on the other side of that face. Water
targets `(x, 0, z)`.

**Actions**

| Action | Mouse / trackpad | Touch |
|---|---|---|
| Use the selected tool | click (press and release within 5 px) | tap (within 10 px, 250 ms) |
| Erase | right click, or Erase tool | long press 450 ms, or Erase tool |
| Orbit | left drag | one-finger drag |
| Pan | right drag | two-finger drag |
| Zoom | scroll or pinch | pinch |
| Paint a run (floors, fences, walls, marble) | Shift + drag | not in v1 |
| Set the held piece's length (see "Held length") | scroll over the island, or the − / + stepper | the − / + stepper |
| Undo / redo | ⌘Z / ⇧⌘Z or buttons | buttons |
| Pick tool | keys 1–9, 0 | tap tray |

**Held length** (Derek's request, 2026-11-19). Pieces that usually come in
runs can be stretched before they are placed.

- **Which pieces.** Upward: pillar, tower, lighthouse. Along the ground:
  fence, wall (cell and edge pieces), path, plaza, garden, dock, arch,
  marble. Every other piece has no length.
- **Changing it.** With such a piece selected and the pointer over a valid
  target, scrolling up adds one to the length and scrolling down removes one
  (trackpads: one step per 40 px of scroll). A small − n + stepper beside the
  tray does the same and is the only way on touch. Length runs from 1 to 12,
  is remembered per piece for the session, and starts at 1.
- **Zoom while holding one.** Pinch (and Ctrl or ⌘ + scroll) always zooms.
  Plain scroll zooms whenever the selected piece has no length or the pointer
  is not over a valid target.
- **Direction.** Upward pieces grow straight up from the target cell. Ground
  pieces grow from the target cell toward the edge of the pointed-at face
  that is nearest the pointer, so nudging the pointer within the cell swings
  the run round; an edge fence or wall grows along its boundary line, toward
  the nearer end. A ground run follows terrain steps of one level up or down
  (so a path or fence climbs a slope) and stops at a bigger step.
- **What gets placed.** The ghost shows the whole run and its count. Cells
  are tried in order from the target; the run ends at the first cell where
  the piece cannot go, and a click places the part that fits. If the first
  cell is illegal the click is refused. The whole run is one undo step and
  uses the first cell's colour throughout.

**House style** (Derek's request, 2026-11-19). A house's look used to be
random every time, which is annoying when you want several the same.

- **Styles.** A style is a complete look for a house apart from its wall
  colour: roof colour, window family, door, trim and chimney. There are six
  named styles, chosen so they are easy to tell apart at playing zoom, plus
  **Random**, which is the default and behaves exactly as the game did
  before.
- **Choosing.** Hovering the House button in the tray (long press on touch)
  opens a small flyout above it: a dice tile for Random, then one tile per
  style, each a tiny drawing of that house in the currently selected wall
  colour. Clicking a tile selects it; the House button then shows that
  style's drawing. The choice stays until changed, for the session. Wall
  colour still comes from the Colour swatch (auto by default), so "all the
  same" is: pick a style and pick a colour.
- **One building, not a row of strangers** (fix, 2026-11-19). A chosen
  style must let you build the big houses: an inn, a manor, a town hall are
  all one house of many blocks. So each style has its own wall colour, and
  while a style is selected (and the Colour swatch is on auto) every house
  you place takes that colour, wherever you click. Houses of one style that
  touch therefore join into one building, and it grows into whatever its
  size and surroundings make it. Setting the Colour swatch overrides the
  style's colour. With Random selected nothing changes: each house started
  on bare ground is its own building with its own colour, and clicking the
  side or top of a house extends that house. The ghost preview shows the
  whole building a new block would join, so joining is visible before the
  click.
- **Stored.** A placed block records its style (`Block.style`, 0 = random),
  so styles survive saving and share links. A structure takes the style of
  its lowest-`seq` block; with style 0 it rolls its look from its seed as
  before. Merging is unchanged (touching, same kind, same colour). A role
  that dictates part of the look (chapel windows, keeper's cottage colours,
  greenhouse glass) still wins over the style for that part.
- **Copy a look.** Alt-click (desktop) on any block copies its kind, wall
  colour and style into the hand, so the next clicks place more of the same.
- **Auto blocks** have no style; one that becomes a house rolls its look.

**The guide** (Derek's request, 2026-11-19). Nothing in the game tells a
player that a house beside a tower becomes a chapel. The guide does.

- **Where.** A book button under the menu button opens a panel on the right
  side of the screen (a full-height sheet on phones). The town stays visible
  and playable beside it on desktop. It closes with the button, Escape, or a
  swipe down on phones.
- **What it lists.** Only the special buildings: things a player would not
  guess. About 35–45 entries in groups: Houses (chapel, shop, inn, town hall,
  manor, townhouse, row house, stilt house, boathouse, cliff house,
  greenhouse, mill house, keeper's cottage, lookout cottage), Towers
  (steeple, clock tower, castle turret, campanile, observatory, dovecote,
  lighthouse), Stone (temple, keep, gatehouse, grand steps, quay wall,
  plinth and statue), Bridges (stone bridge, sky bridge, viaduct, gateway,
  loggia, flying buttress), Waterfront (pier, quay, boardwalk), Green (wheat
  field, park, walled garden, paddock, pocket park, herb garden), and Town
  (street lamps, laundry lines, a garrison). Plain variants (which window a
  house gets) are left out.
- **Each entry** has a picture of the building as the game draws it, its
  name, and one plain sentence saying how to get it ("A house with gardens
  on three sides." "Marble resting on four or more pillars."). Entries the
  current town already contains show a small tick.
- **Never wrong.** Each entry owns a tiny recipe town. The picture is a
  render of that recipe, and a test builds the recipe and checks the rules
  really produce that building, so the guide cannot drift from the rules.
- **The Auto block** gets a short entry at the top: what it turns into and
  when (dock on water; arch across a gap; tower when three stacked; a
  lighthouse when four stacked near the sea; otherwise a house).

**Walk mode** (Derek's request, 2026-11-19). Drop yourself into the town
and walk through it as one of its people.

- **Getting in.** A small figure sits in the top bar. Drag it onto the town
  (on touch: drag it, or tap it and then tap a spot). While dragging, the
  ground under the pointer shows a footprint marker where you can stand
  (any place a resident can walk) and nothing where you cannot. On release
  the camera glides down from the builder's view to your eyes, in about a
  second. Tapping the figure without dragging drops you at the main square,
  or by the nearest door if there is no square.
- **The view.** First person, at a little person's eye height, with
  perspective, drawn in the same ink and paper. Looking up shows a paper sky
  with the day's colour, clouds, the moon and stars at night. Your own body
  is not drawn. A third-person toggle (V) pulls the camera back behind a
  drawn figure of you.
- **Moving.** Desktop: W A S D or the arrow keys to walk, Shift to run, drag
  or pointer-lock mouse to look; click the view to capture the mouse, Escape
  to release it. Touch: a thumb pad at lower left to walk, drag anywhere
  else to look. You walk where residents can: paths, grass, stairs and
  carved steps, bridges and decks, docks, roof terraces. You cannot pass
  through walls, fences without a gate, or off a drop of two levels or more;
  a one-level step down is a hop. Movement is smooth (you slide along what
  blocks you) and never snaps between cells.
- **Doors and insides.** Doors open for you as they do for residents.
  Walking into a house takes you through it: the view fades for a moment
  and you step out of its other door or onto its roof terrace if it has
  one; a house with one door turns you back out. Interiors are not drawn.
- **The town carries on.** Residents, the troop, birds, boats, smoke, the
  dusk cycle and sound all continue around you; people step round you; a
  resident you stand beside turns and shows a chat bubble.
- **Getting out.** An Exit button (and Escape when the mouse is free, or B)
  lifts the camera back to the builder's view where it was. Building tools
  are hidden while walking; the time-of-day button stays.
- **Limits.** Walk mode never changes the town or the save. On phones it
  uses the same performance fallbacks as the builder.

**Placement rules**

- The target cell must be inside the grid and hold no block. Because the
  target is next to the face you clicked, a new block is always attached to
  something.
- The cell directly below the target must not hold a non-solid block (you
  cannot build on top of a tree, stall, fountain, fence, wall or stairs). The
  one exception is a windmill onto a windmill; nothing else goes on a
  windmill.
- Dock: only at `y = 0` over water. Tree, fountain, stall, cell fence, cell
  wall, windmill base, stairs: only onto a walkable top (terrain top or the
  top of a solid block). Other blocks: any face.
- A floor already in the target cell stays if the new block is a tree,
  fountain, stall, cell fence, cell wall, or an arch whose cell below is
  solid (so a path can run through a gateway and a fountain can stand on a
  plaza). Any other block removes it.
- Floors: only into a cell directly above a walkable top that is empty or
  holds one of the pieces just listed. Not on water.
- Edge pieces: only on a boundary where at least one of the two cells is
  directly above a walkable top and holds no solid block.
- Fence and wall: the top face you point at is split into a centre zone and
  four edge strips (outer 25% each side). Centre places a cell piece; a strip
  places an edge piece on that boundary. The ghost shows which.
- Stairs: `rot` is set at placement and stored. It points up towards the
  neighbouring column whose walkable top is exactly one level higher; if
  there are several, the one nearest the pointer; if none, away from the
  camera. The Change tool rotates stairs a quarter turn.
- Colour: with the swatch on "auto" (default) a new block copies the colour
  of the block it was placed on. Placed on terrain or water, an Auto, house
  or tower block gets palette index `hash(seed, cell) mod 8`, and every other
  kind gets index 0 (its default tint). So clicking a house's side extends
  that house; clicking the ground beside it starts a new one. A Shift-drag
  run uses the first cell's colour throughout. Choosing a swatch colour
  forces that colour until set back to auto.
- Erase removes one block, floor or edge piece. Terrain cannot be erased.
  Blocks are never removed as a side effect: blocks above stay where they are
  and gain generated supports (section 9). Floors and edge pieces that were
  resting on the erased block's top are removed with it (an edge piece
  survives if its other side still has a walkable top), and one undo brings
  everything back. Likewise, placing a solid block removes an edge piece
  only when both of its sides are then solid.

**Ghost preview (mouse only).** On hover, the game runs the shape stage of
town logic (section 10) as if the piece were placed and shows the new
structure translucent in the target cell, without decorations. Auto neighbours whose resolved kind would change shimmer. An illegal
target shows a red outline. Touch has no hover, so there is no ghost on
phones; the landing bounce and undo cover it.

**Change tool.** On a block whose placed kind is auto, house, tower,
lighthouse, arch or dock, each use steps through: Auto → House → Tower →
Lighthouse → Arch → Dock (only if legal there) → Auto. On stairs it rotates.
On anything else it does nothing and the block wiggles. While the Change tool
is selected, every Auto block shows a small ✨ so the player can tell Auto
from fixed.

## 8. The Auto block

An Auto block's resolved kind is a pure function of the saved world. The
rules read only terrain, occupancy and **placed** kinds, never another Auto
block's resolved kind. So there is no ordering, no iteration, and no
dependence on how the town was built.

Definitions:

- **Column candidate**: a block whose placed kind is auto, tower or
  lighthouse.
- **Free cell**: a column candidate with no building block in any of its four
  side neighbours.
- **Free run** of a cell: the longest unbroken vertical run of free cells
  containing it.
- **Span candidate**: a block whose placed kind is auto or arch and whose
  cell below is not solid.
- **Span** of a cell along an axis: the longest unbroken horizontal run of
  span candidates along that axis containing it. An end is **anchored** if
  the next cell beyond it, at the same level, is solid. A span is **valid**
  if it is at most 6 long and both ends are anchored.

The first rule that matches wins:

| # | Resolves to | When |
|---|---|---|
| K1 | Dock | `y = 0` and the column is open water |
| K2 | Arch | the cell has a valid span along x or z |
| K3 | Lighthouse | its free run is at least 4 long, the cell above the run's top is empty, and an open-water column lies within 4 columns (in x and z) of it |
| K4 | Tower | its free run is at least 3 long |
| K5 | House | otherwise |

What this produces:

- Stack three Auto blocks on open ground: all three become a tower. Stack a
  fourth near the sea: the run becomes a lighthouse.
- A house with a thin Auto stack rising from its roof: the free part becomes
  a tower, the lower part stays house. The role rules then read that as a
  chapel with a steeple.
- Auto blocks bridging a gap between two solid things become an arch; the
  role rules decide stone bridge, sky bridge or viaduct.
- One Auto block hung off a wall is not a valid span, so it is a house: a
  jettied room on brackets.

The numbers 6, 4, 4 and 3 live in the style file. When an Auto block's
resolved kind changes, it plays the morph feedback (F03).

## 9. Supports (nothing floats)

Evaluated for every block that is not carried (glossary), except docks at
`y = 0` (their stilts are part of the dock generator). First match wins:

| # | When | Result |
|---|---|---|
| S1 | resolved kind is arch | no generated support; the arch generator shapes itself: a valid span ≤ 3 long is one arch, 4–6 long is two arches with a centre pier down to the first solid top (or the seabed); a run anchored at one end hangs as a half arch for up to 2 cells, with a pier under any cell beyond that; a run with no anchor stands on a pier at each end |
| S2 | a side neighbour at the same level is solid and **grounded** (terrain, or solid directly below it) | corbel brackets under the block against that neighbour |
| S3 | otherwise | a generated pillar from the block's underside down to the first solid top, or to the seabed over water (a stilt) |

Then one more pass over the generated pillars:

- **S4 arcade**: two generated pillars in adjacent columns, with the same top
  level and both at least 2 cells long, are joined at the top by a generated
  arch.

Details:

- Generated supports are derived, are not blocks, cannot be clicked, and
  vanish when no longer needed. They do not count as placed pillars for any
  rule.
- If the column under an S3 pillar holds a non-solid piece (a tree, stall,
  fountain, fence, wall or stairs) before the first solid top, the support is
  drawn as four slim stilts at the cell's corners instead of one centred
  pillar. Nothing the player placed is ever hidden.
- When S3 carries a non-solid piece (a tree whose ground was erased), the
  pillar ends in a small platform.

## 10. From world to town: the pipeline

```
World (saved) ──► resolve() ──► TownPlan ──► build() ──► geometry + instances
                  pure logic                 generators      │
                                                             ▼
                              life (reads TownPlan + wind/time) ──► renderer
```

Town logic is pure and deterministic, and runs in two stages:

- `resolveShape(world): ShapePlan` — passes 1–7. Everything that decides
  geometry. Runs synchronously on every edit and for the ghost.
- `resolveDressing(shape): DressingPlan` — passes 8–9. Props, actors and the
  walking graph. May run up to a few frames after the edit; its results pop
  in (F05), which hides the delay.

`TownPlan = { shape, dressing }`. Passes, in order:

1. **Terrain context**: heights, water, distance fields (to water, to path).
2. **Kinds** (section 8).
3. **Structures**: merge per the table in section 6. A structure's `id` and
   seed come from its member with the lowest `seq`, so extending a building
   never re-rolls it. If a structure is split by an erase, the part without
   the lowest-`seq` block gets a new id from its own lowest `seq`.
4. **Supports** (section 9).
5. **Facts**: the vocabulary rules query (below).
6. **Roles**: each structure gets one role (catalogue part R).
7. **Joinery plan**: doors, windows, roof regions and types, railings,
   junctions (part J). Produces sockets.
8. **Decoration**: props claimed onto sockets and slots (part D).
9. **Life plan**: which actors exist and where: smoke sources, flocks, boats,
   residents and their homes, plus the walking graph (part L).

`build(plan)` turns structures and props into geometry. Life runs every
frame and is the only place that reads the clock.

**Facts.** Computed once per resolve, read by every later rule:

- Per cell: terrain height, water, resolved kind, which faces are open, sky
  open above, walkable top, height above local ground, distance to water, to
  the nearest floor, to the nearest structure, sunny side (faces the fixed
  light direction).
- Per structure: cells, footprint per level, storeys, bounding box, area,
  seed, the structures it touches, and its **facades**. A facade is one
  exposed side of one storey; it records what it faces within 3 cells:
  street, plaza, garden, water, cliff, open ground, or another structure
  across a gap of n cells.
- Regions: **streets** (connected path cells; length, junctions, dead ends,
  straight segments), **plazas** (connected plaza cells; a **square** is a
  plaza containing a full 3 × 3), **gardens**, **courtyards** (up to 16
  connected empty ground cells fully enclosed by blocks, walls or cliffs),
  **alleys** (1-wide outdoor corridors at least 2 long with structures on
  both sides), waterfront cells, sheltered water (water with land or dock on
  two or more sides).
- Town: counts per kind and role, tallest structure, highest walkable point,
  total street length, population.

**Rule format.** Every rule in parts R, J, D and L is one object in its own
file:

```ts
defineRule({
  id: 'D05.laundry-line',
  part: 'decoration',
  tier: 1,                       // 1 core, 2 rich, 3 delight
  priority: 50,                  // higher runs first within a part
  find(facts): Candidate[],      // pure; where could this apply?
  chance: 0.6,                   // seeded per candidate anchor
  claims(c): Slot[],             // what it occupies
  apply(c, out): void,           // emit props / sockets / tags
});
```

- Rules run by part, then priority descending, then id. Candidates run in
  cell-key order. Identical input gives identical output.
- **Claims** prevent overlap. A slot is a place one thing can occupy: a floor
  position in a cell (centre, four edges, four corners), a wall socket, a
  roof socket, or an air line between two sockets. A rule whose slots are
  taken is skipped for that candidate. Role rules claim the structure itself,
  so each structure gets exactly one role.
- Chance, variant choice and jitter use `rand(seed, ruleId, anchorCell)`.
  Lint and a test ban `Math.random` and `Date` under `resolve/`, `gen/` and
  `deco/`.
- Each rule ships with a unit test and a fixture town that shows it (section
  16).

**Incremental updates.** After an edit both stages rerun in full. They are
pure logic on at most a few thousand blocks. Each structure, prop
group and terrain chunk in the new plan carries a content hash; `build()`
regenerates geometry only where the hash changed. There is no hand-written
invalidation logic to get wrong. Budget in section 14.

**Organic variation.** Three seeded levels: town → structure → part. A
structure picks a personality once (window family, roof colour, trim); parts
vary within it. Geometry knobs, all in the style file and live-tunable from
the dev panel: wall bow and roof-line sag (smooth noise, never per-vertex
static), tower lean per storey, uneven eave overhang, window spacing drift,
uneven corner softening. Variant pools are weighted lists with two standing
constraints: no identical rare variants side by side, and context limits
written in the rule.

## 11. Generators and parts

A generator takes a structure (plus its role, joinery plan and seed) and
returns mesh data and sockets. Animated pieces (sails, flags, laundry,
people, boats, birds) are never baked into structure meshes; they are
instances.

```ts
interface MeshData {
  position: Float32Array; normal: Float32Array;
  color: Uint8Array;      // rgb per vertex
  pattern: Uint8Array;    // shader pattern id (shingles, stone courses, planks…)
  inkId: Uint16Array;     // equal neighbours draw no seam line
  edge: Float32Array;     // distance from a marked edge, for bevel lines
}
interface Socket { id: string; type: SocketType; cell: Cell; pos: Vec3; facing: Vec3; structure: StructureId }
```

**Features, props and parts.** Rules never produce geometry. They emit small
records, and a registry of **parts** draws them:

- A **feature** is something built into a structure (a door, a window, a
  roof type for a region, a chimney, an awning, battlements). Role and
  joinery rules emit features; they are part of the structure's content
  hash.
- A **prop** is a free-standing or attached object from a decoration rule (a
  lamp, a bench, a laundry line). An **actor** is a moving thing from a life
  rule.
- Each has a `type` string. `definePart({ type, build })` supplies the mesh
  for that type and is discovered automatically, like rules. A structure's
  generator builds the shell (walls, roof surfaces) and asks the registry to
  draw the structure's features.
- Features, props and actors are placed by logical position (a cell and
  side, a slot, or a socket id), never by raw coordinates. The part that
  owns a socket supplies its exact transform at build time.

A new idea therefore usually means one rule file, sometimes one part file,
and no change to any generator.

Generators: terrain and sea; house walls; roofs; tower and lighthouse; arch,
bridge and generated supports; marble; pillar; dock; stairs; fence and wall
(cell and edge); floors; windmill; tree; fountain; stall. Parts library:
windows, doors, chimneys, awnings, signs, balconies, railings, lamps,
benches and the rest of the props named in the catalogue.

Required behaviour beyond what the spike already shows:

- **Roofs** cover any footprint. Each roof region (connected sky-open cells
  of one structure at one level) gets a type from rule J04: gable, hip (roof
  height from distance to the region's edge, which is correct for L, T, U and
  ring shapes), lean-to, or flat terrace.
- **Houses merge**: same-structure cells share walls, eaves and one roof per
  region. A house is a handful of merged surfaces, not ~50 meshes.
- **Arches** run along either axis and form spans, tiers, half arches and
  arcades per section 9.
- **Fences and walls** join their own kind across cell and edge placements
  and end cleanly against structures.
- **Boats are redrawn from scratch**: a rowboat, a fishing boat and a
  sailboat with real hull shapes (curved sheer, pointed bow, flat stern, the
  hull sitting in the water at a waterline), a mast and a sail that fills on
  the wind side. Reviewed in the gallery before use.

## 12. Look and rendering

Carried over from the spike (port the shaders, do not reinvent them):

- Flat stepped shading: 3–4 tones from one fixed light direction, shadows
  drifting slightly cool. No real lights.
- Procedural pencil patterns in the surface shader (grass ticks, shingle
  rows, stone courses, planks, marble veins).
- Ink lines found in screen space wherever depth jumps, the surface creases,
  or the ink ID changes; static pen wobble in position and weight; optional
  line boil (off by default).
- Paper grain applied after colour conversion; cream paper background.
- Orthographic camera.

Changes needed to scale:

- Ink ID, colour and pattern become **vertex attributes**, so all static
  geometry shares one material and merges into chunk meshes (16 × 16 columns)
  without losing seams. Ink ID = hash of structure id and part group.
- The ID-and-normal pass and the colour pass render together using multiple
  render targets where available (two passes instead of three).
- Instanced meshes for props and actors.
- A new or changed structure renders as its own mesh for the length of its
  landing bounce, then is baked into its chunk.

**Dusk cycle.** One loop is 8 minutes: day 4:30, dusk 1:00, night 1:45, dawn
0:45. It drives a colour grade over the whole frame (warm peach at dusk, deep
blue-violet at night with the paper darkening to match), emissive windows and
lamps, the lighthouse beam, and stars. It is a signal other systems read
(section 13).

## 13. Life

Motion is produced by rules (catalogue part L), not hand-placed.

**Signals** (global, read by any behaviour):

- `time`: position in the dusk cycle, plus `isDay / isDusk / isNight`.
- `wind(x, z, t)`: one town-wide direction that drifts slowly, a base
  strength, and gusts that travel across the map as a wave front. Sails,
  flags, laundry, smoke, trees, awnings and kites all sample it, so a gust
  visibly crosses the town.
- `events`: block landed at cell, block removed, person passed cell.

**Sockets.** Generators and decoration rules leave typed sockets (chimney
top, window, door, roof ridge, tower top, mast, lamp head, perch, mooring,
seat, line anchor). Life rules attach behaviours to sockets. When the town
changes, sockets are regenerated and behaviours re-attach by socket id;
anything whose socket id survives keeps its state.

**Walking graph.** Nodes are walkable cells: a cell directly above a
walkable top (terrain, dock deck, arch or bridge deck, marble top, roof
terrace) that is empty or holds only a floor; stairs cells; and the cell of
an arch standing on a walkable top, which can be crossed only along its
passage (J15). Cells holding a tree, fountain or stall are not nodes (people
walk around them) but still count as part of their floor region. A cell
fence or wall is not a node unless J20 made it a gate. Links:

- between side-by-side nodes at the same level, unless an edge piece, a cell
  fence or wall, or a block is in the way;
- a stairs cell links its low side to its high side one level up;
- a one-level terrain step is crossable only where rule J17 carved steps;
- every door of one structure, and its roof-terrace hatch, link to each other
  (walking "through the building" costs 1 second per storey, during which the
  person is hidden).

People find routes with A* and prefer path and plaza over grass. They never
cross anything the graph does not link. Movement costs, population caps (60
on desktop, 30 on phone) and schedules are in the catalogue (L21–L27).

**Doors and thresholds** (Derek's request, 2026-11-19). Nobody passes
through a closed door or pops into view. A door swings open as a person
reaches it and closes behind them; the person walks through the opening.
Shop doors stand open by day. Coming up onto a roof terrace, a hatch lifts
and the person climbs out. Where a person must appear or vanish with no
door (arriving at the dock, leaving the map), they walk in or out of view
rather than fading.

**Feedback** (catalogue part F): landing bounce with squash and stretch and a
dust ring, neighbours wobbling when their shape changes, Auto morph sparkle,
staggered pop-in for new decorations (a street's lamps pop up one after
another), and synthesized sounds.

## 13a. Seasons and weather (Derek's request, 2026-11-19)

Two separate things that work together. Derek gave creative freedom here;
the fixed points are his: snow falls and settles on the island and the
roofs; in autumn the leaves turn; at Christmas the town puts up lights.

**Seasons** change how the whole island is drawn, slowly.

- Four seasons in a loop: spring, summer, autumn, winter. By default the
  year turns on its own, one season every few day-night cycles (a tunable
  number), with a gradual change over a day rather than a switch. A season
  button beside the time-of-day button cycles: running → hold spring → hold
  summer → hold autumn → hold winter, exactly as the sun button does for
  the time of day. The season is a signal like time and wind; the town's
  logic never reads the real calendar, and a town looks the same for the
  same season, day and seed.
- **Spring:** fresh light greens, blossom on fruit and street trees with
  petals drifting, flowers thick in beds and boxes, lambs with the sheep,
  birds busy, showers.
- **Summer:** the game as it looks today, at its fullest: deep greens, wheat
  turning gold through the season, long days.
- **Autumn:** tree crowns turn yellow, orange, russet and brown, tree by
  tree at different times, and leaves fall and gather in drifts along walls
  and in corners; grass yellows; wheat is cut to stubble with stooks or hay
  bales; pumpkins in vegetable plots; woodpiles grow; mist in the mornings;
  shorter days; smoke from more chimneys.
- **Winter:** bare branches on leaf trees (pines and cypress keep their
  green and carry snow), frosted pale grass, shorter days and long blue
  nights, every chimney smoking, residents in scarves and hats, breath
  puffs, ice at the edges of sheltered water and on ponds and fountains,
  boats fewer.
- **Midwinter festival** (the last third of winter): the town puts up
  lights. Strings of small coloured lights along eaves, round doors and
  windows, across streets between facing houses and round the square;
  wreaths on doors; a big decorated tree in the main square (or by the
  town hall, or the largest plaza) with a star; candles in windows;
  lanterns on the bridge parapets and the castle gate; the lights glow at
  dusk and all night. They go up house by house over a day and come down
  the same way.

**Weather** comes and goes within a season, driven by the same seeded
clock.

- Kinds: clear, cloudy, rain (shower or steady), thunderstorm (rare,
  summer), fog or mist (autumn and spring mornings, by the water), wind
  (gusty days that send leaves and laundry flying), snow (winter, and late
  autumn rarely).
- **Rain:** pencilled streaks falling with the wind's slant, a darker wet
  tone on ground and roofs, ripples on water and puddles gathering in low
  paved spots, drips from eaves, the paper sky greyed; residents hurry,
  some with umbrellas, market awnings matter, laundry is taken in; after
  rain, surfaces dry gradually and, sometimes, a rainbow over the sea.
- **Snow:** flakes drift down and **settle**. Snow builds up gradually on
  everything that faces the sky: ground, roofs (sliding thicker toward the
  eaves), wall tops, battlements, tree crowns and bare branches, lamp tops,
  boat decks, stall awnings, the tops of hedges and fences, statues. It
  stays off what is under cover (beneath arches, eaves, awnings, trees).
  Paths and plazas show trodden tracks where people walk, and are cleared
  along the middle on busy streets; footprints fade under fresh snow.
  Roofs drop a slide of snow now and then. When it warms, snow melts back
  from sunny faces first, with icicles on eaves on the way. Children throw
  snowballs and build a snowman in the square or a park, which stays until
  the thaw.
- Weather changes every few minutes with gentle transitions, weighted by
  season. A weather choice sits with the season button for holding one kind
  (auto by default).
- Sound follows: rain on roofs, wind, the hush of snow, distant thunder.

**How it must be built.** Seasons and weather are drawn by the renderer and
the life layer from two signals (`season`, `weather`), on top of the town
as it is; they never change the saved town, the rules' decisions, or what
is walkable. Snow cover and wetness are shading on existing surfaces by
their facing and shelter, plus a few added pieces (drifts, icicles, a
snowman, festival lights), not a rebuild of the town's geometry each time
it snows. The festival lights and seasonal props are decoration rules that
read the season signal in the dressing stage. Everything stays within the
performance budgets on desktop and phone, with falling rain and snow capped
and lighter on phones. The look stays ink and paper: snow is the paper
showing through with a cool shadow tone and a soft inked edge, not a white
3D layer.

## 13b. Mischief: destruction the player sets off (Derek's request, 2026-11-19)

Derek's words: "Setting fire to buildings, dropping a bomb, an explosion,
raids from Vikings or barbarians. These destructive events would be fun to
have the player influence." This is a toy: destruction is slapstick, never
grim. Nobody dies or is hurt; people run, shout, fight in dust clouds and
come back. Nothing destructive ever happens unless the player starts it.

- **Where.** A fourth drawer in the tray, **Mischief**, holds the tools.
  Each is used like any other tool: pick it, click the town.
- **Fire (a torch).** Click a building to set it alight. Flames take hold
  over a few seconds, climb storey by storey, and spread to what stands
  close by: timber, thatch and trees catch easily, plaster houses more
  slowly, stone, marble and docks over water hardly at all; wind carries
  sparks downwind; a gap, a street, a wall or water stops it. Smoke rises
  and leans with the wind. **The town fights back:** the bell rings,
  residents form a bucket chain from the nearest well, fountain, river or
  shore, the garrison helps if there is one, rain (when weather exists)
  puts fires out. A fire they reach in time is saved, scorched; one they
  cannot reach burns out and leaves a charred shell.
- **Bomb (a round black bomb with a fuse).** Click a spot; it drops, the
  fuse fizzes for a moment, people nearby scatter, and it goes off with a
  drawn "BOOM", a dust cloud and flying debris. Whatever is in the blast
  (a couple of cells across) is knocked into rubble, neighbours are
  scorched and shaken, windows nearby lose their glass, birds take off
  across the whole town. Dropped in water it throws up a spout and soaks
  the quay.
- **Raid (a horn).** Blow it and a longship or two with striped sails and
  shields along the side comes in through the edge of the sea, beaches or
  ties up at a dock, and raiders in horned helmets pour out. They chase
  chickens and sheep, carry off barrels, crates and loaves over their
  shoulders, knock over stalls, and set a torch to a building or two. The
  town responds: the bell rings, residents run indoors and shutters close,
  the garrison (if there is one) forms up and meets them, and the two sides
  disappear into cartoon scuffle clouds. With a strong garrison the raiders
  are chased back to their ship; with none they loot at leisure. Either way
  they row off with what they took, cut off at the map edge like every
  other ship. A castle's walls and a closed gate keep them out of what is
  inside.
- **More, if they come naturally** (builder's choice): a lightning bolt, a
  sea monster that rises and smashes a pier, a giant's foot. Each must be
  as readable and as funny as the first three.
- **What is left.** A destroyed block becomes a **ruin**: a charred or
  broken shell of what it was, saved with the town (`Block.ruin`), still
  standing where it stood, no longer merged into a role or housing anyone.
  Rubble and scorch marks around it are derived. People who lived there
  stand outside looking glum, then lodge at the inn or with neighbours.
- **The town rebuilds itself.** After things calm down, builders arrive
  with ladders, barrows and scaffolding and repair ruins one at a time, a
  storey at a time, over a few minutes, restoring exactly what was there
  (kind, colour, style). This is the one place the town changes saved
  blocks without a click, and only ever back to what the player built. A
  switch in the menu (Rebuild: on by default) turns it off; then ruins
  stay until the player repairs one with the Change tool or erases it.
  Looted goods come back with the next ship or cart.
- **Undo.** Each act of mischief and everything it caused is one undo step:
  undo puts the town back exactly as it was, at once, and sends any raiders
  home.
- **Limits.** Mischief never touches terrain. It cannot be triggered by a
  rule, a timer or a share link: opening someone's town never shows it
  burning unless they shared it mid-fire, in which case it opens with the
  ruins and no active fire. The welcome note and Grow a town never use it.
- **Built as.** A fire, a blast or a raid is a seeded, fixed-step
  simulation in the life layer that reads the town and emits ordinary
  edits (`setRuin`, and `repair`) through the same path as the player's,
  batched for undo. The rules treat a ruined block as occupying its cell
  and solid, with no role. Everything is drawn in ink and paper: flames as
  flat licking shapes on twos, smoke as soft puffs, the blast as a drawn
  burst.

## 14. Performance budgets

Measured on an M-series MacBook at default zoom with the reference town
(`scenarios/big-town.json`, about 2,000 blocks), and on a recent iPhone with
a 600-block town.

| Budget | Mac | Phone |
|---|---|---|
| Frame rate | 60 fps | 30 fps or better |
| Draw calls per frame | ≤ 150 | ≤ 100 |
| `resolveShape()` after one edit (also each ghost hover) | ≤ 8 ms | ≤ 25 ms |
| `resolveDressing()` after one edit (may be deferred) | ≤ 30 ms | ≤ 80 ms |
| Geometry rebuild after one edit | ≤ 8 ms | ≤ 25 ms |
| Pixel ratio | native up to 2 | capped at 2, ink at half resolution if needed |

Wave 0 must measure the ported renderer against a synthetic 2,000-block town
before other waves build on it. The Wave 1 integration task measures both
logic stages on the same town with the rule engine loaded. If the phone budget cannot be met, the
fallbacks in order are: half-resolution ink pass, lower actor caps, lower
decoration density (one global knob).

## 15. Saving and sharing

- Autosave to `localStorage` after every edit (debounced 500 ms). One town.
- **Share link**: seed plus blocks, floors and edges packed to binary,
  deflated, base64url in the URL fragment. Opening the link loads that town
  as a copy. If the encoded town exceeds 6,000 characters the menu offers
  "download town file" instead, and a file can be dropped onto the page to
  load it.
- **Postcard**: saves the current view as a PNG with a paper border.
- **New island**: confirms, then new seed and empty world.
- Undo and redo cover every edit, at least 200 steps, cleared on new island.

## 15a. Grow a town (Derek's request, 2026-11-19)

A menu entry, **Grow a town**, fills the current island with a complete,
procedurally generated town, and doubles as the game's showcase: a grown
town is meant to show off every building combination the rules know.

- **Pure and seeded.** `growTown(terrain, seed): Edit[]` in `src/townmaker/`
  returns an ordered list of ordinary edits. It uses only `rand(seed, …)`,
  and every edit must pass `canApply` when applied in order, so a grown town
  is exactly a town a player could have built. Nothing else in the game
  knows it exists.
- **It plans like a town.** It reads the island first (beach, cove, hill,
  cliffs, flat ground) and lays out districts that suit it: a harbour with
  quay, pier and stilt houses in the cove; a market square with fountain,
  stalls, shops and a clock tower on the largest flat patch; a castle with
  keep, turrets, curtain wall and gatehouse on the hill; a chapel; a temple
  on pillars; a lighthouse on a point; rows and townhouses along streets; a
  windmill by a wheat field; gardens, a fenced paddock, a park; stairs and
  carved steps up the terraces; and a vertical quarter of viaducts, sky
  bridges, towers on arches and houses on generated supports. Streets
  connect everything so residents can walk it.
- **Coverage.** Across seeds 1 to 5 every role in catalogue part R must
  appear at least once, and any single grown town must show at least 30
  distinct roles. A test enforces both.
- **In the game.** Choosing it asks for confirmation if the island has
  anything on it besides the starting trees, clears those, then plays the
  edits in order at about 25 a second so the town visibly builds itself with
  the landing bounce, district by district. A click or key skips to the end.
  The whole growth is one undo step. A dice button beside the entry grows a
  different town on a new island.
- **Speed.** Generating the edit list takes under 200 ms for a full island.

## 16. Code layout and contracts

```
src/
  core/      types, grid maths, keys, seeded hash, style file
  world/     World, edit commands, undo, save, share codec
  terrain/   generate(seed) → Terrain
  resolve/   kinds, structures, supports, facts, rule engine, plan types
  rules/     roles/ joinery/ decoration/ life/ urban/   one file per rule
  gen/       one generator per kind, MeshData helpers
  parts/     one file per feature, prop or actor mesh
  life/      signals, behaviours, birds, boats, people, walking graph
  render/    shaders, ink pipeline, chunks, instancing, camera, grading
  ui/        tray, pointer and touch input, ghost, menus, dev panel
  audio/
  app/       wiring and main loop
gallery/     dev page: every generator, part and prop in isolation, with sliders
scenarios/   fixture towns (JSON) used by tests, screenshots and the gallery
```

Dependency rule: `core` ← `world`, `terrain` ← `resolve`, `rules` ← `gen` ←
`life`, `render` ← `ui`, `app`. Nothing in `resolve/`, `rules/` or `gen/`
imports Three.js scene objects, the DOM or the clock; they are plain data in,
plain data out, and run under Vitest in Node.

The contracts that Wave 0 freezes, as TypeScript in `src/core` and
`src/resolve/plan.ts`: `World` and edit commands; `Terrain`; `ShapePlan`
(kinds, structures, supports, facts, roles, joinery plan, sockets, per-item
content hashes) and `DressingPlan` (props, actors, walking graph, hashes); `defineRule`; `MeshData`;
`Socket`; the signals interface; the style file's shape. Changing a frozen
contract after Wave 0 needs a note in `docs/contracts-changelog.md` and a
fix-up of every user in the same change.

**Verification**

- `npm run check`: typecheck, lint, unit tests. Must pass for any task to
  count as done.
- Kind and support rules: table tests, arrangement → expected result,
  including every example in sections 8 and 9.
- Determinism tests: resolving the same world twice gives identical plan
  hashes. Locality: a rule may read only cells within 8 of its structure,
  whole regions (street, plaza, garden, courtyard, alley) that have a cell
  within 8 of it, and, if marked town-wide in the catalogue, town facts. The
  test: an edit more than 8 cells away that changes no such region leaves the
  structure's hash unchanged once town-wide rules are switched off.
- Every rule: one unit test and one fixture town in `scenarios/rules/`.
- `npm run shots`: Playwright renders every scenario and gallery page to
  `.context/shots/`. A task that changes how something looks is done only
  when its author has looked at the screenshot and attached it.
- Performance: a scripted benchmark reports the section 14 numbers.

## 17. Delivery in waves

Each task below is sized for one agent in its own git worktree. Wave 0 ends
with a **walking skeleton**: every module exists as a stub that satisfies
its contract (a stub town logic that treats Auto as house and each block as
its own structure, a stub generator that emits plain boxes, and so on), and
the app runs end to end. A task replaces one stub. Within a wave, a task
relies only on the frozen contracts, earlier waves, and the stubs of its
siblings, never on a sibling's real work. Each wave ends with an integration
task that merges, runs `npm run check` and `npm run shots`, and fixes seams.

| Wave | Tasks |
|---|---|
| **0 Foundation** (one agent, then a review gate) | Project setup; frozen contracts; seeded hash; style file; gallery shell; stubs for every module (walking skeleton); port of the spike renderer with vertex-attribute ink IDs and chunking; synthetic 2,000-block benchmark against section 14 |
| **1 Playable grey town** | Terrain generator and mesh · World, edits, undo, save, share codec · Kinds and supports with table tests · Structures and facts · Rule engine · Pointer and touch input, tray, ghost, Change tool · Camera and dusk grading |
| **2 It looks right** | One agent per generator (house walls, roofs, tower and lighthouse, arch and supports, marble and pillar, dock, stairs, fence and wall, floors, windmill, tree, fountain and stall) · Parts library · Boats redraw · Role rules tier 1 · Joinery rules tier 1 |
| **3 It's alive** | Signals (wind, time, events) and attaching behaviours to sockets · Decoration rules tier 1 · Walking graph and people · Birds · Boats · Smoke, sails, flags, laundry, lamp light · Feedback (bounce, morph, pop-in) |
| **4 Depth** | Rules that join two Wave 3 systems (lamplighter L08, jobs L23, bird scatter from people) · Tier 2 and tier 3 rules, a handful per agent, each independent · Sound · Postcard · Phone performance pass · Tuning pass on the whole look |

Wave 2 can start as soon as Wave 0's contracts are frozen; it does not need
Wave 1 merged, because generators are developed against fixture plans in the
gallery.

## 18. Risks

See also sections 20 and 21, which follow section 19.

- **Phone performance is unproven.** The spike has never been measured on
  real hardware. Wave 0 measures it; section 14 lists the fallbacks.
- **Generated buildings looking computed.** Mitigated by the variation knobs
  and a tuning pass, but it is taste work and may take several rounds.
- **Rule interactions.** With 150+ rules, two can fight over the same spot.
  Claims and priorities make the outcome deterministic, not necessarily
  pretty; fixture towns per rule and a mixed "everything" scenario are how
  clashes get caught.
- **People on wild vertical builds.** If a house has no route to anywhere,
  its residents stay by their door. That is acceptable and by design.
- **Share links for big towns** can exceed what chat apps pass along; hence
  the file fallback.

## 19. Left to the builder

Exact meshes and proportions of every part; the terrain noise recipe; the
roof-mesh algorithm beyond the required outcomes; the binary share format;
hash function choice; A* details and crowd spacing; sound design; the dev
panel's layout; how instance animation is split between CPU and shader;
which tier 2 and 3 rules to group into one task.

## 20. Extending the game

The first build is a foundation to keep adding to. These are the supported
ways to extend it, from cheapest to most expensive. Each is a checklist a
single agent can finish alone.

| To add | You touch | Nothing else changes because |
|---|---|---|
| A **rule** (new decoration, role, life behaviour, urban fill) | one file in `src/rules/<part>/`, one fixture in `scenarios/rules/`, one test | rules are auto-discovered; claims and priority settle conflicts |
| A **part** (a new prop or feature mesh) | one file in `src/parts/`, one gallery entry | parts are looked up by `type` |
| A **fact** (new vocabulary for rules, e.g. "leftover space", "vista end") | one file in `src/resolve/facts/` that registers a lazily computed fact | facts are computed on first use and cached per resolve |
| A **role** for an existing kind | a role rule, plus the features it emits | generators draw features generically |
| A **signal** or event | one entry in `src/life/signals.ts` | behaviours subscribe by name |
| A **tray piece** (a new kind) | the kind table (solid, merges, placement, Auto-eligible), a generator, a tray icon, a save-format version bump with migration | every kind-specific behaviour lives in that one table |

Rules for extension:

- New rules get the next free ID in their part. IDs are never reused.
- A new rule must state which facts it reads, what it claims, its tier, and
  whether it is town-wide.
- New tray pieces are the exception, not the norm. A piece earns a slot only
  if a rule cannot produce it, and the tray is grouped into drawers
  (Build, Ground, Nature, Tools) so it never becomes one long row.
- New Auto kinds are not added without Derek: they change the K rules, which
  are the one place predictability matters most.

## 21. Discovery passes

After the catalogue's rules are built, the swarm runs review rounds whose
job is to find what a town like this is missing and add it. This is how the
game gets rules nobody wrote down in advance.

Each round:

1. **Build towns.** Explorer agents each build several towns as scenario
   files, from a brief: fishing harbour, hill town, castle, market core,
   temple hill, stilt village, farm edge, wild vertical stack, an Auto-only
   town clicked at random, a tiny hamlet. They render each from four angles,
   by day and at dusk, and print what the rules decided.
2. **Look and question.** Each explorer studies its screenshots through
   fixed lenses and writes proposals. The lenses come from how real towns
   work:
   - **No leftover space.** Every outdoor patch is something: a yard, a
     pocket park, a paddock, a drying green, a market corner.
   - **Edges and thresholds.** Where two things meet there is a transition:
     front gardens, stoops, kerbs, retaining walls, quays, hedges.
   - **Active frontage.** Ground floors on streets and squares do something;
     blank walls get a reason or a fix.
   - **Desire lines.** People cut corners; worn tracks appear where they
     would walk.
   - **Hierarchy.** Main street, side street, alley; square, court, yard.
     Bigger and more ornate toward the centre, rustic at the edge.
   - **Landmarks and vistas.** Street ends, corners, hilltops and the
     waterfront get something worth looking at.
   - **Topography.** Slopes produce terraces, switchbacks, retaining walls,
     stepped streets, lookouts.
   - **Back-of-house.** Sheds, woodpiles, washing, bins, workshops behind the
     pretty fronts.
   - **Green network.** Street trees, courtyard trees, orchards, verges.
   - **Recognition.** "This combination is obviously a ___" (a church, a
     town hall, a harbour master's office, a walled garden).
   - **Life.** Anything static that should move; any place people should
     gather but do not.
   - **Faults.** Glitches, clashing rules, bare or repetitive areas, bad
     silhouettes.
3. **Curate.** One agent merges all proposals, removes duplicates and
   anything already in the catalogue, scores the rest (delight × how often
   it would appear ÷ cost), rejects vague ones, and writes the survivors into
   the catalogue as precise rules across all tiers, including new parts,
   facts, roles and, sparingly, new tray pieces.
4. **Build.** Implementer agents take a few rules each, in parallel.
5. **Refute.** Fresh reviewers try to break each new rule: it never fires,
   it fires where it should not, it clashes, it flickers, it breaks the
   performance budget, or it does not look good. Failures go back to step 4.
6. **Merge and log.** The round's result is committed and summarised in
   `docs/swarm/discovery-log.md` with before and after screenshots.

Rounds repeat until one yields fewer than 8 accepted proposals, or the run's
time is up. The final round is a pure quality pass: art-director agents score
every part and generator in the gallery against the look rubric and anything
below the bar is redone.

The catalogue's part U (urban fill) holds a first seed of these rules.
