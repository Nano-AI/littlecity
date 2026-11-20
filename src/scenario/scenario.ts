// Scenarios (Stage 0, real; treat as frozen). A scenario is a town built in
// code, with cameras and optional assertions. Tests, screenshots, the
// gallery, the benchmark and discovery rounds all use them.
//
//   // scenarios/rules/D05.laundry-line.scenario.ts
//   export default scenario({
//     name: 'D05.laundry-line', seed: 7,
//     build(b) { b.house(10, 12, { floors: 2, color: 1 }); b.house(12, 12, { floors: 2, color: 3 }); },
//     cameras: [{ yaw: 45, pitch: 32, zoom: 3, target: [11, 1, 12] }],
//     expect(plan, dressing, check) { check.hasProp({ type: 'laundry-line' }); },
//   });
//
// Files are discovered by glob: scenarios/**/*.scenario.ts, default export.
// The name must be unique and is the stem of the screenshot files.

import { SIZE_X, SIZE_Z } from '@/core/grid';
import type { Terrain, World } from '@/core/world';
import type { ResolveOptions, Rule } from '@/resolve/engine/api';
import { allRules } from '@/resolve/engine/discover';
import { resolveDressing, resolveShape } from '@/resolve/index';
import type { DressingPlan, ShapePlan } from '@/resolve/plan';
import { generateTerrain, initialWorld } from '@/terrain/terrain';
import { emptyWorld } from '@/world/world';
import { TerrainBuilder, TownBuilder } from './builder';
import { createCheck, type Check } from './check';

/** A part of the day (held at its middle), or a phase 0–1 of the dusk cycle. */
export type TimeOfDay = 'day' | 'dusk' | 'night' | 'dawn' | number;
/**
 * Added by Seasons (design section 13a; docs/swarm/requests/seasons.md). A season held at its usual
 * point ('festival' is winter with the lights up), or a position in the year 0–1 from the start of
 * spring. Scenarios, screenshots and the guide are summer unless they say otherwise.
 */
export type SeasonOfYear = 'spring' | 'summer' | 'autumn' | 'winter' | 'festival' | number;
/** Added by Seasons. Weather held for the scenario (settled at once: snow lies, the town is wet). Default 'clear'. */
export type WeatherOfDay = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'wind' | 'snow';

export interface CameraSpec {
  /** Used in the screenshot file name; defaults to the camera's index. */
  name?: string;
  /** Degrees. 0 looks north; 45 looks north-west from the south-east (the default game view). */
  yaw: number;
  /** Degrees above the horizon (10–85). */
  pitch: number;
  /** 1 fits the whole map in the view's height; 3 shows a third of it. */
  zoom: number;
  /** Looked-at point in grid units: [x, level, z]. */
  target: [number, number, number];
  /** Overrides the scenario's time for this camera. */
  time?: TimeOfDay;
  /** Added by Seasons: overrides the scenario's season and weather for this camera. */
  season?: SeasonOfYear;
  weather?: WeatherOfDay;
}

export interface ScenarioDef {
  /** Unique, kebab-case (dots allowed for rule ids): 'laundry-alley', 'R-H01.chapel'. */
  name: string;
  seed: number;
  /**
   * The ground. Default 'flat': land at height 1 on columns 4–43, water
   * around it; it never changes, so fixtures stay valid. 'generated' is the
   * real island for the seed (use b.onTerrain; positions move if the
   * generator changes). A function builds your own (cliffs, coves, hills).
   */
  terrain?: 'flat' | 'generated' | ((t: TerrainBuilder) => void);
  /**
   * With terrain 'generated': which island generator (design section 6). Default 1, the first
   * generator, so scenarios written before generator 2 keep their island; 2 is the one new
   * islands use (rivers, characters, rock). The built world records it.
   */
  terrainGen?: 1 | 2;
  /** Start from the new-island world (with its starting trees) instead of an empty one. Default false. */
  startingTrees?: boolean;
  build(b: TownBuilder): void;
  /** Default: one camera framing everything that was built. */
  cameras?: CameraSpec[];
  /** Default 'day'. */
  time?: TimeOfDay;
  /** Added by Seasons. Default 'summer'. */
  season?: SeasonOfYear;
  /** Added by Seasons. Default 'clear'. */
  weather?: WeatherOfDay;
  /**
   * Extra rules that exist only in this scenario, run together with the
   * discovered ones. For gallery entries and fixtures that must show a part
   * whatever the real rules decide: a small rule that emits exactly the
   * features, props or actors you want to look at.
   */
  rules?: readonly Rule[];
  /** Assertions run by the scenario test (`npm test`). Throw (or use `check`) to fail. */
  expect?(plan: ShapePlan, dressing: DressingPlan, check: Check): void;
  /** What this scenario shows, for the gallery and inspect. */
  about?: string;
}

export interface Scenario extends ScenarioDef {
  readonly $type: 'scenario';
}

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;

export function scenario(def: ScenarioDef): Scenario {
  if (!NAME_PATTERN.test(def.name)) {
    throw new Error(`scenario: name '${def.name}' must be letters, digits, dots and dashes (it becomes a file name)`);
  }
  return Object.freeze({ ...def, $type: 'scenario' as const });
}
export function isScenario(x: unknown): x is Scenario {
  return typeof x === 'object' && x !== null && (x as { $type?: unknown }).$type === 'scenario';
}

export interface BuiltScenario {
  scenario: Scenario;
  terrain: Terrain;
  world: World;
  cameras: CameraSpec[];
}

/** The standard flat test ground. */
export function flatTerrain(seed: number): Terrain {
  const t = new TerrainBuilder(seed);
  t.rect(4, 4, SIZE_X - 5, SIZE_Z - 5, 1);
  return t.build();
}

/** Runs a scenario's build() and returns its terrain, world and cameras. Pure. */
export function buildScenario(s: Scenario): BuiltScenario {
  let terrain: Terrain;
  const gen = s.terrain === 'generated' && s.terrainGen === 2 ? 2 : 1;
  if (s.terrain === 'generated') terrain = generateTerrain(s.seed, gen);
  else if (typeof s.terrain === 'function') {
    const t = new TerrainBuilder(s.seed);
    s.terrain(t);
    terrain = t.build();
  } else terrain = flatTerrain(s.seed);
  const start = s.startingTrees ? initialWorld(s.seed, terrain, gen) : emptyWorld(s.seed, gen);
  const b = new TownBuilder(start, terrain, s.name);
  s.build(b);
  const world = b.world;
  const cameras = s.cameras && s.cameras.length > 0 ? s.cameras : [frameCamera(world)];
  return { scenario: s, terrain, world, cameras };
}

export interface ResolvedScenario extends BuiltScenario {
  shape: ShapePlan;
  dressing: DressingPlan;
}

/** The options a scenario resolves with: the discovered rules plus the scenario's own. */
export function scenarioResolveOptions(s: Scenario, opts: ResolveOptions = {}): ResolveOptions {
  if (!s.rules || s.rules.length === 0) return opts;
  return { ...opts, rules: [...(opts.rules ?? allRules()), ...s.rules] };
}

/** Builds and resolves both stages. */
export function resolveScenario(s: Scenario, opts?: ResolveOptions): ResolvedScenario {
  const built = buildScenario(s);
  const withOwn = scenarioResolveOptions(s, opts);
  const shape = resolveShape(built.world, built.terrain, withOwn);
  const dressing = resolveDressing(shape, withOwn);
  return { ...built, shape, dressing };
}

/** Builds, resolves and runs the scenario's expect(). Throws on the first failed assertion. */
export function checkScenario(s: Scenario): ResolvedScenario {
  const r = resolveScenario(s);
  s.expect?.(r.shape, r.dressing, createCheck(r.shape, r.dressing, s.name));
  return r;
}

/** A camera that frames every placed piece (or the whole map if nothing is placed). */
export function frameCamera(world: World): CameraSpec {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0;
  const see = (k: number): void => {
    const x = k & 63, z = (k >> 6) & 63, y = k >> 12;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z + 1);
    y1 = Math.max(y1, y + 1);
  };
  for (const k of world.blocks.keys()) see(k);
  for (const k of world.floors.keys()) see(k);
  for (const e of world.edges.keys()) see(e >> 1);
  if (x0 === Infinity) return { yaw: 45, pitch: 35, zoom: 1.4, target: [SIZE_X / 2, 1, SIZE_Z / 2] };
  const extent = Math.max(x1 - x0, z1 - z0) * 1.3 + y1 * 0.8 + 5;
  return {
    yaw: 45,
    pitch: 35,
    zoom: Math.min(8, Math.max(1, SIZE_Z / extent)),
    target: [(x0 + x1) / 2, Math.max(1, y1 / 2), (z0 + z1) / 2],
  };
}

/** The file-name part for a camera: its name, or its index. */
export function cameraName(cameras: readonly CameraSpec[], index: number): string {
  return cameras[index]?.name ?? String(index);
}

