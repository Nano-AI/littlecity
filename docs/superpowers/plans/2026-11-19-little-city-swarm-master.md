# Little City Swarm Master Plan

> **For agentic workers:** this plan is executed by an orchestrator running
> one workflow per wave. If you are a task agent, read sections 1–4, then
> only your own task card. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the whole of Little City overnight with a large parallel
swarm, then keep improving it with discovery rounds that invent and add new
rules.

**Architecture:** A pure two-stage town-logic core (`World → ShapePlan →
DressingPlan`) with auto-discovered rules, parts and generators, so almost
every task owns its own files and merges without conflict. One agent builds
the foundation and a running skeleton of stubs; every later agent replaces
one stub or adds files.

**Tech Stack:** TypeScript (strict), Vite, Three.js ≥ 0.170, Vitest,
Playwright (screenshots), ESLint. No UI framework, no server.

**Spec:** `docs/superpowers/specs/2026-11-19-little-city-design.md` (the
design) and `docs/superpowers/specs/2026-11-19-little-city-rule-catalogue.md`
(the catalogue). Look reference: `spike/primitives/` and its `shots/`.

## Global Constraints

- Grid 48 × 48 columns, 32 levels; cell height `H = 0.8` world units.
- Town logic is pure and deterministic. No `Math.random`, `Date`,
  `performance.now` under `src/resolve`, `src/rules`, `src/gen`, `src/parts`.
  All chance comes from `rand(seed, ...)`.
- Rules never change saved data and never emit raw geometry.
- Nothing in `src/resolve`, `src/rules`, `src/gen`, `src/parts` imports the
  DOM or Three.js scene objects (Three.js maths and `BufferGeometry` helpers
  are allowed in `gen` and `parts`).
- Dependency direction: `core` ← `world`, `terrain` ← `resolve`, `rules` ←
  `gen`, `parts` ← `life`, `render` ← `ui`, `app`.
- Performance budgets: design section 14.
- Auto block kind rules K1–K5 and support rules S1–S4 exactly as in design
  sections 8 and 9. New Auto kinds are not added by the swarm.
- Every agent runs on Fable 5.2 or Opus 5.5. No smaller models, for any
  task.
- Commit at every milestone. Never push. Never rewrite another task's
  commits.

## Review Focus

Conditions the spec implies but no rule's own test covers. Each has an owning
task whose tests must pin it.

1. **Edits arrive faster than dressing finishes.** Expected: the newest edit
   wins, stale dressing is discarded, nothing flickers back. Owner: W1.6
   (`staged resolve drops stale dressing`).
2. **A share link or save is malformed, truncated, or from another
   version.** Expected: a plain message, the current town untouched, no
   exception. Owner: W1.3 (`decode rejects garbage without throwing`).
3. **Building at the limits:** top level `y = 31`, the map border, erasing
   the bottom of a 30-tall stack. Expected: refusal with F08 or a full-height
   generated support, never an exception or an infinite loop. Owner: W1.4
   (`supports at world limits`) and W1.3 (`edits at bounds are refused`).
4. **The tab sleeps or the frame takes seconds.** Expected: life clamps the
   time step to 100 ms, nobody teleports, the dusk cycle does not jump.
   Owner: W1.9 (`signals clamp dt`).
5. **Storage is unavailable or full** (private browsing). Expected: the game
   plays normally and says once that it cannot save. Owner: W1.3
   (`autosave survives storage errors`).

---

## 1. How the run works

```
Wave 0  one agent builds the foundation ──► review panel ──► fixes ──► GATE
Wave 1  10 agents: playable grey town    ──► integrate ──► GATE
Wave 2  15 agents: it looks right        ──► art review loop ──► integrate ──► GATE
Wave 3  10 agents: it's alive            ──► play-test agents ──► integrate ──► GATE
Wave 4  13 agents: depth (tier 2 and 3)  ──► integrate ──► GATE
Wave 5  discovery rounds × 3 or more (design section 21)
Wave 6  final quality pass and morning report
```

- The orchestrator (the chat that wrote this) launches each wave as one
  workflow, reads its result, runs the gate itself, and only then launches
  the next. A gate is: `npm run check` green on the merged branch,
  `npm run shots` run and the key screenshots looked at, `docs/swarm/STATUS.md`
  updated, one commit.
- A wave that fails its gate gets a repair workflow before the next wave
  starts. After two failed repairs on the same item, that item is dropped to
  a later wave and noted in `STATUS.md`; the run does not stall on it.
- The game is runnable at every gate from Wave 1 on. If the run ends early,
  the last gate's commit is a working game.
- `docs/swarm/STATUS.md` is the run log: per wave, what merged, what was
  dropped, open problems, screenshot paths. It is the first thing the
  orchestrator reads when it resumes.

**Expected scale:** about 140 agent runs over 9–10 hours of wall-clock time.
This is a large token spend by design.

## 2. Rules every agent follows

1. **Read first:** this plan's sections 1–4, your task card, the design
   sections your card lists, and `docs/swarm/CONTRACTS.md` (written by Wave
   0; the frozen API with examples).
2. **Your branch:** work in the worktree you are given, on a branch named
   `swarm/<task-id>` created from its starting commit. Run
   `npm ci --prefer-offline` first.
3. **Your files:** create and edit only the paths under "Owns" on your card,
   plus your own tests, fixtures and gallery entries. Anything else is
   read-only.
4. **Frozen contracts:** do not edit `src/core/**`, `src/resolve/plan.ts`,
   `src/resolve/engine/api.ts`, `src/gen/mesh.ts`, `src/life/api.ts`. If a
   contract blocks you, write `docs/swarm/requests/<task-id>.md` saying what
   you need and why, work around it locally, and say so in your report.
5. **No shared lists.** Rules, parts, generators, facts, behaviours and
   scenarios are discovered by file glob. Never add your thing to a central
   index. Style values go in `src/core/style/<your-module>.ts`.
6. **Task loop:**
   - [ ] Write the tests named on your card; run them; see them fail.
   - [ ] Implement until they pass.
   - [ ] Add fixtures and gallery entries; run `npm run shots -- <yours>`;
         open the PNGs and look at them. Fix what looks wrong.
   - [ ] `npm run check` is green.
   - [ ] Commit (at each milestone, not only at the end).
7. **Looking is part of done.** Any task that draws something is not done
   until its author has viewed the screenshots from at least two camera
   angles and compared them with `spike/primitives/shots/`.
8. **Report** (your final message): branch and head commit; what works;
   tests added; screenshot paths you viewed; what you could not do and why;
   contract requests.

## 3. Quality bar for anything drawn

Reviewed by art-director agents against this rubric, 1–5 each; below 4 on any
line means redo.

- **Silhouette:** recognisable at default zoom from all four orbit quarters.
- **Scale:** fits the grid; storeys are `H`; stacks flush; no gaps or
  z-fighting where pieces meet.
- **Line:** ink outlines fall where a pen would put them; merged surfaces
  have no seam lines; detail is not so fine that it turns to noise.
- **Colour:** only palette colours; reads by day, at dusk and at night.
- **Hand:** some irregularity (seeded); nothing looks extruded-by-default.
- **Family:** sits beside the spike's house, tree and lighthouse without
  looking like a different game.
- **Detail density:** closer to the reference art than the spike's bare
  areas.

## 4. The frozen contracts (Wave 0 writes these)

Signatures are binding in substance. Wave 0 may adjust names for
consistency, then freezes them in code and documents them in
`docs/swarm/CONTRACTS.md` with a worked example for each.

```ts
// src/core/grid.ts
export const SIZE_X = 48, SIZE_Z = 48, SIZE_Y = 32, CELL_H = 0.8;
export interface Cell { x: number; y: number; z: number }
export type CellKey = number;                       // x | z << 6 | y << 12
export function key(x: number, y: number, z: number): CellKey;
export function unkey(k: CellKey): Cell;
export function inBounds(x: number, y: number, z: number): boolean;
export type Dir4 = 0 | 1 | 2 | 3;                   // N(-z) E(+x) S(+z) W(-x)
export const DIR4: readonly (readonly [number, number])[];
export type EdgeKey = number;                       // CellKey * 2 + (0 = E side, 1 = S side)
export function edgeKey(x: number, y: number, z: number, side: 'E' | 'S'): EdgeKey;

// src/core/rand.ts
export function hash(seed: number, ...parts: (number | string)[]): number;   // uint32
export function rand(seed: number, ...parts: (number | string)[]): number;   // [0, 1)
export function pick<T>(items: readonly T[], weights: readonly number[] | null,
                        seed: number, ...parts: (number | string)[]): T;

// src/core/kinds.ts — the one table every kind-specific behaviour reads
export type Kind = 'house' | 'tower' | 'lighthouse' | 'arch' | 'dock' | 'marble'
  | 'pillar' | 'stairs' | 'windmill' | 'tree' | 'fountain' | 'stall' | 'fence' | 'wall';
export type PlacedKind = Kind | 'auto';
export type FloorKind = 'path' | 'plaza' | 'garden';
export type EdgeKind = 'fence' | 'wall';
export interface KindInfo {
  solid: boolean; building: boolean; autoTarget: boolean;
  merge: 'none' | 'vertical' | 'touching' | 'run';
  mergeNeedsColor: boolean; needsWalkableTop: boolean; keepsFloor: boolean;
}
export const KINDS: Record<Kind, KindInfo>;

// src/world/world.ts
export interface Block { kind: PlacedKind; color: number; rot: 0 | 1 | 2 | 3; seq: number }
export interface World {
  version: 1; seed: number; nextSeq: number;
  blocks: ReadonlyMap<CellKey, Block>;
  floors: ReadonlyMap<CellKey, FloorKind>;
  edges: ReadonlyMap<EdgeKey, EdgeKind>;
}
export type Edit =
  | { type: 'placeBlock'; cell: CellKey; kind: PlacedKind; color: number | 'auto'; from: CellKey | null; rot?: 0 | 1 | 2 | 3 }
  | { type: 'placeFloor'; cell: CellKey; floor: FloorKind }
  | { type: 'placeEdge'; edge: EdgeKey; kind: EdgeKind }
  | { type: 'eraseBlock'; cell: CellKey } | { type: 'eraseFloor'; cell: CellKey } | { type: 'eraseEdge'; edge: EdgeKey }
  | { type: 'setKind'; cell: CellKey; kind: PlacedKind }
  | { type: 'setRot'; cell: CellKey; rot: 0 | 1 | 2 | 3 }
  | { type: 'paint'; cell: CellKey; color: number };
export function canApply(w: World, t: Terrain, e: Edit): { ok: true } | { ok: false; reason: string };
export function applyEdit(w: World, t: Terrain, e: Edit): World;   // returns a new World; input untouched

// src/terrain/terrain.ts
export interface Terrain { seed: number; height: Uint8Array; material: Uint8Array }  // index x + z * 48
export function generateTerrain(seed: number): Terrain;
export function initialWorld(seed: number, t: Terrain): World;

// src/resolve/plan.ts
export type StructureId = number;                    // seq of the member with the lowest seq
export interface Structure {
  id: StructureId; kind: Kind; color: number; seed: number;
  cells: readonly CellKey[]; hash: number;
}
export interface Support {
  type: 'bracket' | 'pillar' | 'stilts' | 'platform'; carries: CellKey;
  bottomY: number; against?: Dir4; arcadeTo?: Dir4[];
}
export interface Feature {                           // built into a structure
  type: string; structure: StructureId; cell?: CellKey; dir?: Dir4;
  region?: number; variant?: string; params?: Record<string, number | string>;
  rule: string;
}
export interface Socket { id: string; type: string; structure?: StructureId; cell: CellKey; dir?: Dir4 }
export type Slot = string;                           // 'floor:<cell>:<c|n|e|s|w|ne|…>' | 'socket:<id>' | 'line:<a>:<b>' | 'role:<structure>'
export type Anchor = { socket: string } | { cell: CellKey; pos: 'c' | 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw' }
                   | { from: string; to: string };   // a line between two sockets
export interface Prop  { id: string; type: string; at: Anchor; variant?: string; params?: Record<string, number | string>; rule: string }
export interface Actor { id: string; type: string; at: Anchor | null; home?: StructureId; params?: Record<string, number | string>; rule: string }
export interface ShapePlan {
  world: World; terrain: Terrain;
  kinds: ReadonlyMap<CellKey, Kind>;
  structures: ReadonlyMap<StructureId, Structure>;
  structureAt: ReadonlyMap<CellKey, StructureId>;
  supports: readonly Support[];
  facts: Facts;
  roles: ReadonlyMap<StructureId, { role: string; rule: string }>;
  tags: ReadonlyMap<StructureId, ReadonlySet<string>>;
  features: readonly Feature[];
  sockets: readonly Socket[];
}
export interface DressingPlan {
  props: readonly Prop[]; actors: readonly Actor[]; nav: NavGraph; hash: number;
}
export function resolveShape(w: World, t: Terrain): ShapePlan;
export function resolveDressing(shape: ShapePlan): DressingPlan;

// src/resolve/facts/api.ts — facts are lazy and cached per resolve
export function defineFact<T>(name: string, compute: (f: Facts) => T): (f: Facts) => T;
export interface Facts {
  readonly world: World; readonly terrain: Terrain;
  readonly kinds: ReadonlyMap<CellKey, Kind>;
  readonly structures: ReadonlyMap<StructureId, Structure>;
  get<T>(fact: (f: Facts) => T): T;
}
// Core facts shipped by W1.5 (each a defineFact): cellInfo, facades, roofRegions,
// streets, plazas, gardens, courtyards, alleys, shelteredWater, wildGrass,
// leftovers, verges, townFacts, distToWater, distToFloor.

// src/resolve/engine/api.ts
export type RulePart = 'roles' | 'joinery' | 'decoration' | 'urban' | 'life';
export interface Candidate { anchor: CellKey; structure?: StructureId; data?: unknown }
export interface RuleOut {
  role(s: StructureId, role: string): void;      tag(s: StructureId, tag: string): void;
  feature(f: Omit<Feature, 'rule'>): void;       socket(s: Socket): void;
  prop(p: Omit<Prop, 'rule' | 'id'>): void;      actor(a: Omit<Actor, 'rule' | 'id'>): void;
}
export function defineRule(rule: {
  id: string; part: RulePart; tier: 1 | 2 | 3; priority: number; townWide?: boolean;
  find(facts: Facts, plan: ShapePlan): Candidate[];
  chance?: number;
  claims?(c: Candidate, facts: Facts): Slot[];
  apply(c: Candidate, out: RuleOut, facts: Facts, plan: ShapePlan): void;
}): void;
// 'roles' and 'joinery' run inside resolveShape; 'decoration', 'urban' and 'life' inside resolveDressing.

// src/gen/mesh.ts
export interface MeshData {
  position: Float32Array; normal: Float32Array; color: Uint8Array;
  pattern: Uint8Array; inkId: Uint16Array; edge: Float32Array;
}
export class MeshBuilder { /* box, quad, tri, extrude, lathe, transform, setInk(group), setPattern, build(): MeshData */ }
export function defineGenerator(g: { kind: Kind;
  build(s: Structure, plan: ShapePlan, parts: PartRegistry): { mesh: MeshData; anchors: Record<string, Mat4Like> } }): void;
export function definePart(p: { type: string;
  build(item: Feature | Prop | Actor, ctx: PartContext): { mesh: MeshData; anchors?: Record<string, Mat4Like>; animated?: boolean } }): void;

// src/life/api.ts
export interface Signals {
  time: { phase: number; isDay: boolean; isDusk: boolean; isNight: boolean };
  wind(x: number, z: number): { dirX: number; dirZ: number; strength: number };
  on(event: 'blockLanded' | 'blockRemoved' | 'personPassed', fn: (cell: CellKey) => void): void;
}
export function defineBehaviour(b: { type: string;      // matches Actor.type or Prop.type
  create(item: Actor | Prop, ctx: LifeContext): unknown;
  update(state: unknown, dt: number, signals: Signals, ctx: LifeContext): void }): void;
```

Scenario files (used by tests, screenshots, the gallery and discovery):

```ts
// scenarios/**/<name>.scenario.ts
export default scenario({ seed: 7, name: 'laundry-alley',
  build(b) { b.house(10, 12, { floors: 2, color: 1 }); b.house(12, 12, { floors: 2, color: 3 }); },
  cameras: [{ yaw: 45, pitch: 32, zoom: 3, target: [11, 1, 12] }],
  expect(plan, dressing) { /* optional assertions used by the scenario test runner */ } });
```

`b` is a builder over `applyEdit` with helpers (`block`, `house`, `fill`,
`path`, `plaza`, `fenceEdge`, `onTerrain(x, z)` which returns the first free
`y`). Commands: `npm run shots -- <glob>` renders scenarios to
`.context/shots/<name>-<camera>.png`; `npm run inspect -- <scenario>` prints
kinds, structures, roles, features, props, actors and which rule produced
each; `npm run bench` prints the section 14 numbers.

---

## 5. Task cards

Model column: **A** = asset or look work (Fable 5.2 or Opus 5.5, high
effort); **L** = logic (same models, default effort).

### Wave 0 — Foundation (serial)

**W0.1 Foundation.** One agent. Owns everything at first.

- Project setup (Vite, strict TS, Vitest, ESLint with the purity ban from
  Global Constraints, Playwright), `npm run check | shots | inspect | bench |
  dev`.
- All contracts in section 4, real implementations of `grid`, `rand`,
  `kinds`, the rule engine's discovery and ordering (enough to run zero
  rules), and `MeshBuilder`.
- A **stub for every module** so the app runs end to end: stub terrain (flat
  island), stub `resolveShape` (Auto → house, one structure per block), stub
  generators (a coloured box per block), stub renderer (plain Three.js
  material), stub input (click to place the selected kind, right click
  erases), stub life (nothing moves).
- The scenario builder and the three CLIs working against the stubs,
  headless, on this Mac.
- `docs/swarm/CONTRACTS.md`.
- Tests: `key/unkey round-trips`, `rand is stable across runs`, `engine
  discovers a rule file`, `engine orders by priority then id`, `claims block
  a second rule`, `purity lint fails on Math.random in src/rules`.

**W0.2 Contract review.** Three reviewers in parallel, each asked to
attempt (on paper) three task cards from Waves 1–3 against the frozen
contracts and report where they could not: one from the rules side, one
from generators and rendering, one from life and UI. **W0.3** fixes what
they found. **W0.4 pilot:** two throwaway agents in parallel worktrees each
add one trivial rule and one part; the integrator merges both. This proves
the branch, merge and auto-discovery mechanics before 10 agents depend on
them.

Gate 0: the skeleton runs, a block can be placed in the browser, all three
CLIs work, the pilot merged cleanly.

### Wave 1 — Playable grey town

| ID | Task | Owns | Proves done by | Model |
|---|---|---|---|---|
| W1.1 | Terrain generator and starting trees (design §6) | `src/terrain/**` | tests: `land is 35–50%`, `no land within 5 of border`, `has beach, hill ≥ 4, cliff, cove`, `40% of land is flat low ground`, `same seed same terrain`, 200 seeds all valid | L |
| W1.2 | Terrain and sea mesh: rounded terraces, sand, rock faces, slab, water | `src/gen/terrain/**`, `src/parts/water*` | shots of 6 seeds, rubric §3 | A |
| W1.3 | Edits, validation, undo/redo, autosave, share codec, file fallback (design §7 placement rules, §15) | `src/world/**` | one test per placement rule in §7; `undo restores floors removed with a block`; `share round-trips`; Review Focus 2, 3, 5 | L |
| W1.4 | Kinds K1–K5, supports S1–S4, structures and merging (design §8, §9, §10 pass 3) | `src/resolve/kinds.ts`, `supports.ts`, `structures.ts` | table tests for every example in §8 and §9; `structure keeps id when extended`; `split gives new id`; Review Focus 3 | L |
| W1.5 | Core facts (list in section 4) | `src/resolve/facts/**` | one test per fact on hand-built worlds; `facade faces street within 1`; `courtyard needs full enclosure` | L |
| W1.6 | Rule engine: staged resolve, claims, chance, content hashes, hash-diffed rebuild list, locality harness | `src/resolve/engine/**`, `src/resolve/index.ts` | `same world same hashes`; `far edit leaves hash unchanged`; Review Focus 1 | L |
| W1.7 | Renderer: port the spike's shading, ink and paper with vertex-attribute ink IDs, chunk meshes, instancing, standalone-then-bake for new structures (design §12) | `src/render/**` | shots match the spike's look on a ported test scene; `npm run bench` meets §14 on the synthetic 2,000-block town | A |
| W1.8 | Input and interface: targeting, tray with drawers, tools, ghost, Change tool, menus, touch gestures (design §7) | `src/ui/**` | Playwright tests: place, erase, change-cycle, undo, fence centre vs edge zones, touch tap and long-press | L |
| W1.9 | Camera, dusk cycle grading, signals (time, wind with travelling gusts, events) | `src/render/camera.ts`, `src/render/grade.ts`, `src/life/signals.ts` | shots at day, dusk, night; `gust front crosses the map`; Review Focus 4 | A |
| W1.10 | Gallery page with sliders bound to style files; scenario test runner; `big-town` and `everything` scenarios | `gallery/**`, `scenarios/core/**` | gallery lists every registered generator and part automatically | L |
| W1.X | Integration: merge, fix seams, measure both logic stages, gate | — | Gate 1 | L |

Gate 1: on a generated island you can place every tray piece, Auto blocks
resolve correctly as boxes with labels, supports appear, undo and share
work, it is drawn in the ink-and-paper style.

### Wave 2 — It looks right

| ID | Task | Owns | Catalogue | Model |
|---|---|---|---|---|
| W2.1 | House shell: merged walls, party walls, base trim, foundation | `src/gen/house/**` | J01–J03, J24, J27 | A |
| W2.2 | Roofs for any footprint: gable, hip by distance-to-edge, lean-to, terrace | `src/gen/roof/**` | J04, J05, J12 | A |
| W2.3 | Tower and lighthouse bodies and every cap | `src/gen/tower/**`, `src/gen/lighthouse/**` | J13, R-L01, caps for R-T01–R-T07 | A |
| W2.4 | Arches, bridges, generated supports | `src/gen/arch/**`, `src/gen/support/**` | S1–S4 geometry, J14 (generated), J15, looks for R-A01–R-A06 | A |
| W2.5 | Marble and pillar, with temple, keep and grand-steps features | `src/gen/marble/**`, `src/gen/pillar/**` | J14, J16, looks for R-M01–R-M07 | A |
| W2.6 | Dock and shoreline | `src/gen/dock/**`, `src/parts/shore*` | J23, J28, looks for R-D01–R-D04 | A |
| W2.7 | Stairs and carved terrain steps | `src/gen/stairs/**` | J17, J18 | A |
| W2.8 | Fences, walls, gates, railings; cell and edge | `src/gen/fence/**`, `src/gen/wall/**` | J19, J20, R-E01, R-E02 | A |
| W2.9 | Floors: path, plaza, garden and their variants | `src/gen/floor/**` | J21, J22, R-G01 looks | A |
| W2.10 | Windmill, trees (all species), fountain, stall | `src/gen/windmill/**`, `tree/**`, `fountain/**`, `stall/**` | R-W01, R-P01, R-F01, R-S01, J25 | A |
| W2.11 | Opening parts: doors, windows, bays, dormers, balconies, awnings, signs, shopfronts, chimneys | `src/parts/openings/**` | parts for J06–J11, D07 | A |
| W2.12 | Street and yard props: lamps, benches, bunting, laundry, flags, lanterns, crates, barrels, pots, weathervanes | `src/parts/props/**` | parts for tier-1 D rules | A |
| W2.13 | Boats (redrawn), people, birds: meshes and poses | `src/parts/actors/**` | design §11 boats; meshes for L11–L21 | A |
| W2.14 | Role rules, tier 1 | `src/rules/roles/**` | all tier-1 R rules | L |
| W2.15 | Joinery rules, tier 1 (logic that emits features and sockets) | `src/rules/joinery/**` | all tier-1 J rules not owned above | L |
| W2.A | Art review loop: 4 art directors score every generator and part in the gallery against §3; anything under 4 goes back to its author's successor with the notes; up to 3 loops | — | — | A |
| W2.X | Integration and gate | — | — | L |

Each A task's tests: geometry is watertight where pieces meet (no duplicate
coplanar faces between merged cells), ink IDs equal across a merged surface,
triangle count per structure under the style budget, and the fixture
scenarios named for its catalogue rules exist and render.

Gate 2: the `everything` scenario looks like a finished illustration of a
static town.

### Wave 3 — It's alive

| ID | Task | Owns | Catalogue | Model |
|---|---|---|---|---|
| W3.1 | Behaviour runtime: attach behaviours to actors and props by socket id, keep state across re-resolves, instance animation | `src/life/runtime/**` | design §13 | L |
| W3.2 | Decoration rules, tier 1 | `src/rules/decoration/**` | D01, D02, D05, D07, D09, D13, D20, D24 | L |
| W3.3 | Wind things: smoke, sails, cloth, trees, water rings | `src/life/wind/**` | L02–L06 | A |
| W3.4 | Dusk things: windows, lamp glow, lighthouse beam | `src/life/dusk/**` | L07, L09 | A |
| W3.5 | Walking graph and routing | `src/life/nav/**` | design §13, L24 | L |
| W3.6 | People: population, day plans, going home, displacement | `src/life/people/**`, `src/rules/life/people*` | L21, L22, L25, L27 | L |
| W3.7 | Birds | `src/life/birds/**`, `src/rules/life/birds*` | L11–L13, L16 | A |
| W3.8 | Boats afloat | `src/life/boats/**`, `src/rules/life/boats*` | L17, L19 | A |
| W3.9 | Feedback: landing bounce, wobble, morph, removal, pop-in, markers, refusal | `src/ui/feedback/**` | F01–F05, F07, F08 | A |
| W3.10 | Urban fill, tier 1, and its facts | `src/rules/urban/**` | U03, U07 | L |
| W3.P | Play-test: 3 agents drive the real app with Playwright (build a town by clicking, on desktop and phone viewport), record what breaks or looks wrong, file findings; fixes dispatched | — | — | A |
| W3.X | Integration and gate | — | — | L |

Gate 3: build a small town by hand in the browser and watch a full dusk
cycle with nothing broken.

### Wave 4 — Depth

Tier 2 and tier 3 rules, grouped so each agent owns whole files:

| ID | Rules | Model |
|---|---|---|
| W4.1 | R-H02, R-H03, R-H05, R-H06, R-H09, R-H12, R-H13, R-H14 | A |
| W4.2 | R-T02–R-T06, R-M01–R-M06, R-A02, R-A03, R-A05, R-D01, R-D03 | A |
| W4.3 | J05, J10, J22, J25, J27 and their parts | A |
| W4.4 | D03, D04, D06, D08, D26, D27, D33 | A |
| W4.5 | D10–D12, D14, D28, D30 | A |
| W4.6 | D15, D17–D19, D21–D23, D25, D31, D32, D34 | A |
| W4.7 | L08 lamplighter, L23 jobs, L26 reactions, L32 stranded | L |
| W4.8 | L10, L14, L15, L18, L20, L28–L31, L33–L35 | A |
| W4.9 | U01, U02, U04–U06, U08–U12 | A |
| W4.10 | Sound (F06) | L |
| W4.11 | Postcard export, share-link polish, new-island flow | L |
| W4.12 | Phone pass: measure on a phone-sized viewport with throttling; apply §14 fallbacks | L |
| W4.13 | Look tuning: variation knobs, palette, line weight, density across the `everything` scenario | A |
| W4.X | Integration and gate | L |

Gate 4: every catalogue rule has a passing fixture.

### Wave 5 — Discovery rounds (design §21)

One workflow per round. At least three rounds; stop when a round accepts
fewer than 8 proposals or time is up.

| Step | Agents | Output |
|---|---|---|
| 5a Build towns | 8 explorers, one brief each (harbour, hill town, castle, market core, temple hill, stilt village, farm edge, wild vertical stack; the Auto-only random town and tiny hamlet rotate in) | 3 scenarios each under `scenarios/discovery/round-N/`, shots from 4 angles by day and dusk, `inspect` dumps |
| 5b Look and question | the same 8 | structured proposals: title, lens, exact trigger in fact vocabulary, result, part, tier, needs (new fact, part, role, kind), evidence screenshot, how often it would appear, cost; plus a list of faults |
| 5c Curate | 1 curator, then 2 sceptics who try to reject each proposal as vague, duplicate, ugly or unpredictable | accepted rules written into the catalogue with new IDs across all tiers; task cards; at most 2 new tray pieces per round, each with a written reason a rule could not do it |
| 5d Build | 1 implementer per 3–4 rules | rules, parts, facts, fixtures, tests |
| 5e Refute | 1 reviewer per implementer, different agent | pass or fail per rule against: fires where it should, not elsewhere, no clashes, no flicker, within budget, rubric §3. Failures loop to 5d once |
| 5f Merge and log | integrator | gate, commit, `docs/swarm/discovery-log.md` entry with before and after shots |

Explorers get the urban-planning lenses from design §21 and are told to
name the real-world thing ("drying green", "mews", "lych gate") before
writing the rule, so proposals are grounded and not generic.

### Wave 6 — Final pass

- Art directors score everything in the gallery once more; redo below-bar
  items.
- A fresh reviewer reads the whole branch for dead stubs, skipped tests and
  purity violations.
- `README.md`: how to run, what is in, what was dropped.
- Morning report in `docs/swarm/STATUS.md` with the best screenshots.

## 6. Self-review of this plan against the spec

- Design §6–§9 → W1.1–W1.4, W1.8. §10 → W1.5, W1.6. §11 → Wave 2. §12 →
  W1.7, W1.9. §13 → Wave 3. §14 → W1.7, W1.X, W4.12. §15 → W1.3, W4.11.
  §16 → W0.1. §20 → section 4 contracts. §21 → Wave 5.
- Every catalogue rule is assigned: tier 1 in Waves 2–3, the rest in Wave 4.
- Known thin spot: touch drag-painting is a spec non-goal and has no task.
