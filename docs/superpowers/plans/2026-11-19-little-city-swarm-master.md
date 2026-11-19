# Little City Swarm Master Plan

> **For agentic workers:** this plan is executed by an orchestrator, one
> stage at a time. If you are a stage owner, read sections 1–4, then only
> your own row in section 5. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the whole of Little City overnight with a small team of
agents that each own a whole domain, then keep improving it with discovery
rounds that invent and add new rules.

**Architecture:** A pure two-stage town-logic core (`World → ShapePlan →
DressingPlan`) with auto-discovered rules, parts and generators, so almost
every domain owns its own files and merges without conflict. One agent
builds the foundation and a running skeleton of stubs; every later agent
replaces stubs in its domain or adds files.

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
- Every agent runs on Fable 5.2 or Opus 5.5. Anything that draws or decides
  how something looks runs on Fable 5.2; pure logic proven by tests may run
  on Opus 5.5.
- Commit at every milestone. Never push. Never rewrite another task's
  commits.

## Review Focus

Conditions the spec implies but no rule's own test covers. Each has an owning
task whose tests must pin it.

1. **Edits arrive faster than dressing finishes.** Expected: the newest edit
   wins, stale dressing is discarded, nothing flickers back. Owner: Logic
   (`staged resolve drops stale dressing`).
2. **A share link or save is malformed, truncated, or from another
   version.** Expected: a plain message, the current town untouched, no
   exception. Owner: Logic (`decode rejects garbage without throwing`).
3. **Building at the limits:** top level `y = 31`, the map border, erasing
   the bottom of a 30-tall stack. Expected: refusal with F08 or a full-height
   generated support, never an exception or an infinite loop. Owner: Logic
   (`supports at world limits`, `edits at bounds are refused`).
4. **The tab sleeps or the frame takes seconds.** Expected: life clamps the
   time step to 100 ms, nobody teleports, the dusk cycle does not jump.
   Owner: Look (`signals clamp dt`).
5. **Storage is unavailable or full** (private browsing). Expected: the game
   plays normally and says once that it cannot save. Owner: Logic
   (`autosave survives storage errors`).

---

## 1. How the run works

**Few owners, whole domains.** Splitting the work thinly loses context and
makes styles drift. So each agent owns a complete domain end to end: its
rules, the parts those rules need, the tests and the fixtures. The agent
that draws houses also writes the rules that decide what a house becomes, so
the two can never disagree.

```
Stage 0  Foundation                      1 agent   ──► gate
Stage 1  Logic · Look · Interface        3 at once ──► gate
Stage 2  Houses · Monuments · Ground     3 at once ──► art review ──► gate
Stage 3  Animation · People · Dressing   3 at once ──► gate
Stage 4  Depth ×3 · Polish               4 at once ──► gate
Stage 5  Discovery rounds (2–3)          2 explorers, then 2 builders, per round
Stage 6  Final art pass and morning report
```

About 25–30 agent runs in total.

- **The orchestrator does the gates itself** (the chat that wrote this):
  merge the branches, run `npm run check` and `npm run shots`, look at the
  screenshots, write `docs/swarm/STATUS.md`, commit. There are no reviewer
  panels. The only review agents are one art director after Stage 2 and one
  at the end.
- **Context for every agent:** this plan's sections 2–4, `docs/swarm/CONTRACTS.md`,
  `docs/swarm/ART.md` (the look guide, written in Stage 1), the design
  sections and catalogue rules for its domain, and the running code.
- **Order is by value.** The game is runnable at every gate from Stage 1 on.
  If the run stops early for any reason (credits, a hard failure), the last
  gate's commit is a working game and `STATUS.md` says exactly where things
  stand.
- A stage item that fails its gate goes back to its owner once with the
  specifics. If it fails again it is cut down or moved later, and noted. The
  run does not stall on one item.

## 2. Rules every agent follows

1. **Read first:** this plan's sections 1–4, your row in section 5, the
   design sections and catalogue rules for your domain, and
   `docs/swarm/CONTRACTS.md` (written by Stage
   0; the frozen API with examples).
2. **Your branch:** work in the worktree you are given, on a branch named
   `swarm/<owner>` created from its starting commit. Run
   `npm ci --prefer-offline` first.
3. **Your files:** create and edit only the paths your row in section 5 gives you,
   plus your own tests, fixtures and gallery entries. Anything else is
   read-only.
4. **Frozen contracts:** do not edit `src/core/**`, `src/resolve/plan.ts`,
   `src/resolve/engine/api.ts`, `src/gen/mesh.ts`, `src/life/api.ts`. If a
   contract blocks you, write `docs/swarm/requests/<owner>.md` saying what
   you need and why, work around it locally, and say so in your report.
5. **No shared lists.** Rules, parts, generators, facts, behaviours and
   scenarios are discovered by file glob. Never add your thing to a central
   index. Style values go in `src/style/<your-module>.ts`.
6. **Task loop:**
   - [ ] Write the tests your row names; run them; see them fail.
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

## 4. The frozen contracts (Stage 0 writes these)

Signatures are binding in substance. Stage 0 may adjust names for
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
// Core facts shipped by the Logic owner (each a defineFact): cellInfo, facades, roofRegions,
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

## 5. Stages and owners

Catalogue ranges are inclusive. "T1" means the tier-1 rules in that range;
the rest are built in Stage 4 by the same domain's depth agent.

### Stage 0 — Foundation (one agent, Fable 5.2)

- Project setup (Vite, strict TS, Vitest, ESLint with the purity ban,
  Playwright) and `npm run check | shots | inspect | bench | dev`.
- All contracts in section 4. Real implementations of `grid`, `rand`,
  `kinds`, the rule engine (discovery, ordering, claims, chance, staging),
  the lazy fact registry, `MeshBuilder`, the part and generator registries,
  the behaviour registry.
- A **stub for every module** so the app runs end to end: flat stub island,
  stub `resolveShape` (Auto → house, one structure per block), a coloured
  box per block, plain Three.js material, click to place and right click to
  erase, nothing moving.
- The scenario builder and the three CLIs, working headless on this Mac.
- A typed vocabulary file listing every feature, prop and actor `type` the
  tier-1 catalogue needs, with its variants and params, so rule code and
  part code agree by construction.
- `docs/swarm/CONTRACTS.md` with one worked example per contract: adding a
  rule, a part, a fact, a generator, a behaviour, a scenario.
- Tests: `key/unkey round-trips`, `rand is stable across runs`, `engine
  discovers a rule file`, `engine orders by priority then id`, `claims block
  a second rule`, `chance is stable per anchor`, `purity lint fails on
  Math.random in src/rules`, `shots CLI writes a PNG`.

Gate 0 (orchestrator): the skeleton runs, a block can be placed in the
browser, the CLIs work, and the orchestrator has read every contract against
this plan.

### Stage 1 — Core (three agents in parallel worktrees)

| Owner | Owns | Delivers | Proves done by |
|---|---|---|---|
| **Logic** (Opus 5.5) | `src/world/**`, `src/terrain/**`, `src/resolve/**` except frozen files | Edits with every placement rule in design §7, undo, autosave, share codec; terrain generator and starting trees (§6); K1–K5, S1–S4, structures (§8–§10); all core facts; staged resolve with content hashes | A test per placement rule; table tests for every example in §8 and §9; terrain checked on 200 seeds; a test per fact; `same world same hashes`; `far edit leaves hash unchanged`; Review Focus 1, 2, 3, 5 |
| **Look** (Fable 5.2) | `src/render/**`, `src/gen/terrain/**`, `src/life/signals.ts`, `docs/swarm/ART.md` | The spike's shading, ink and paper ported with vertex-attribute ink IDs, chunk meshes, instancing, standalone-then-bake; terrain and sea mesh with rounded terraces; free camera; dusk grading; time, wind and event signals; the art guide (palette, proportions, line rules, `MeshBuilder` patterns, do and don't, with pictures) | Shots matching the spike's look; six island seeds; day, dusk and night; `npm run bench` against §14 on a synthetic 2,000-block town; Review Focus 4 |
| **Interface** (Fable 5.2) | `src/ui/**`, `src/app/**`, `gallery/**` | Targeting, tray with drawers, every tool, ghost, Change tool, colour swatch, menus, undo buttons, touch gestures; gallery page with sliders bound to style files | Playwright tests: place, erase, change-cycle, undo, fence centre versus edge, touch tap and long press, on desktop and phone viewports |

Gate 1: on a generated island every tray piece can be placed, Auto blocks
resolve correctly (as labelled boxes), supports appear, undo and share work,
and it is drawn in ink and paper.

### Stage 2 — The town (three agents in parallel, all Fable 5.2)

Each owns the generators, the parts, **and the role and joinery rules** for
its pieces.

| Owner | Pieces | Catalogue (T1 now) |
|---|---|---|
| **Houses** | House shell and merging, roofs for any footprint, doors, windows, chimneys, awnings, signs, shopfronts, balconies; windmill | R-H01–R-H15, R-W01, J01–J12, J24–J27 |
| **Monuments** | Tower, lighthouse and all caps; arches, bridges and generated supports; marble; pillar | R-T01–R-T07, R-L01, R-M01–R-M07, R-A01–R-A06, S1–S4 geometry, J13–J16 |
| **Ground** | Dock and shoreline; stairs and carved steps; fences, walls, gates and railings (cell and edge); path, plaza and garden; trees of every species; fountain; stall | R-D01–R-D04, R-P01, R-F01, R-S01, R-G01, R-E01, R-E02, J17–J23, J28 |

Each proves done by: a fixture scenario per rule; geometry tests (no
duplicate faces between merged cells, equal ink IDs across a merged surface,
triangle budget per structure); its own screenshots viewed from two angles
by day and at dusk against `ART.md`.

Then **one art director** (Fable 5.2) scores everything in the gallery and
the `everything` scenario against section 3 and writes specific fix notes;
each owner's branch gets one fix pass.

Gate 2: the `everything` scenario looks like a finished illustration of a
static town.

### Stage 3 — Life (three agents in parallel)

| Owner | Delivers | Catalogue (T1 now) |
|---|---|---|
| **Animation** (Fable 5.2) | One consistent motion style for everything that is not a person: behaviour runtime that keeps state across re-resolves; smoke, sails, cloth, trees, water; windows and lamps at dusk, lighthouse beam; birds and boats (meshes redrawn, then behaviour); landing bounce, wobble, morph, removal, pop-in, markers, refusal | L02–L07, L09, L11–L13, L16, L17, L19, F01–F05, F07, F08 |
| **People** (Opus 5.5 for routing, with the spike's person mesh ported) | Walking graph, routing, population, day plans, going home at dusk, displacement | design §13, L21, L22, L24, L25, L27 |
| **Dressing** (Fable 5.2) | Decoration and urban-fill rules with their prop parts and any facts they need | D01, D02, D05, D07, D09, D13, D20, D24, U03, U07 |

Gate 3: the orchestrator builds a small town by clicking in the real app
(Playwright) and watches a full dusk cycle with nothing broken.

### Stage 4 — Depth (four agents in parallel)

| Owner | Delivers |
|---|---|
| **Structures depth** (Fable 5.2) | Every remaining R and J rule with its parts |
| **Dressing depth** (Fable 5.2) | Every remaining D and U rule with its parts |
| **Life depth** (Fable 5.2) | Every remaining L rule, including the lamplighter and jobs, and sound (F06) |
| **Polish** (Fable 5.2) | Phone-viewport pass with the §14 fallbacks, postcard export, share and new-island flow, look tuning across the `everything` scenario |

Gate 4: every catalogue rule has a passing fixture.

### Stage 5 — Discovery rounds (design §21)

Two or three rounds, each:

1. **Two explorers** (Fable 5.2), in parallel, each with four town briefs
   (harbour, hill town, castle, market core / temple hill, stilt village,
   farm edge, wild vertical stack; an Auto-only random town and a tiny
   hamlet rotate in). Each builds its towns as scenarios, renders four
   angles by day and dusk, reads the `inspect` output, and returns
   proposals: the real-world thing by name, exact trigger in fact
   vocabulary, result, part, tier, what it needs, evidence screenshot, how
   often it would appear, cost. Plus a list of faults.
2. **The orchestrator curates:** removes duplicates and vague ideas, scores
   by delight × frequency ÷ cost, writes the accepted rules into the
   catalogue with new IDs across all tiers. At most 2 new tray pieces per
   round.
3. **Two builders** (Fable 5.2), in parallel: one for structure-side rules,
   one for dressing and life. Each rule ships with a fixture and test, and
   the builder must render the explorer's evidence scenario again to show
   the gap is closed.
4. **Gate** by the orchestrator, then an entry in
   `docs/swarm/discovery-log.md` with before and after screenshots.

Stop when a round accepts fewer than 8 proposals, or time is up.

### Stage 6 — Final pass

- One art director scores the whole gallery and the discovery towns once
  more; one fix pass on anything below the bar.
- The orchestrator checks for dead stubs, skipped tests and purity
  violations, writes `README.md` (how to run, what is in, what was dropped)
  and the morning report in `docs/swarm/STATUS.md` with the best
  screenshots.

## 6. Self-review of this plan against the spec

- Design §6–§10 → Stage 1 Logic. §7 interface → Stage 1 Interface. §11 →
  Stage 2. §12 → Stage 1 Look. §13 → Stage 3. §14 → Look, Gate 1, Polish.
  §15 → Logic, Polish. §16 → Stage 0. §20 → section 4 contracts and
  `CONTRACTS.md`. §21 → Stage 5.
- Every catalogue rule has an owner: tier 1 in Stages 2–3 by domain, the
  rest in Stage 4 by the matching depth agent.
- Known thin spot: touch drag-painting is a spec non-goal and has no owner.
